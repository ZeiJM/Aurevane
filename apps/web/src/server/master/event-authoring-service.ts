import 'server-only'

import {
  validatePersistentEventDefinition,
  type PersistentEventDefinition,
} from '@aurevane/game-core/events/persistent-event'
import { AurevaneError } from '@aurevane/game-core/errors'

import type { MasterPanelAccess, MasterPanelStaffAccessService } from './staff-access'
import { hasMasterPanelCapability } from './staff-access'

export interface EventDefinitionDraftRecord {
  readonly eventKey: string
  readonly definition: PersistentEventDefinition
  readonly baseVersion: number | null
  readonly draftVersion: number
  readonly updatedBy: string
  readonly updatedAt: string
}

export interface EventDefinitionVersionRecord {
  readonly id: string
  readonly eventKey: string
  readonly definitionVersion: number
  readonly definition: PersistentEventDefinition
  readonly publishedBy: string
  readonly publishedAt: string
  readonly current?: boolean
}

export interface ScheduledEventRunRecord {
  readonly runId: string
  readonly stateVersion: number
  readonly replayed: boolean
}

export interface EventRunTransitionRecord {
  readonly runId: string
  readonly lifecycleStatus: string
  readonly stateVersion: number
  readonly replayed: boolean
}

export interface EventDefinitionValidationIssue {
  readonly path: string
  readonly code: string
  readonly message: string
}

export interface EventDefinitionValidationResult {
  readonly valid: boolean
  readonly issues: readonly EventDefinitionValidationIssue[]
}

export interface EventDefinitionPreview {
  readonly testClock: string
  readonly eventKey: string
  readonly title: string
  readonly family: string
  readonly scope: PersistentEventDefinition['scope']
  readonly phaseCount: number
  readonly selectedPhase: {
    readonly id: string
    readonly name: string
    readonly objectiveCount: number
    readonly effectCount: number
    readonly cleanupEffectCount: number
    readonly transitionType: string
  }
  readonly rewardPackageRefs: readonly string[]
  readonly aftermathRefs: readonly string[]
}

export interface EventAuthoringStore {
  readDraft(eventKey: string): Promise<EventDefinitionDraftRecord | null>
  saveDraft(input: {
    eventKey: string
    definition: PersistentEventDefinition
    baseVersion: number | null
    expectedDraftVersion: number | null
  }): Promise<EventDefinitionDraftRecord>
  readCurrent(eventKey: string): Promise<EventDefinitionVersionRecord | null>
  listVersions(eventKey: string): Promise<readonly EventDefinitionVersionRecord[]>
  publish(input: {
    eventKey: string
    definition: PersistentEventDefinition
    expectedBaseVersion: number | null
    correlationKey: string
    reason: string
    confirmed: boolean
  }): Promise<EventDefinitionVersionRecord>
  schedule(input: {
    eventKey: string
    idempotencyKey: string
    requestFingerprint: string
    scheduledStartAt: string
    scheduledEndAt: string | null
    reason: string
    confirmed: boolean
  }): Promise<ScheduledEventRunRecord>
  cancelScheduled(input: {
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    reason: string
    confirmed: boolean
  }): Promise<EventRunTransitionRecord>
}

export interface EventAuthoringService {
  requireAuthor(actorUserId: string): Promise<MasterPanelAccess>
  validateDefinition(definition: unknown): EventDefinitionValidationResult
  previewDefinition(input: {
    actorUserId: string
    definition: unknown
    phaseId?: string
    testClock?: string
  }): Promise<EventDefinitionPreview>
  loadWorkspace(input: {
    actorUserId: string
    eventKey: string
  }): Promise<{
    draft: EventDefinitionDraftRecord | null
    current: EventDefinitionVersionRecord | null
    versions: readonly EventDefinitionVersionRecord[]
  }>
  saveDraft(input: {
    actorUserId: string
    definition: unknown
    baseVersion: number | null
    expectedDraftVersion: number | null
  }): Promise<EventDefinitionDraftRecord>
  publish(input: {
    actorUserId: string
    definition: unknown
    expectedBaseVersion: number | null
    correlationKey: string
    reason: string
    confirmed: boolean
  }): Promise<EventDefinitionVersionRecord>
  schedule(input: {
    actorUserId: string
    eventKey: string
    idempotencyKey: string
    requestFingerprint: string
    scheduledStartAt: string
    scheduledEndAt: string | null
    reason: string
    confirmed: boolean
  }): Promise<ScheduledEventRunRecord>
  cancelScheduled(input: {
    actorUserId: string
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    reason: string
    confirmed: boolean
  }): Promise<EventRunTransitionRecord>
}

