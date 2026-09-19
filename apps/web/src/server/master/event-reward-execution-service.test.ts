import { describe, expect, it, vi } from 'vitest'

import type { ProgressionRepository } from '@aurevane/db/progression'

import {
  executeEventRewardClaim,
  type EventRewardExecutionStore,
} from './event-reward-execution-service'

const reservationId = '00000000-0000-4000-8000-000000004121'
const runId = '00000000-0000-4000-8000-000000004122'
const characterId = '00000000-0000-4000-8000-000000004123'
const userId = '00000000-0000-4000-8000-000000004124'
const grantId = '00000000-0000-4000-8000-000000004125'

function plan() {
  return {
    reservationId,
    runId,
    characterId,
    userId,
    rewardPackageRef: 'reward.world-crisis.participation.v1',
    packageDefinition: {
      schemaVersion: 1,
      rewardPackageRef: 'reward.world-crisis.participation.v1',
      packageVersion: 1,
      budgetRef: 'budget.event-xp.standard',
      rewards: [{ type: 'character-xp', amount: 75 }],
    },
    claimedAt: null,
    executionReceiptId: null,
    executionAppliedAmount: null,
  }
}

function progressionRepository(replayed = false): ProgressionRepository {
  return {
    loadCurveForCycle: vi.fn(async () => ({
      version: 1,
      maxLevel: 100,
      cumulativeXpByLevel: [0],
    })),
    grantCharacterXp: vi.fn(async (input) => ({
      replayed,
      result: {
        grantId,
        characterId: input.characterId,
        progressionCycle: 1,
        curveVersion: 1,
        authorityKey: input.authorityKey,
        sourceKind: input.sourceKind,
        sourceId: input.sourceId,
        reasonTag: input.reasonTag,
        requestedAmount: input.amount,
        appliedAmount: input.amount,
        xpBefore: 0,
        xpAfter: input.amount,
        levelBefore: 1,
        levelAfter: 1,
        reachedLevel: null,
        secondsSinceCycleStart: 10,
        createdAt: '2026-09-19T04:45:00.000Z',
      },
    })),
  }
}

describe('event reward execution service', () => {
  it('delegates character XP through the normal progression service and records the receipt', async () => {
    const recordClaimExecution = vi.fn(async () => ({
      claimedAt: '2026-09-19T04:46:00.000Z',
      replayed: false,
    }))
    const store: EventRewardExecutionStore = {
      prepareClaimExecution: vi.fn(async () => plan()),
      recordClaimExecution,
    }
    const repository = progressionRepository()

    const outcome = await executeEventRewardClaim(reservationId, store, repository)

    expect(repository.grantCharacterXp).toHaveBeenCalledTimes(1)
    expect(repository.grantCharacterXp).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId,
        authorityKey: `event-reward:${runId}`,
        sourceKind: 'gameplay',
        sourceId: `event-reward.${reservationId}.0`,
        reasonTag: 'event.reward.character-xp',
        amount: 75,
      }),
    )
    expect(recordClaimExecution).toHaveBeenCalledWith({
      reservationId,
      rewardOrdinal: 0,
      rewardType: 'character-xp',
      receiptId: grantId,
      appliedAmount: 75,
    })
    expect(outcome).toMatchObject({
      reservationId,
      progressionGrantId: grantId,
      appliedAmount: 75,
      replayed: false,
    })
  })

  it('uses the same deterministic progression idempotency key across retries', async () => {
    const keys: string[] = []
    const repository = progressionRepository(true)
    const originalGrant = repository.grantCharacterXp
    repository.grantCharacterXp = vi.fn(async (input) => {
      keys.push(input.idempotencyKey)
      return originalGrant(input)
    })
    const store: EventRewardExecutionStore = {
      prepareClaimExecution: vi.fn(async () => plan()),
      recordClaimExecution: vi.fn(async () => ({
        claimedAt: '2026-09-19T04:46:00.000Z',
        replayed: true,
      })),
    }

    await executeEventRewardClaim(reservationId, store, repository)
    await executeEventRewardClaim(reservationId, store, repository)

    expect(keys).toHaveLength(2)
    expect(keys[0]).toBe(keys[1])
  })

  it('returns an already-completed claim without granting XP again', async () => {
    const repository = progressionRepository()
    const completed = {
      ...plan(),
      claimedAt: '2026-09-19T04:46:00.000Z',
      executionReceiptId: grantId,
      executionAppliedAmount: 75,
    }
    const store: EventRewardExecutionStore = {
      prepareClaimExecution: vi.fn(async () => completed),
      recordClaimExecution: vi.fn(),
    }

    const outcome = await executeEventRewardClaim(reservationId, store, repository)

    expect(repository.grantCharacterXp).not.toHaveBeenCalled()
    expect(outcome.replayed).toBe(true)
    expect(outcome.progressionGrantId).toBe(grantId)
  })

  it('fails closed if the package identity does not match the reservation', async () => {
    const store: EventRewardExecutionStore = {
      prepareClaimExecution: vi.fn(async () => ({
        ...plan(),
        rewardPackageRef: 'reward.other.v1',
      })),
      recordClaimExecution: vi.fn(),
    }

    await expect(
      executeEventRewardClaim(reservationId, store, progressionRepository()),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  })
})
