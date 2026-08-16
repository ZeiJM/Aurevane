import type {
  TrainingReportClaimRecord,
  TrainingReportRecord,
  WayfarersPracticeRepository,
} from '@aurevane/db/wayfarers-practice'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { claimTrainingReport, loadTrainingReport } from './wayfarers-practice-service'

const userId = '00000000-0000-4000-8000-000000000b01'
const characterId = '00000000-0000-4000-8000-000000000b02'
const reportId = '00000000-0000-4000-8000-000000000b03'
const idempotencyKey = '00000000-0000-4000-8000-000000000b04'
const actor = { userId }

function report(overrides: Partial<TrainingReportRecord> = {}): TrainingReportRecord {
  return {
    reportId,
    characterId,
    userId,
    focus: 'balanced',
    configVersion: 1,
    windowStartedAt: '2026-08-01T12:00:00.000Z',
    windowEndedAt: '2026-08-03T12:00:00.000Z',
    elapsedSeconds: 2 * 24 * 60 * 60,
    creditedDirectSeconds: 47 * 60 * 60,
    fullRateSeconds: 23 * 60 * 60,
    reducedRateSeconds: 24 * 60 * 60,
    requestedCharacterXp: 280,
    directXpCapReached: false,
    restedMomentumSeconds: 0,
    restedMomentumGain: 0,
    restedMomentumCapReached: false,
    status: 'pending',
    createdAt: '2026-08-03T12:00:00.000Z',
    claimedAt: null,
    ...overrides,
  }
}

function claim(overrides: Partial<TrainingReportClaimRecord> = {}): TrainingReportClaimRecord {
  return {
    reportId,
    characterId,
    userId,
    progressionCycle: 1,
    curveVersion: 1,
    xpGrantId: '00000000-0000-4000-8000-000000000b05',
    requestedCharacterXp: 280,
    appliedCharacterXp: 280,
    xpBefore: 0,
    xpAfter: 280,
    levelBefore: 1,
    levelAfter: 2,
    reachedLevel: 2,
    restedMomentumBefore: 0,
    restedMomentumApplied: 0,
    restedMomentumAfter: 0,
    claimedAt: '2026-08-03T12:01:00.000Z',
    ...overrides,
  }
}

function repository(overrides: Partial<WayfarersPracticeRepository> = {}): WayfarersPracticeRepository {
  return {
    materializeTrainingReport: vi.fn(async () => report()),
    claimTrainingReport: vi.fn(async () => ({ replayed: false, result: claim() })),
    ...overrides,
  }
}

describe("Wayfarer's Practice service", () => {
  it('materializes a report from verified identity without accepting client time or rewards', async () => {
    let captured: Parameters<WayfarersPracticeRepository['materializeTrainingReport']>[0] | undefined
    const repo = repository({
      materializeTrainingReport: vi.fn(async (input) => {
        captured = input
        return report()
      }),
    })

    const result = await loadTrainingReport(actor, characterId, repo)

    expect(result?.reportId).toBe(reportId)
    expect(captured).toEqual({ userId, characterId })
    expect(captured).not.toHaveProperty('windowStartMs')
    expect(captured).not.toHaveProperty('requestedCharacterXp')
    expect(captured).not.toHaveProperty('restedMomentumGain')
  })

  it('returns no Training Report when authoritative accrual is not ready', async () => {
    const repo = repository({ materializeTrainingReport: vi.fn(async () => null) })

    await expect(loadTrainingReport(actor, characterId, repo)).resolves.toBeNull()
  })

  it('rejects report ownership drift and persisted reward drift', async () => {
    const foreign = repository({
      materializeTrainingReport: vi.fn(async () => report({ userId: 'foreign-user' })),
    })
    await expect(loadTrainingReport(actor, characterId, foreign)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })

    const drifted = repository({
      materializeTrainingReport: vi.fn(async () => report({ requestedCharacterXp: 999 })),
    })
    await expect(loadTrainingReport(actor, characterId, drifted)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('claims by opaque identifiers only and returns replay-safe Level-up effects', async () => {
    let captured: Parameters<WayfarersPracticeRepository['claimTrainingReport']>[0] | undefined
    const repo = repository({
      claimTrainingReport: vi.fn(async (input) => {
        captured = input
        return { replayed: false, result: claim() }
      }),
    })

    const result = await claimTrainingReport(
      { actor, characterId, reportId, idempotencyKey },
      repo,
    )

    expect(captured?.requestFingerprint).toHaveLength(64)
    expect(captured).toEqual(
      expect.objectContaining({
        actorKey: `user:${userId}`,
        commandName: 'wayfarers_practice.claim.v1',
        userId,
        characterId,
        reportId,
      }),
    )
    expect(captured).not.toHaveProperty('amount')
    expect(captured).not.toHaveProperty('requestedCharacterXp')
    expect(captured).not.toHaveProperty('restedMomentumGain')
    expect(result.levelUpEvent).toMatchObject({
      event: 'character_level_up',
      characterId,
      levelBefore: 1,
      levelAfter: 2,
    })
  })

  it('suppresses duplicate Level-up side effects on an idempotent replay', async () => {
    const repo = repository({
      claimTrainingReport: vi.fn(async () => ({ replayed: true, result: claim() })),
    })

    const result = await claimTrainingReport(
      { actor, characterId, reportId, idempotencyKey },
      repo,
    )

    expect(result.replayed).toBe(true)
    expect(result.levelUpEvent).toBeNull()
  })

  it('rejects malformed identifiers before persistence', async () => {
    const repo = repository()

    await expect(loadTrainingReport(actor, 'not-a-character', repo)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    await expect(
      claimTrainingReport(
        { actor, characterId, reportId: 'not-a-report', idempotencyKey },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(repo.claimTrainingReport).not.toHaveBeenCalled()
  })
})
