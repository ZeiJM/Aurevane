import 'server-only'

import type { CharacterXpGrantRecord, ProgressionRepository } from '@aurevane/db/progression'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseCharacterXpGrantPersistenceRow,
  parseLevelProgressionCurvePersistenceRow,
} from '@aurevane/validation/player/progression'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export function createSupabaseProgressionRepository(): ProgressionRepository {
  return {
    async loadCurveForCycle(cycleNumber) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_level_progression_curve_v1', {
        p_progression_cycle: cycleNumber,
      })

      if (error) {
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseLevelProgressionCurvePersistenceRow(candidate)
      if (!row) {
        throw unavailable()
      }

      return {
        version: row.curve_version,
        maxLevel: row.max_level,
        cumulativeXpByLevel: row.cumulative_xp_by_level,
      }
    },

    async grantCharacterXp(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('grant_character_xp_v1', {
        p_character_id: input.characterId,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_authority_key: input.authorityKey,
        p_source_kind: input.sourceKind,
        p_source_id: input.sourceId,
        p_reason_tag: input.reasonTag,
        p_amount: input.amount,
      })

      if (error) {
        if (error.code === '22023' && error.message.includes('idempotency key reused')) {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That XP grant key was already used for a different request.',
          )
        }
        if (error.message.includes('CHARACTER_NOT_FOUND')) {
          throw new AurevaneError('INVALID_REQUEST', 'The target character was not available.')
        }
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseCharacterXpGrantPersistenceRow(candidate)
      if (!row) {
        throw unavailable()
      }

      return {
        result: toGrantRecord(row),
        replayed: row.replayed,
      }
    },
  }
}

function toGrantRecord(
  row: NonNullable<ReturnType<typeof parseCharacterXpGrantPersistenceRow>>,
): CharacterXpGrantRecord {
  return {
    grantId: row.grant_id,
    characterId: row.character_id,
    progressionCycle: row.progression_cycle,
    curveVersion: row.curve_version,
    authorityKey: row.authority_key,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    reasonTag: row.reason_tag,
    requestedAmount: row.requested_amount,
    appliedAmount: row.applied_amount,
    xpBefore: row.xp_before,
    xpAfter: row.xp_after,
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    reachedLevel: row.reached_level,
    secondsSinceCycleStart: row.seconds_since_cycle_start,
    createdAt: row.created_at,
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Progression data is unavailable right now.')
}
