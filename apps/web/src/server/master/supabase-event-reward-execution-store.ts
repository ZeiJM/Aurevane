import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import type {
  EventRewardClaimExecutionPlan,
  EventRewardClaimExecutionRecord,
  EventRewardExecutionStore,
} from './event-reward-execution-service'

type JsonObject = Record<string, unknown>

export function createSupabaseEventRewardExecutionStore(): EventRewardExecutionStore {
  return {
    async prepareClaimExecution(reservationId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('prepare_event_reward_claim_execution_v1', {
        p_reservation_id: reservationId,
      })
      if (error) throw unavailable()

      const row = singleRow(data)
      const plan = parsePlan(row)
      if (!plan) throw unavailable()
      return plan
    },

    async recordClaimExecution(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('record_event_reward_claim_execution_v1', {
        p_reservation_id: input.reservationId,
        p_reward_ordinal: input.rewardOrdinal,
        p_reward_type: input.rewardType,
        p_receipt_id: input.receiptId,
        p_applied_amount: input.appliedAmount,
      })
      if (error) throw unavailable()

      const row = singleRow(data)
      const record = parseRecord(row)
      if (!record) throw unavailable()
      return record
    },
  }
}

function singleRow(value: unknown): JsonObject | null {
  if (!Array.isArray(value) || value.length !== 1) return null
  const row = value[0]
  return typeof row === 'object' && row !== null && !Array.isArray(row)
    ? (row as JsonObject)
    : null
}

function parsePlan(row: JsonObject | null): EventRewardClaimExecutionPlan | null {
  if (!row) return null

  const reservationId = text(row.reservation_id)
  const runId = text(row.run_id)
  const characterId = text(row.character_id)
  const userId = text(row.user_id)
  const rewardPackageRef = text(row.reward_package_ref)
  const claimedAt = nullableText(row.claimed_at)
  const executionReceiptId = nullableText(row.execution_receipt_id)
  const executionAppliedAmount = nullableSafeInteger(row.execution_applied_amount)

  if (
    !reservationId ||
    !runId ||
    !characterId ||
    !userId ||
    !rewardPackageRef ||
    row.package_definition === null ||
    typeof row.package_definition !== 'object' ||
    Array.isArray(row.package_definition) ||
    claimedAt === undefined ||
    executionReceiptId === undefined ||
    executionAppliedAmount === undefined
  ) {
    return null
  }

  return {
    reservationId,
    runId,
    characterId,
    userId,
    rewardPackageRef,
    packageDefinition: row.package_definition,
    claimedAt,
    executionReceiptId,
    executionAppliedAmount,
  }
}

function parseRecord(row: JsonObject | null): EventRewardClaimExecutionRecord | null {
  if (!row) return null
  const claimedAt = text(row.claimed_at)
  if (!claimedAt || typeof row.replayed !== 'boolean') return null
  return { claimedAt, replayed: row.replayed }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null
  return text(value) ?? undefined
}

function nullableSafeInteger(value: unknown): number | null | undefined {
  if (value === null) return null
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  ) {
    return value
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : undefined
  }
  return undefined
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Event reward execution is unavailable right now.',
  )
}
