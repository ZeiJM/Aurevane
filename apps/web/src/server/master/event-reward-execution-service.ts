import 'server-only'

import { createHash } from 'node:crypto'

import type { ProgressionRepository } from '@aurevane/db/progression'
import {
  validateEventRewardPackageDefinition,
  type EventRewardPackageDefinition,
} from '@aurevane/game-core/events/event-reward'
import { AurevaneError } from '@aurevane/game-core/errors'

import {
  CHARACTER_XP_GRANT_PERMISSION,
  grantCharacterXp,
  type GrantCharacterXpOutcome,
} from '@/server/progression/progression-service'

export interface EventRewardClaimExecutionPlan {
  readonly reservationId: string
  readonly runId: string
  readonly characterId: string
  readonly userId: string
  readonly rewardPackageRef: string
  readonly packageDefinition: unknown
  readonly claimedAt: string | null
  readonly executionReceiptId: string | null
  readonly executionAppliedAmount: number | null
}

export interface EventRewardClaimExecutionRecord {
  readonly claimedAt: string
  readonly replayed: boolean
}

export interface EventRewardExecutionStore {
  prepareClaimExecution(reservationId: string): Promise<EventRewardClaimExecutionPlan>
  recordClaimExecution(input: {
    reservationId: string
    rewardOrdinal: number
    rewardType: 'character-xp'
    receiptId: string
    appliedAmount: number
  }): Promise<EventRewardClaimExecutionRecord>
}

export interface ExecuteEventRewardClaimOutcome {
  readonly reservationId: string
  readonly rewardPackageRef: string
  readonly progressionGrantId: string
  readonly appliedAmount: number
  readonly claimedAt: string
  readonly replayed: boolean
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function executeEventRewardClaim(
  reservationId: string,
  store: EventRewardExecutionStore,
  progressionRepository: ProgressionRepository,
): Promise<ExecuteEventRewardClaimOutcome> {
  if (!uuidPattern.test(reservationId)) {
    throw new AurevaneError('INVALID_REQUEST', 'Event reward reservation id was not valid.')
  }

  const plan = await store.prepareClaimExecution(reservationId)
  const definition = validatePlan(plan)

  if (
    plan.claimedAt !== null &&
    plan.executionReceiptId !== null &&
    plan.executionAppliedAmount !== null
  ) {
    return {
      reservationId: plan.reservationId,
      rewardPackageRef: plan.rewardPackageRef,
      progressionGrantId: plan.executionReceiptId,
      appliedAmount: plan.executionAppliedAmount,
      claimedAt: plan.claimedAt,
      replayed: true,
    }
  }

  if (
    plan.claimedAt !== null ||
    plan.executionReceiptId !== null ||
    plan.executionAppliedAmount !== null
  ) {
    throw unavailable()
  }

  const reward = definition.rewards[0]
  const grant = await grantCharacterXp(
    {
      authority: {
        actorKey: `event-reward:${plan.runId}`,
        permissions: [CHARACTER_XP_GRANT_PERMISSION],
      },
      characterId: plan.characterId,
      idempotencyKey: deterministicRewardUuid(plan.reservationId, 0),
      sourceKind: 'gameplay',
      sourceId: `event-reward.${plan.reservationId}.0`,
      reasonTag: 'event.reward.character-xp',
      amount: reward.amount,
    },
    progressionRepository,
  )

  return recordExecution(plan, grant, store)
}

function validatePlan(plan: EventRewardClaimExecutionPlan): EventRewardPackageDefinition {
  if (
    !uuidPattern.test(plan.reservationId) ||
    !uuidPattern.test(plan.runId) ||
    !uuidPattern.test(plan.characterId) ||
    !uuidPattern.test(plan.userId)
  ) {
    throw unavailable()
  }

  let definition: EventRewardPackageDefinition
  try {
    definition = validateEventRewardPackageDefinition(plan.packageDefinition)
  } catch {
    throw unavailable()
  }

  if (definition.rewardPackageRef !== plan.rewardPackageRef) {
    throw unavailable()
  }
  return definition
}

async function recordExecution(
  plan: EventRewardClaimExecutionPlan,
  grant: GrantCharacterXpOutcome,
  store: EventRewardExecutionStore,
): Promise<ExecuteEventRewardClaimOutcome> {
  const recorded = await store.recordClaimExecution({
    reservationId: plan.reservationId,
    rewardOrdinal: 0,
    rewardType: 'character-xp',
    receiptId: grant.grant.grantId,
    appliedAmount: grant.grant.appliedAmount,
  })

  return {
    reservationId: plan.reservationId,
    rewardPackageRef: plan.rewardPackageRef,
    progressionGrantId: grant.grant.grantId,
    appliedAmount: grant.grant.appliedAmount,
    claimedAt: recorded.claimedAt,
    replayed: grant.replayed || recorded.replayed,
  }
}

function deterministicRewardUuid(reservationId: string, ordinal: number): string {
  const digest = createHash('sha256')
    .update(`aurevane:event-reward:${reservationId}:${ordinal}`)
    .digest('hex')
    .slice(0, 32)
    .split('')

  digest[12] = '5'
  digest[16] = '8'

  const value = digest.join('')
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    value.slice(12, 16),
    value.slice(16, 20),
    value.slice(20, 32),
  ].join('-')
}

function unavailable(): AurevaneError {
  return new AurevaneError(
    'PERSISTENCE_UNAVAILABLE',
    'Event reward execution is unavailable right now.',
  )
}
