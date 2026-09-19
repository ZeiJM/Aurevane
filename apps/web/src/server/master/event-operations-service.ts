import 'server-only'

import { AurevaneError } from '@aurevane/game-core/errors'

import type { MasterPanelAccess, MasterPanelStaffAccessService } from './staff-access'

export const EVENT_OPERATION_COMMANDS = [
  'start',
  'pause',
  'resume',
  'stop',
  'end',
  'archive',
  'emergency-stop',
] as const

export type EventOperationCommand = (typeof EVENT_OPERATION_COMMANDS)[number]

export interface EventOperationRunSummary {
  readonly runId: string
  readonly eventKey: string
  readonly lifecycleStatus: string
  readonly stateVersion: number
  readonly scopeType: string
  readonly scopeKey: string | null
  readonly currentPhaseId: string | null
  readonly scheduledStartAt: string | null
  readonly scheduledEndAt: string | null
  readonly startedAt: string | null
  readonly cleanupStatus: string
  readonly updatedAt: string
}

export interface EventOperationDashboard {
  readonly run: {
    readonly runId: string
    readonly eventKey: string
    readonly definitionVersionId: string
    readonly lifecycleStatus: string
    readonly stateVersion: number
    readonly scopeType: string
    readonly scopeKey: string | null
    readonly currentPhaseId: string | null
    readonly scheduledStartAt: string | null
    readonly scheduledEndAt: string | null
    readonly startedAt: string | null
    readonly pausedAt: string | null
    readonly resolvingAt: string | null
    readonly endedAt: string | null
    readonly archivedAt: string | null
    readonly cancelledAt: string | null
    readonly emergencyStoppedAt: string | null
    readonly cleanupStatus: string
    readonly cleanupRequiredAt: string | null
    readonly cleanupCompletedAt: string | null
    readonly updatedAt: string
  }
  readonly activeEffects: readonly unknown[]
  readonly phases: readonly {
    readonly phaseId: string
    readonly ordinal: number
    readonly status: string
    readonly startedAt: string | null
    readonly completedAt: string | null
    readonly stateVersion: number
    readonly objectives: readonly {
      readonly objectiveId: string
      readonly status: string
      readonly progress: number
      readonly target: number
      readonly stateVersion: number
      readonly updatedAt: string
    }[]
  }[]
  readonly participants: readonly {
    readonly characterId: string
    readonly userId: string
    readonly firstParticipatedAt: string
    readonly lastContributedAt: string | null
    readonly contributionCount: number
    readonly contributionTotal: number
  }[]
  readonly claims: readonly {
    readonly reservationId: string
    readonly characterId: string
    readonly rewardPackageRef: string
    readonly reservedAt: string
    readonly executed: boolean
    readonly executedAt: string | null
    readonly appliedAmount: number | null
  }[]
  readonly cleanupRequirements: readonly {
    readonly phaseId: string
    readonly effectOrdinal: number
    readonly effectType: string
    readonly referenceKey: string
    readonly enabled: boolean
    readonly status: string
    readonly completedAt: string | null
    readonly completion: unknown | null
  }[]
  readonly chronicle: Record<string, unknown> | null
}

export interface EventRunMutationRecord {
  readonly runId: string
  readonly lifecycleStatus: string
  readonly stateVersion: number
  readonly replayed: boolean
}

export interface EventPhaseAdvanceRecord {
  readonly runId: string
  readonly currentPhaseId: string
  readonly stateVersion: number
  readonly replayed: boolean
}

export interface EventCleanupCompletionRecord {
  readonly runId: string
  readonly cleanupStatus: string
  readonly stateVersion: number
  readonly replayed: boolean
}

export interface EventOperationsStore {
  listRuns(actorUserId: string): Promise<readonly EventOperationRunSummary[]>
  readDashboard(actorUserId: string, runId: string): Promise<EventOperationDashboard>
  operate(input: {
    actorUserId: string
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    command: EventOperationCommand
    reason: string
  }): Promise<EventRunMutationRecord>
  advancePhase(input: {
    actorUserId: string
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    reason: string
  }): Promise<EventPhaseAdvanceRecord>
  completeCleanup(input: {
    actorUserId: string
    runId: string
    phaseId: string
    effectOrdinal: number
    completionKey: string
    note: string
  }): Promise<EventCleanupCompletionRecord>
}

