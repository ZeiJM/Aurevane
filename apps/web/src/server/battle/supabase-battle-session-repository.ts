import { throwItemRpcError } from '@/server/character/supabase-character-items-repository'
import { throwCoreConversionAdmissionError } from './core-conversion-admission-error'
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
  parseBattleSessionId,
  parseBattleSessionPersistenceRow,
} from '@aurevane/validation/combat/battle-session'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import {
  parseBattleHistoryPrivacyAuthorityRow,
  type BattleHistoryPrivacyRepository,
} from './battle-history-privacy-authority'

function persistenceUnavailable(message: string): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function throwRpcError(error: { code?: string; message?: string }): never {
  throwCoreConversionAdmissionError(error)
  if (error.message?.startsWith('ITEM_')) throwItemRpcError(error)
  if (error.code === '22023' && error.message?.includes('IDEMPOTENCY_CONFLICT')) {
    throw new AurevaneError(
      'IDEMPOTENCY_CONFLICT',
      'That request key was already used for a different battle request.',
    )
  }

  if (error.code === '40001' || error.code === 'PT409') {
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

interface WorldBattleAdmissionContext {
  characterId: string
  expectedVersion: number
  worldFingerprint: string
  throwWorldError(error: { code?: string; message?: string }): never
}

type WorldBattleAdmission = WorldBattleAdmissionContext &
  ({ runId: string } | { npcId: string; ticketId?: string })

export type WorldNpcBattleTarget = { npcId: string } | { ticketId: string }

export async function readWorldNpcBattleReplay(
  client: ReturnType<typeof createSupabaseAdminClient>,
  target: WorldNpcBattleTarget,
  input: { userId: string; characterId: string; commandId: string; worldFingerprint: string },
  throwWorldError: WorldBattleAdmissionContext['throwWorldError'],
): Promise<string | null> {
  const { data, error } = await client.rpc(
    'ticketId' in target
      ? 'read_world_avenger_battle_replay_v1'
      : 'read_world_npc_battle_replay_v1',
    {
      p_user_id: input.userId,
      p_character_id: input.characterId,
      p_command_id: input.commandId,
      p_world_fingerprint: input.worldFingerprint,
      ...('ticketId' in target ? { p_ticket_id: target.ticketId } : { p_npc_id: target.npcId }),
    },
  )
  if (error) throwWorldError(error)
  if (data === null) return null
  const battleSessionId = parseBattleSessionId(data)
  if (!battleSessionId)
    throw persistenceUnavailable('The server returned an invalid World battle receipt.')
  return battleSessionId
}

export function createSupabaseBattleSessionRepository(
  world?: WorldBattleAdmission,
): BattleSessionRepository & BattleEventRepository & BattleHistoryPrivacyRepository {
  return {
    async findBattleCreationReplay(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_battle_creation_replay_v1', {
        p_user_id: input.userId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
      })
      if (error) throwRpcError(error)
      if (Array.isArray(data) && data.length === 0) return null
      const row = parseBattleSessionCreationPersistenceRow(data)
      if (!row)
        throw persistenceUnavailable('The server returned an invalid battle-creation replay.')
      if (world && 'npcId' in world) {
        // A concurrent creation may share an NPC but belong to a different World command.
        const receipt = await readWorldNpcBattleReplay(
          supabase,
          world.ticketId === undefined ? { npcId: world.npcId } : { ticketId: world.ticketId },
          {
            userId: input.userId,
            characterId: world.characterId,
            commandId: input.idempotencyKey,
            worldFingerprint: world.worldFingerprint,
          },
          world.throwWorldError,
        )
        if (receipt !== row.battle_session_id)
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That request key was already used for a different battle request.',
          )
      }
      return {
        battleSessionId: row.battle_session_id,
        battleVersion: row.battle_version,
        snapshot: row.snapshot,
        createdAt: row.created_at,
      }
    },
    async createBattleSession(input) {
      const supabase = createSupabaseAdminClient()
      const common = {
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
      }
      const startup = {
        p_start_snapshot: input.startup?.startSnapshot ?? null,
        p_initial_events: input.startup?.events ?? null,
        p_privacy_journal: input.startup?.privacyJournal ?? null,
      }
      const { data, error } = world
        ? await supabase.rpc(
            'runId' in world
              ? 'start_world_personal_realm_battle_v1'
              : world.ticketId === undefined
                ? 'start_world_npc_battle_v1'
                : 'start_world_avenger_battle_v1',
            {
              ...common,
              ...startup,
              p_command_id: input.idempotencyKey,
              p_character_id: world.characterId,
              p_expected_version: world.expectedVersion,
              ...('runId' in world
                ? { p_run_id: world.runId }
                : {
                    p_npc_id: world.npcId,
                    ...(world.ticketId === undefined ? {} : { p_ticket_id: world.ticketId }),
                  }),
              p_world_fingerprint: world.worldFingerprint,
            },
          )
        : await supabase.rpc(
            input.startup ? 'create_battle_session_v2' : 'create_battle_session_v1',
            {
              ...common,
              p_actor_key: input.actorKey,
              p_idempotency_key: input.idempotencyKey,
              ...(input.startup ? startup : {}),
            },
          )

      if (error) {
        if (world && error.message?.startsWith('WORLD_')) world.throwWorldError(error)
        throwRpcError(error)
      }
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
      const { data, error } = await supabase.rpc('commit_battle_intent_v3', {
        p_actor_key: input.actorKey,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_user_id: input.userId,
        p_battle_session_id: input.battleSessionId,
        p_expected_battle_version: input.expectedBattleVersion,
        p_next_snapshot: input.nextSnapshot,
        p_events: input.events,
        p_privacy_journal: input.privacyJournal,
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

    async findBattleEvents(userId, battleSessionId, limit, before) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_battle_events_v3', {
        p_user_id: userId,
        p_battle_session_id: battleSessionId,
        p_limit: limit,
        p_before_battle_version: before?.battleVersion ?? null,
        p_before_event_index: before?.eventIndex ?? null,
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

    async findBattleHistoryPrivacy(userId, battleSessionId, battleVersions) {
      const versions = [...new Set(battleVersions)]
      if (versions.some((version) => !Number.isSafeInteger(version) || version < 1)) {
        throw persistenceUnavailable('The server received invalid battle-history versions.')
      }

      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_battle_history_privacy_v1', {
        p_user_id: userId,
        p_battle_session_id: battleSessionId,
        p_battle_versions: versions,
      })

      if (error) throwRpcError(error)
      if (!Array.isArray(data) || data.length !== 1) {
        throw persistenceUnavailable(
          'The server returned invalid battle-history privacy authority.',
        )
      }

      const authority = parseBattleHistoryPrivacyAuthorityRow(data[0])
      if (!authority) {
        throw persistenceUnavailable(
          'The server returned invalid battle-history privacy authority.',
        )
      }

      const requestedVersions = new Set(versions)
      if (authority.journals.some((journal) => !requestedVersions.has(journal.battleVersion))) {
        throw persistenceUnavailable('The server returned unexpected battle-history privacy data.')
      }

      return authority
    },
  }
}