interface Dependencies {
  store: EventAuthoringStore
  staffAccess: MasterPanelStaffAccessService
}

const FORBIDDEN_EVENT_FIELDS = new Set(['script', 'sql', 'rawSql', 'sourceCode', 'handler'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function forbiddenIssues(
  value: unknown,
  path = '$',
  seen = new WeakSet<object>(),
): EventDefinitionValidationIssue[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => forbiddenIssues(entry, `${path}[${index}]`, seen))
  }
  if (!isRecord(value) || seen.has(value)) return []
  seen.add(value)

  const issues: EventDefinitionValidationIssue[] = []
  for (const [key, nested] of Object.entries(value)) {
    const next = path === '$' ? key : `${path}.${key}`
    if (FORBIDDEN_EVENT_FIELDS.has(key)) {
      issues.push({
        path: next,
        code: 'ARBITRARY_EXECUTION_FIELD',
        message: 'Event definitions cannot contain arbitrary script, SQL, handler or source-code fields.',
      })
    }
    issues.push(...forbiddenIssues(nested, next, seen))
  }
  return issues
}

function validateDefinition(definition: unknown): EventDefinitionValidationResult {
  const issues = forbiddenIssues(definition)
  if (!isRecord(definition)) {
    issues.push({
      path: '$',
      code: 'INVALID_DEFINITION_SHAPE',
      message: 'Event content must be a typed object definition.',
    })
    return { valid: false, issues }
  }

  if (issues.length === 0) {
    try {
      validatePersistentEventDefinition(
        structuredClone(definition) as unknown as PersistentEventDefinition,
      )
    } catch (error) {
      issues.push({
        path: '$',
        code: 'INVALID_EVENT_DEFINITION',
        message: error instanceof Error ? error.message : 'Event definition is invalid.',
      })
    }
  }

  return { valid: issues.length === 0, issues }
}

function assertValidDefinition(definition: unknown): asserts definition is PersistentEventDefinition {
  const validation = validateDefinition(definition)
  if (!validation.valid) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      validation.issues[0]?.message ?? 'Event definition is invalid.',
    )
  }
}

function requireCapability(
  access: MasterPanelAccess,
  capability: Parameters<typeof hasMasterPanelCapability>[1],
): void {
  if (!hasMasterPanelCapability(access, capability)) {
    throw new AurevaneError('FORBIDDEN', 'This Event operation is not available to this account.')
  }
}

function stableIdentity(value: string, field: string): string {
  if (!/^[a-z0-9][a-z0-9._:-]{1,159}$/.test(value)) {
    throw new AurevaneError('INVALID_REQUEST', `${field} is not a stable identity.`)
  }
  return value
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AurevaneError('INVALID_REQUEST', `${field} must be a positive integer.`)
  }
  return value
}

function requiredReason(value: string): string {
  if (value.trim() !== value || value.length < 3 || value.length > 240) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Event operation reasons must be 3–240 characters with no outer whitespace.',
    )
  }
  return value
}

function requiredConfirmation(value: boolean): true {
  if (value !== true) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      'Confirm this Production Event action before continuing.',
    )
  }
  return true
}

function requiredUuid(value: string, field: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AurevaneError('INVALID_REQUEST', `${field} must be a UUID.`)
  }
  return value
}

function validTimestamp(value: string, field: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new AurevaneError('INVALID_REQUEST', `${field} must be an ISO timestamp.`)
  }
  return value
}

