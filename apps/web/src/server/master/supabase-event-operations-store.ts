import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import type {
  EventCleanupCompletionRecord,
  EventOperationDashboard,
  EventOperationRunSummary,
  EventOperationsStore,
  EventPhaseAdvanceRecord,
  EventRunMutationRecord,
} from './event-operations-service'

type JsonObject = Record<string, unknown>

interface RpcError {
  code?: string
  message?: string
}

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function nullableText(value: unknown): string | null | undefined {
  if (value === null) return null
  return text(value) ?? undefined
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[1-9][0-9]*$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function oneRow(data: unknown): JsonObject | null {
  if (!Array.isArray(data) || data.length !== 1) return null
  return object(data[0])
}

function unavailable(message = 'Event operations persistence is unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function mapRpcError(error: RpcError): never {
  const message = error.message ?? ''
  if (error.code === '40001' || message.includes('STATE_VERSION_CONFLICT')) {
    throw new AurevaneError('STALE_VERSION', 'Event state changed. Refresh and retry.', {
      cause: error,
    })
  }
  if (error.code === '42501') {
    throw new AurevaneError('FORBIDDEN', 'This Event operation is not available to this account.', {
      cause: error,
    })
  }
  if (message.includes('EVENT_OPERATIONS_AUDIT_CONFLICT')) {
    throw new AurevaneError(
      'IDEMPOTENCY_CONFLICT',
      'That live Event action key was already used for a different operation.',
      { cause: error },
    )
  }
  if (
    error.code === '22023' ||
    message.includes('EVENT_OPERATION_') ||
    message.includes('EVENT_PHASE_') ||
    message.includes('EVENT_CLEANUP_') ||
    message.includes('EVENT_RUN_')
  ) {
    throw new AurevaneError('INVALID_REQUEST', message || 'Event operation was invalid.', {
      cause: error,
    })
  }
  throw unavailable()
}

function parseRunSummary(row: JsonObject): EventOperationRunSummary | null {
  const runId = text(row.run_id)
  const eventKey = text(row.event_key)
  const lifecycleStatus = text(row.lifecycle_status)
  const stateVersion = positiveInteger(row.state_version)
  const scopeType = text(row.scope_type)
  const scopeKey = nullableText(row.scope_key)
  const currentPhaseId = nullableText(row.current_phase_id)
  const scheduledStartAt = nullableText(row.scheduled_start_at)
  const scheduledEndAt = nullableText(row.scheduled_end_at)
  const startedAt = nullableText(row.started_at)
  const cleanupStatus = text(row.cleanup_status)
  const updatedAt = text(row.updated_at)

  if (
    !runId ||
    !eventKey ||
    !lifecycleStatus ||
    !stateVersion ||
    !scopeType ||
    scopeKey === undefined ||
    currentPhaseId === undefined ||
    scheduledStartAt === undefined ||
    scheduledEndAt === undefined ||
    startedAt === undefined ||
    !cleanupStatus ||
    !updatedAt
  ) {
    return null
  }

  return {
    runId,
    eventKey,
    lifecycleStatus,
    stateVersion,
    scopeType,
    scopeKey,
    currentPhaseId,
    scheduledStartAt,
    scheduledEndAt,
    startedAt,
    cleanupStatus,
    updatedAt,
  }
}

function parseRunMutation(data: unknown): EventRunMutationRecord {
  const row = oneRow(data)
  if (!row) throw unavailable('The server did not return the Event operation result.')
  const runId = text(row.run_id)
  const lifecycleStatus = text(row.lifecycle_status)
  const stateVersion = positiveInteger(row.state_version)
  if (!runId || !lifecycleStatus || !stateVersion || typeof row.replayed !== 'boolean') {
    throw unavailable('The server returned an invalid Event operation result.')
  }
  return { runId, lifecycleStatus, stateVersion, replayed: row.replayed }
}

function parseAdvance(data: unknown): EventPhaseAdvanceRecord {
  const row = oneRow(data)
  if (!row) throw unavailable('The server did not return the phase advance result.')
  const runId = text(row.run_id)
  const currentPhaseId = text(row.current_phase_id)
  const stateVersion = positiveInteger(row.state_version)
  if (!runId || !currentPhaseId || !stateVersion || typeof row.replayed !== 'boolean') {
    throw unavailable('The server returned an invalid phase advance result.')
  }
  return { runId, currentPhaseId, stateVersion, replayed: row.replayed }
}

function parseCleanup(data: unknown): EventCleanupCompletionRecord {
  const row = oneRow(data)
  if (!row) throw unavailable('The server did not return the cleanup completion result.')
  const runId = text(row.run_id)
  const cleanupStatus = text(row.cleanup_status)
  const stateVersion = positiveInteger(row.state_version)
  if (!runId || !cleanupStatus || !stateVersion || typeof row.replayed !== 'boolean') {
    throw unavailable('The server returned an invalid cleanup completion result.')
  }
  return { runId, cleanupStatus, stateVersion, replayed: row.replayed }
}

function parseDashboard(data: unknown): EventOperationDashboard {
  const candidate = Array.isArray(data) && data.length === 1 ? data[0] : data
  const dashboard = object(candidate)
  if (!dashboard || !object(dashboard.run)) {
    throw unavailable('The server returned an invalid Event dashboard.')
  }
  return dashboard as unknown as EventOperationDashboard
}

export function createSupabaseEventOperationsStore(): EventOperationsStore {
  return {
    async listRuns(actorUserId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('list_event_operation_runs_v1', {
        p_actor_user_id: actorUserId,
      })
      if (error) mapRpcError(error)
      if (!Array.isArray(data)) throw unavailable()

      const parsed: EventOperationRunSummary[] = []
      for (const candidate of data) {
        const row = object(candidate)
        const run = row ? parseRunSummary(row) : null
        if (!run) throw unavailable('The server returned an invalid Event run list.')
        parsed.push(run)
      }
      return parsed
    },

    async readDashboard(actorUserId, runId) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('read_event_operation_dashboard_v1', {
        p_actor_user_id: actorUserId,
        p_run_id: runId,
      })
      if (error) mapRpcError(error)
      return parseDashboard(data)
    },

    async operate(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('operate_event_run_v2', {
        p_actor_user_id: input.actorUserId,
        p_run_id: input.runId,
        p_expected_state_version: input.expectedStateVersion,
        p_idempotency_key: input.idempotencyKey,
        p_command: input.command,
        p_reason: input.reason,
        p_confirmed: input.confirmed,
      })
      if (error) mapRpcError(error)
      return parseRunMutation(data)
    },

    async advancePhase(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('advance_event_run_phase_v2', {
        p_actor_user_id: input.actorUserId,
        p_run_id: input.runId,
        p_expected_state_version: input.expectedStateVersion,
        p_idempotency_key: input.idempotencyKey,
        p_reason: input.reason,
        p_confirmed: input.confirmed,
      })
      if (error) mapRpcError(error)
      return parseAdvance(data)
    },

    async completeCleanup(input) {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase.rpc('complete_event_cleanup_requirement_v2', {
        p_actor_user_id: input.actorUserId,
        p_run_id: input.runId,
        p_phase_id: input.phaseId,
        p_effect_ordinal: input.effectOrdinal,
        p_completion_key: input.completionKey,
        p_reason: input.reason,
        p_confirmed: input.confirmed,
      })
      if (error) mapRpcError(error)
      return parseCleanup(data)
    },
  }
}