export interface EventOperationsService {
  requireOperator(actorUserId: string): Promise<MasterPanelAccess>
  listRuns(actorUserId: string): Promise<readonly EventOperationRunSummary[]>
  readDashboard(actorUserId: string, runId: string): Promise<EventOperationDashboard>
  operate(input: {
    actorUserId: string
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    command: EventOperationCommand
    reason: string
  }): Promise<EventRunMutationRecord>
  advancePhase(input: {
    actorUserId: string
    runId: string
    expectedStateVersion: number
    idempotencyKey: string
    reason: string
  }): Promise<EventPhaseAdvanceRecord>
  completeCleanup(input: {
    actorUserId: string
    runId: string
    phaseId: string
    effectOrdinal: number
    completionKey: string
    note: string
  }): Promise<EventCleanupCompletionRecord>
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uuid(value: string, field: string): string {
  if (!uuidPattern.test(value)) {
    throw new AurevaneError('INVALID_REQUEST', `${field} must be a UUID.`)
  }
  return value
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AurevaneError('INVALID_REQUEST', `${field} must be a positive integer.`)
  }
  return value
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AurevaneError('INVALID_REQUEST', `${field} must be a non-negative integer.`)
  }
  return value
}

function reason(value: string, field: string): string {
  if (value.trim() !== value || value.length < 3 || value.length > 240) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      `${field} must be 3–240 characters with no outer whitespace.`,
    )
  }
  return value
}

function command(value: string): EventOperationCommand {
  if (!(EVENT_OPERATION_COMMANDS as readonly string[]).includes(value)) {
    throw new AurevaneError('INVALID_REQUEST', 'Unsupported Event operations command.')
  }
  return value as EventOperationCommand
}

export function createEventOperationsService(input: {
  store: EventOperationsStore
  staffAccess: MasterPanelStaffAccessService
}): EventOperationsService {
  const { store, staffAccess } = input

  async function requireOperator(actorUserId: string): Promise<MasterPanelAccess> {
    return staffAccess.requireCapability(actorUserId, 'events.operate')
  }

  return {
    requireOperator,

    async listRuns(actorUserId) {
      await requireOperator(actorUserId)
      return store.listRuns(actorUserId)
    },

    async readDashboard(actorUserId, runId) {
      await requireOperator(actorUserId)
      return store.readDashboard(actorUserId, uuid(runId, 'runId'))
    },

    async operate(operation) {
      const access = await requireOperator(operation.actorUserId)
      const operationCommand = command(operation.command)
      if (operationCommand === 'emergency-stop') {
        await staffAccess.requireCapability(operation.actorUserId, 'events.emergency_stop')
      }
      return store.operate({
        actorUserId: operation.actorUserId,
        runId: uuid(operation.runId, 'runId'),
        expectedStateVersion: positiveInteger(
          operation.expectedStateVersion,
          'expectedStateVersion',
        ),
        idempotencyKey: uuid(operation.idempotencyKey, 'idempotencyKey'),
        command: operationCommand,
        reason: reason(operation.reason, 'reason'),
      })
    },

    async advancePhase(operation) {
      await requireOperator(operation.actorUserId)
      return store.advancePhase({
        actorUserId: operation.actorUserId,
        runId: uuid(operation.runId, 'runId'),
        expectedStateVersion: positiveInteger(
          operation.expectedStateVersion,
          'expectedStateVersion',
        ),
        idempotencyKey: uuid(operation.idempotencyKey, 'idempotencyKey'),
        reason: reason(operation.reason, 'reason'),
      })
    },

    async completeCleanup(operation) {
      await requireOperator(operation.actorUserId)
      if (
        !operation.phaseId ||
        operation.phaseId.trim() !== operation.phaseId ||
        operation.phaseId.length > 160
      ) {
        throw new AurevaneError('INVALID_REQUEST', 'phaseId was not valid.')
      }
      return store.completeCleanup({
        actorUserId: operation.actorUserId,
        runId: uuid(operation.runId, 'runId'),
        phaseId: operation.phaseId,
        effectOrdinal: nonNegativeInteger(operation.effectOrdinal, 'effectOrdinal'),
        completionKey: uuid(operation.completionKey, 'completionKey'),
        note: reason(operation.note, 'note'),
      })
    },
  }
}
