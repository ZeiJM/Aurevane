import 'server-only'

import type { PersistentEventDefinition } from '@aurevane/game-core/events/persistent-event'
import { AurevaneError } from '@aurevane/game-core/errors'

import { createSupabaseAdminClient } from '@/lib/supabase/admin'

import type {
  EventAuthoringStore,
  EventDefinitionDraftRecord,
  EventDefinitionVersionRecord,
  EventRunTransitionRecord,
  ScheduledEventRunRecord,
} from './event-authoring-service'

type RpcError = { readonly code?: string; readonly message?: string }
type RpcResult = { readonly data: unknown; readonly error: RpcError | null }
export type EventAuthoringRpc = (
  functionName: string,
  parameters: Readonly<Record<string, unknown>>,
) => PromiseLike<RpcResult>

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function oneRow(data: unknown): JsonObject | null {
  if (data === null || (Array.isArray(data) && data.length === 0)) return null
  return Array.isArray(data) && data.length === 1 && isObject(data[0]) ? data[0] : null
}

function positiveInteger(value: unknown): number | null {
  const parsed =
    typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : (value as number)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.trim() === value ? value : null
}

function definition(value: unknown): PersistentEventDefinition | null {
  return isObject(value) ? (structuredClone(value) as unknown as PersistentEventDefinition) : null
}

function parseDraft(data: unknown): EventDefinitionDraftRecord | null {
  const row = oneRow(data)
  if (!row) return null
  const parsed = definition(row.definition)
  const draftVersion = positiveInteger(row.draft_version)
  const baseVersion = row.base_version === null ? null : positiveInteger(row.base_version)
  const eventKey = requiredString(row.event_key)
  const updatedBy = requiredString(row.updated_by)
  const updatedAt = requiredString(row.updated_at)
  if (
    !eventKey ||
    !parsed ||
    !draftVersion ||
    (row.base_version !== null && !baseVersion) ||
    !updatedBy ||
    !updatedAt
  ) {
    throw unavailable('The server returned an invalid Event draft.')
  }
  return {
    eventKey,
    definition: parsed,
    baseVersion,
    draftVersion,
    updatedBy,
    updatedAt,
  }
}

function parseVersionRow(row: unknown): EventDefinitionVersionRecord | null {
  if (!isObject(row)) return null
  const id = requiredString(row.id)
  const eventKey = requiredString(row.event_key)
  const definitionVersion = positiveInteger(row.definition_version)
  const parsed = definition(row.definition)
  const publishedBy = requiredString(row.published_by)
  const publishedAt = requiredString(row.published_at)
  if (!id || !eventKey || !definitionVersion || !parsed || !publishedBy || !publishedAt) {
    return null
  }
  return {
    id,
    eventKey,
    definitionVersion,
    definition: parsed,
    publishedBy,
    publishedAt,
    ...(typeof row.current === 'boolean' ? { current: row.current } : {}),
  }
}

function parseVersion(data: unknown): EventDefinitionVersionRecord | null {
  const row = oneRow(data)
  if (!row) return null
  const parsed = parseVersionRow(row)
  if (!parsed) throw unavailable('The server returned an invalid Event version.')
  return parsed
}

function parseVersions(data: unknown): readonly EventDefinitionVersionRecord[] {
  if (!Array.isArray(data)) throw unavailable('The server returned invalid Event history.')
  const parsed = data.map(parseVersionRow)
  if (parsed.some((entry) => entry === null)) {
    throw unavailable('The server returned invalid Event history.')
  }
  return parsed as EventDefinitionVersionRecord[]
}

function parseSchedule(data: unknown): ScheduledEventRunRecord {
  const row = oneRow(data)
  if (!row) throw unavailable('The server did not return the scheduled Event Run.')
  const runId = requiredString(row.run_id)
  const stateVersion = positiveInteger(row.state_version)
  if (!runId || !stateVersion || typeof row.replayed !== 'boolean') {
    throw unavailable('The server returned an invalid scheduled Event Run.')
  }
  return { runId, stateVersion, replayed: row.replayed }
}

function parseTransition(data: unknown): EventRunTransitionRecord {
  const row = oneRow(data)
  if (!row) throw unavailable('The server did not return the Event transition.')
  const runId = requiredString(row.run_id)
  const lifecycleStatus = requiredString(row.lifecycle_status)
  const stateVersion = positiveInteger(row.state_version)
  if (!runId || !lifecycleStatus || !stateVersion || typeof row.replayed !== 'boolean') {
    throw unavailable('The server returned an invalid Event transition.')
  }
  return { runId, lifecycleStatus, stateVersion, replayed: row.replayed }
}

function unavailable(message = 'Event Builder persistence is unavailable right now.'): AurevaneError {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', message)
}

