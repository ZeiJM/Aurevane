import 'server-only'

import type {
  BattleEventRecord,
  BattleEventRepository,
  BattleSessionCommitRecord,
  BattleSessionCreationRecord,
  BattleSessionRecord,
  BattleSessionRepository,
} from '@aurevane/db/battle-session'
import { AurevaneError, StaleBattleVersionError } from '@aurevane/game-core/errors'
import {
  parseBattleEventPersistenceRows,
  parseBattleSessionCommitPersistenceRow,
  parseBattleSessionCreationPersistenceRow,
  parseBattleSessionPersistenceRow,
} from '@aurevane/validation/combat/battle-session'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

function persistenceUnavailable(message: string): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function throwRpcError(error: { code?: string; message?: string }): never {
  if (error.code === '22023' && error.message?.includes('IDEMPOTENCY_CONFLICT')) {
    throw new AurevaneError(
      'IDEMPOTENCY_CONFLICT',
      'That request key was already used for a different battle request.',
    )
  }

  if (error.code === '40001') {
    const match = error.message?.match(/BATTLE_VERSION_STALE:(\d+)/)
    if (match) {
      const currentVersion = Number(match[1])
      if (Number.isSafeInteger(currentVersion) && currentVersion > 0) {
        throw new StaleBattleVersionError(currentVersion)
      }
    }
  }

  if (error.code === '42501') {
    throw new AurevaneError('FORBIDDEN', 'That battle is not available to this account.')
  }

  throw persistenceUnavailable('The server could not persist the battle right now.')
}

export function createSupabaseBattleSessionRepository(): BattleSessionRepository &
  BattleEventRepository {
  return {
    async createBattleSession(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('create_battle_session_v1', {
        p_actor_key: input.actorKey,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_user_id: input.userId,
        p_battle_id: input.battleId,
        p_rules_version: input.rulesVersion,
        p_content_version: input.contentVersion,
        p_initial_snapshot: input.initialSnapshot,
        p_participants: input.participants.map((participant) => ({
          combatant_id: participant.combatantId,
          participant_role: participant.participantRole,
          character_id: participant.characterId,
        })),
      })

      if (error) throwRpcError(error)
      const row = parseBattleSessionCreationPersistenceRow(data)
      if (!row) {
        throw persistenceUnavailable('The server returned an invalid battle-creation result.')
      }

      const result: BattleSessionCreationRecord = {
        battleSessionId: row.battle_session_id,
        battleVersion: row.battle_version,
        snapshot: row.snapshot,
        createdAt: row.created_at,
      }

      return { result, replayed: row.replayed }
    },

    async findBattleSession(userId, battleSessionId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_battle_session_v2', {
        p_user_id: userId,
        p_battle_session_id: battleSessionId,
      })

      if (error) throwRpcError(error)
      if (Array.isArray(data) && data.length === 0) return null

      const row = parseBattleSessionPersistenceRow(data)
      if (!row) {
        throw persistenceUnavailable('The server returned an invalid battle-session result.')
      }

      const result: BattleSessionRecord = {
        battleSessionId: row.battle_session_id,
        battleId: row.battle_id,
        battleVersion: row.battle_version,
        rulesVersion: row.rules_version,
        contentVersion: row.content_version,
        lifecycle: row.lifecycle,
        snapshot: row.snapshot,
        controlledCombatantIds: row.controlled_combatant_ids,
        updatedAt: row.updated_at,
      }

      return result
    },

    async findBattleIntentReplay(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_battle_intent_replay_v1', {
        p_actor_key: input.actorKey,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_user_id: input.userId,
        p_battle_session_id: input.battleSessionId,
      })

      if (error) throwRpcError(error)
      if (Array.isArray(data) && data.length === 0) return null

      const row = parseBattleSessionCommitPersistenceRow(data)
      if (!row) {
        throw persistenceUnavailable('The server returned an invalid battle-replay result.')
      }

      return {
        battleSessionId: row.battle_session_id,
        battleVersion: row.battle_version,
        snapshot: row.snapshot,
        committedAt: row.committed_at,
      }
    },

    async commitBattleIntent(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('commit_battle_intent_v2', {
        p_actor_key: input.actorKey,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_user_id: input.userId,
        p_battle_session_id: input.battleSessionId,
        p_expected_battle_version: input.expectedBattleVersion,
        p_next_snapshot: input.nextSnapshot,
        p_events: input.events,
      })

      if (error) throwRpcError(error)
      const row = parseBattleSessionCommitPersistenceRow(data)
      if (!row) {
        throw persistenceUnavailable('The server returned an invalid battle-commit result.')
      }

      const result: BattleSessionCommitRecord = {
        battleSessionId: row.battle_session_id,
        battleVersion: row.battle_version,
        snapshot: row.snapshot,
        committedAt: row.committed_at,
      }

      return { result, replayed: row.replayed }
    },

    async findBattleEvents(userId, battleSessionId, limit) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_battle_events_v2', {
        p_user_id: userId,
        p_battle_session_id: battleSessionId,
        p_limit: limit,
      })

      if (error) throwRpcError(error)
      const rows = parseBattleEventPersistenceRows(data)
      if (!rows) {
        throw persistenceUnavailable('The server returned an invalid battle-event result.')
      }

      return rows.map((row): BattleEventRecord => ({
        battleVersion: row.battle_version,
        eventIndex: row.event_index,
        event: row.event,
        createdAt: row.created_at,
      }))
    },
  }
}
