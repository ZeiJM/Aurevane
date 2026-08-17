import 'server-only'

import type {
  SetPracticePlanRecord,
  TrainingReportClaimRecord,
  TrainingReportRecord,
  WayfarersPracticeRepository,
  WayfarersPracticeStatusRecord,
} from '@aurevane/db/wayfarers-practice'
import { AurevaneError } from '@aurevane/game-core/errors'
import {
  parseSetPracticePlanPersistenceRow,
  parseTrainingReportClaimPersistenceRow,
  parseTrainingReportPersistenceRow,
  parseWayfarersPracticeStatusPersistenceRow,
} from '@aurevane/validation/player/wayfarers-practice'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export function createSupabaseWayfarersPracticeRepository(): WayfarersPracticeRepository {
  return {
    async materializeTrainingReport(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('materialize_training_report_v2', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
      })

      if (error) {
        if (error.message.includes('CHARACTER_NOT_FOUND')) {
          throw new AurevaneError('INVALID_REQUEST', 'The target character was not available.')
        }
        throw unavailable()
      }

      if (data === null || (Array.isArray(data) && data.length === 0)) {
        return null
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseTrainingReportPersistenceRow(candidate)
      if (!row) {
        throw unavailable()
      }

      return toTrainingReportRecord(row)
    },

    async getPracticeStatus(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('get_wayfarers_practice_status_v1', {
        p_user_id: input.userId,
        p_character_id: input.characterId,
      })

      if (error) {
        if (error.message.includes('CHARACTER_NOT_FOUND')) {
          throw new AurevaneError('INVALID_REQUEST', 'The target character was not available.')
        }
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseWayfarersPracticeStatusPersistenceRow(candidate)
      if (!row) {
        throw unavailable()
      }

      return toPracticeStatusRecord(row)
    },

    async setPracticePlan(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('set_wayfarers_practice_plan_v1', {
        p_actor_key: input.actorKey,
        p_command_name: input.commandName,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_planned_window: input.plannedWindow,
      })

      if (error) {
        if (error.code === '22023' && error.message.includes('idempotency key reused')) {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That Practice plan key was already used for a different request.',
          )
        }
        if (error.message.includes('CHARACTER_NOT_FOUND')) {
          throw new AurevaneError('INVALID_REQUEST', 'The target character was not available.')
        }
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseSetPracticePlanPersistenceRow(candidate)
      if (!row) {
        throw unavailable()
      }

      return {
        result: toSetPracticePlanRecord(row),
        replayed: row.replayed,
      }
    },

    async claimTrainingReport(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('claim_training_report_v1', {
        p_actor_key: input.actorKey,
        p_command_name: input.commandName,
        p_idempotency_key: input.idempotencyKey,
        p_request_fingerprint: input.requestFingerprint,
        p_user_id: input.userId,
        p_character_id: input.characterId,
        p_report_id: input.reportId,
      })

      if (error) {
        if (error.code === '22023' && error.message.includes('idempotency key reused')) {
          throw new AurevaneError(
            'IDEMPOTENCY_CONFLICT',
            'That Training Report claim key was already used for a different request.',
          )
        }
        if (error.message.includes('CHARACTER_NOT_FOUND')) {
          throw new AurevaneError('INVALID_REQUEST', 'The target character was not available.')
        }
        if (error.message.includes('TRAINING_REPORT_NOT_FOUND')) {
          throw new AurevaneError('INVALID_REQUEST', 'The Training Report was not available.')
        }
        throw unavailable()
      }

      const candidate = Array.isArray(data) && data.length === 1 ? data[0] : null
      const row = parseTrainingReportClaimPersistenceRow(candidate)
      if (!row) {
        throw unavailable()
      }

      return {
        result: toClaimRecord(row),
        replayed: row.replayed,
      }
    },
  }
}

function toTrainingReportRecord(
  row: NonNullable<ReturnType<typeof parseTrainingReportPersistenceRow>>,
): TrainingReportRecord {
  return {
    reportId: row.report_id,
    characterId: row.character_id,
    userId: row.user_id,
    focus: row.focus,
    configVersion: row.config_version,
    practiceSource: row.practice_source,
    plannedWindow: row.planned_window,
    plannedWindowConfigVersion: row.planned_window_config_version,
    plannedWindowSeconds: row.planned_window_seconds,
    plannedElapsedSeconds: row.planned_elapsed_seconds,
    balancedFallbackSeconds: row.balanced_fallback_seconds,
    windowStartedAt: row.window_started_at,
    windowEndedAt: row.window_ended_at,
    elapsedSeconds: row.elapsed_seconds,
    creditedDirectSeconds: row.credited_direct_seconds,
    fullRateSeconds: row.full_rate_seconds,
    reducedRateSeconds: row.reduced_rate_seconds,
    requestedCharacterXp: row.requested_character_xp,
    directXpCapReached: row.direct_xp_cap_reached,
    restedMomentumSeconds: row.rested_momentum_seconds,
    restedMomentumGain: row.rested_momentum_gain,
    restedMomentumCapReached: row.rested_momentum_cap_reached,
    status: row.status,
    createdAt: row.created_at,
    claimedAt: row.claimed_at,
  }
}

function toPracticeStatusRecord(
  row: NonNullable<ReturnType<typeof parseWayfarersPracticeStatusPersistenceRow>>,
): WayfarersPracticeStatusRecord {
  return {
    characterId: row.character_id,
    userId: row.user_id,
    focus: row.focus,
    configVersion: row.config_version,
    minimumOfflineSeconds: row.minimum_offline_seconds,
    restedMomentumBalance: row.rested_momentum_balance,
    plannedWindow: row.planned_window,
    plannedWindowConfigVersion: row.planned_window_config_version,
    plannedWindowSeconds: row.planned_window_seconds,
    planSetAt: row.plan_set_at,
    shortWindowSeconds: row.short_window_seconds,
    overnightWindowSeconds: row.overnight_window_seconds,
    extendedWindowSeconds: row.extended_window_seconds,
    serverNow: row.server_now,
  }
}

function toSetPracticePlanRecord(
  row: NonNullable<ReturnType<typeof parseSetPracticePlanPersistenceRow>>,
): SetPracticePlanRecord {
  return {
    characterId: row.character_id,
    userId: row.user_id,
    plannedWindow: row.planned_window,
    plannedWindowConfigVersion: row.planned_window_config_version,
    plannedWindowSeconds: row.planned_window_seconds,
    planSetAt: row.plan_set_at,
    serverNow: row.server_now,
  }
}

function toClaimRecord(
  row: NonNullable<ReturnType<typeof parseTrainingReportClaimPersistenceRow>>,
): TrainingReportClaimRecord {
  return {
    reportId: row.report_id,
    characterId: row.character_id,
    userId: row.user_id,
    progressionCycle: row.progression_cycle,
    curveVersion: row.curve_version,
    xpGrantId: row.xp_grant_id,
    requestedCharacterXp: row.requested_character_xp,
    appliedCharacterXp: row.applied_character_xp,
    xpBefore: row.xp_before,
    xpAfter: row.xp_after,
    levelBefore: row.level_before,
    levelAfter: row.level_after,
    reachedLevel: row.reached_level,
    restedMomentumBefore: row.rested_momentum_before,
    restedMomentumApplied: row.rested_momentum_applied,
    restedMomentumAfter: row.rested_momentum_after,
    claimedAt: row.claimed_at,
  }
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    "Wayfarer's Practice data is unavailable right now.",
  )
}