function mapRpcError(error: RpcError): never {
  const message = error.message ?? ''
  if (
    error.code === '40001' ||
    message.includes('EVENT_DRAFT_BASE_VERSION_CONFLICT') ||
    message.includes('EVENT_DRAFT_VERSION_CONFLICT') ||
    message.includes('EVENT_PUBLISH_BASE_VERSION_CONFLICT')
  ) {
    throw new AurevaneError('STALE_VERSION', 'Event content changed. Refresh and retry.', {
      cause: error,
    })
  }
  if (error.code === '42501') {
    throw new AurevaneError('FORBIDDEN', 'This Event operation is not available to this account.', {
      cause: error,
    })
  }
  if (message.includes('EVENT_AUTHORING_IDEMPOTENCY_CONFLICT')) {
    throw new AurevaneError(
      'IDEMPOTENCY_CONFLICT',
      'That Event action key was already used for a different Production request.',
      { cause: error },
    )
  }
  if (
    error.code === '22023' ||
    message.includes('EVENT_DEFINITION_') ||
    message.includes('EVENT_ACTION_') ||
    message.includes('EVENT_REWARD_PACKAGE_DEPENDENCY_MISSING') ||
    message.includes('EVENT_SCHEDULE_') ||
    message.includes('EVENT_PUBLICATION_REQUIRED')
  ) {
    throw new AurevaneError('INVALID_REQUEST', message || 'Event request was invalid.', {
      cause: error,
    })
  }
  throw unavailable()
}

export class RpcEventAuthoringStore implements EventAuthoringStore {
  readonly #rpc: EventAuthoringRpc
  readonly #actorUserId: string

  constructor(rpc: EventAuthoringRpc, actorUserId: string) {
    this.#rpc = rpc
    this.#actorUserId = actorUserId
  }

  async readDraft(eventKey: string): Promise<EventDefinitionDraftRecord | null> {
    const { data, error } = await this.#rpc('read_event_definition_draft_v1', {
      p_actor_user_id: this.#actorUserId,
      p_event_key: eventKey,
    })
    if (error) mapRpcError(error)
    return parseDraft(data)
  }

  async saveDraft(input: {
    eventKey: string
    definition: PersistentEventDefinition
    baseVersion: number | null
    expectedDraftVersion: number | null
  }): Promise<EventDefinitionDraftRecord> {
    const { data, error } = await this.#rpc('save_event_definition_draft_v1', {
      p_actor_user_id: this.#actorUserId,
      p_event_key: input.eventKey,
      p_definition: input.definition,
      p_base_version: input.baseVersion,
      p_expected_draft_version: input.expectedDraftVersion,
    })
    if (error) mapRpcError(error)
    const parsed = parseDraft(data)
    if (!parsed) throw unavailable('The server did not return the saved Event draft.')
    return parsed
  }

  async readCurrent(eventKey: string): Promise<EventDefinitionVersionRecord | null> {
    const { data, error } = await this.#rpc('read_current_event_definition_v1', {
      p_event_key: eventKey,
    })
    if (error) mapRpcError(error)
    return parseVersion(data)
  }

  async listVersions(eventKey: string): Promise<readonly EventDefinitionVersionRecord[]> {
    const { data, error } = await this.#rpc('list_event_definition_versions_v1', {
      p_actor_user_id: this.#actorUserId,
      p_event_key: eventKey,
    })
    if (error) mapRpcError(error)
    return parseVersions(data)
  }

  async publish(input: {
    eventKey: string
    definition: PersistentEventDefinition
    expectedBaseVersion: number | null
    correlationKey: string
    reason: string
    confirmed: boolean
  }): Promise<EventDefinitionVersionRecord> {
    const { data, error } = await this.#rpc('publish_event_definition_v2', {
      p_actor_user_id: this.#actorUserId,
      p_event_key: input.eventKey,
      p_definition: input.definition,
      p_expected_base_version: input.expectedBaseVersion,
      p_correlation_key: input.correlationKey,
      p_reason: input.reason,
      p_confirmed: input.confirmed,
    })
    if (error) mapRpcError(error)
    const parsed = parseVersion(data)
    if (!parsed) throw unavailable('The server did not return the published Event version.')
    return parsed
  }

  async schedule(input: {
    eventKey: string
    idempotencyKey: string
    requestFingerprint: string
    scheduledStartAt: string
    scheduledEndAt: string | null
    reason: string
    confirmed: boolean
  }): Promise<ScheduledEventRunRecord> {
    const { data, error } = await this.#rpc('schedule_event_run_v2', {
      p_actor_user_id: this.#actorUserId,
      p_event_key: input.eventKey,
      p_idempotency_key: input.idempotencyKey,
      p_request_fingerprint: input.requestFingerprint,
      p_scheduled_start_at: input.scheduledStartAt,
      p_scheduled_end_at: input.scheduledEndAt,
      p_reason: input.reason,
      p_confirmed: input.confirmed,
    })
    if (error) mapRpcError(error)
    return parseSchedule(data)
  }

  async cancelScheduled(input: {
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    reason: string
    confirmed: boolean
  }): Promise<EventRunTransitionRecord> {
    const { data, error } = await this.#rpc('cancel_scheduled_event_run_v2', {
      p_actor_user_id: this.#actorUserId,
      p_run_id: input.runId,
      p_expected_state_version: input.expectedStateVersion,
      p_idempotency_key: input.idempotencyKey,
      p_reason: input.reason,
      p_confirmed: input.confirmed,
    })
    if (error) mapRpcError(error)
    return parseTransition(data)
  }
}

export function createSupabaseEventAuthoringStore(actorUserId: string): RpcEventAuthoringStore {
  const client = createSupabaseAdminClient()
  return new RpcEventAuthoringStore(
    (functionName, parameters) =>
      client.rpc(functionName, parameters) as unknown as PromiseLike<RpcResult>,
    actorUserId,
  )
}