export function createEventAuthoringService({
  store,
  staffAccess,
}: Dependencies): EventAuthoringService {
  async function requireAuthor(actorUserId: string): Promise<MasterPanelAccess> {
    return staffAccess.requireCapability(actorUserId, 'events.author')
  }

  return {
    requireAuthor,
    validateDefinition,

    async previewDefinition(input) {
      await requireAuthor(input.actorUserId)
      assertValidDefinition(input.definition)
      const definition = structuredClone(input.definition)
      const phase =
        (input.phaseId
          ? definition.phases.find((candidate) => candidate.id === input.phaseId)
          : definition.phases[0]) ?? null

      if (!phase) {
        throw new AurevaneError('INVALID_REQUEST', 'Preview phase was not found in this Event.')
      }

      const testClock = input.testClock
        ? validTimestamp(input.testClock, 'testClock')
        : new Date(0).toISOString()

      return {
        testClock,
        eventKey: definition.eventKey,
        title: definition.title,
        family: definition.family,
        scope: definition.scope,
        phaseCount: definition.phases.length,
        selectedPhase: {
          id: phase.id,
          name: phase.name,
          objectiveCount: phase.objectives.length,
          effectCount: phase.effects.length,
          cleanupEffectCount: phase.cleanupEffects.length,
          transitionType: phase.transition.type,
        },
        rewardPackageRefs: [...definition.rewardPackageRefs],
        aftermathRefs: [...definition.aftermathRefs],
      }
    },

    async loadWorkspace(input) {
      await requireAuthor(input.actorUserId)
      const eventKey = stableIdentity(input.eventKey, 'eventKey')
      const [draft, current, versions] = await Promise.all([
        store.readDraft(eventKey),
        store.readCurrent(eventKey),
        store.listVersions(eventKey),
      ])
      return { draft, current, versions }
    },

    async saveDraft(input) {
      await requireAuthor(input.actorUserId)
      assertValidDefinition(input.definition)
      return store.saveDraft({
        eventKey: input.definition.eventKey,
        definition: structuredClone(input.definition),
        baseVersion: input.baseVersion,
        expectedDraftVersion: input.expectedDraftVersion,
      })
    },

    async publish(input) {
      const access = await requireAuthor(input.actorUserId)
      requireCapability(access, 'events.production_publish')
      assertValidDefinition(input.definition)
      if (input.definition.scope.type === 'global') {
        requireCapability(access, 'events.global_scope')
      }
      return store.publish({
        eventKey: input.definition.eventKey,
        definition: structuredClone(input.definition),
        expectedBaseVersion: input.expectedBaseVersion,
        correlationKey: requiredUuid(input.correlationKey, 'correlationKey'),
        reason: requiredReason(input.reason),
        confirmed: requiredConfirmation(input.confirmed),
      })
    },

    async schedule(input) {
      const access = await staffAccess.requireCapability(input.actorUserId, 'events.operate')
      stableIdentity(input.eventKey, 'eventKey')
      requiredUuid(input.idempotencyKey, 'idempotencyKey')
      if (!input.requestFingerprint || input.requestFingerprint.length > 160) {
        throw new AurevaneError('INVALID_REQUEST', 'requestFingerprint must be 1–160 characters.')
      }
      const start = validTimestamp(input.scheduledStartAt, 'scheduledStartAt')
      const end = input.scheduledEndAt
        ? validTimestamp(input.scheduledEndAt, 'scheduledEndAt')
        : null
      if (end && Date.parse(end) <= Date.parse(start)) {
        throw new AurevaneError('INVALID_REQUEST', 'scheduledEndAt must be after scheduledStartAt.')
      }

      const current = await store.readCurrent(input.eventKey)
      if (!current) {
        throw new AurevaneError('INVALID_REQUEST', 'Publish this Event before scheduling it.')
      }
      if (current.definition.scope.type === 'global') {
        requireCapability(access, 'events.global_scope')
      }

      return store.schedule({
        eventKey: input.eventKey,
        idempotencyKey: input.idempotencyKey,
        requestFingerprint: input.requestFingerprint,
        scheduledStartAt: start,
        scheduledEndAt: end,
        reason: requiredReason(input.reason),
        confirmed: requiredConfirmation(input.confirmed),
      })
    },

    async cancelScheduled(input) {
      await staffAccess.requireCapability(input.actorUserId, 'events.operate')
      positiveInteger(input.expectedStateVersion, 'expectedStateVersion')
      return store.cancelScheduled({
        runId: requiredUuid(input.runId, 'runId'),
        expectedStateVersion: input.expectedStateVersion,
        idempotencyKey: requiredUuid(input.idempotencyKey, 'idempotencyKey'),
        reason: requiredReason(input.reason),
        confirmed: requiredConfirmation(input.confirmed),
      })
    },
  }
}
