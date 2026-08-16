import type { ProgressionRepository } from '@aurevane/db/progression'
import { describe, expect, it, vi } from 'vitest'

import {
  CHARACTER_XP_GRANT_PERMISSION,
  grantCharacterXp,
  loadLevelProgressionCurve,
} from './progression-service'

const authority = {
  actorKey: 'system:progression-test',
  permissions: [CHARACTER_XP_GRANT_PERMISSION],
}

function repository(overrides: Partial<ProgressionRepository> = {}): ProgressionRepository {
  return {
    loadCurveForCycle: vi.fn(async () => ({
      version: 1,
      maxLevel: 100,
      cumulativeXpByLevel: Array.from({ length: 100 }, (_, index) => index * 100),
    })),
    grantCharacterXp: vi.fn(async () => ({
      replayed: false,
      result: {
        grantId: '00000000-0000-4000-8000-000000000a01',
        characterId: '00000000-0000-4000-8000-000000000a02',
        progressionCycle: 1,
        curveVersion: 1,
        authorityKey: authority.actorKey,
        sourceKind: 'system',
        sourceId: 'foundation.test',
        reasonTag: 'progression.test',
        requestedAmount: 125,
        appliedAmount: 125,
        xpBefore: 0,
        xpAfter: 125,
        levelBefore: 1,
        levelAfter: 2,
        reachedLevel: 2,
        secondsSinceCycleStart: 30,
        createdAt: '2026-08-16T20:00:00.000Z',
      },
    })),
    ...overrides,
  }
}

describe('progression service', () => {
  it('loads and validates the server-configured curve', async () => {
    const curve = await loadLevelProgressionCurve(1, repository())

    expect(curve).toMatchObject({ version: 1, maxLevel: 100 })
    expect(curve.cumulativeXpByLevel).toHaveLength(100)
  })

  it('rejects malformed persisted curve configuration', async () => {
    const repo = repository({
      loadCurveForCycle: vi.fn(async () => ({
        version: 1,
        maxLevel: 100,
        cumulativeXpByLevel: [0, 100],
      })),
    })

    await expect(loadLevelProgressionCurve(1, repo)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('requires an explicit server-side XP grant permission', async () => {
    const repo = repository()

    await expect(
      grantCharacterXp(
        {
          authority: { actorKey: 'system:no-permission', permissions: [] },
          characterId: '00000000-0000-4000-8000-000000000a02',
          idempotencyKey: '00000000-0000-4000-8000-000000000a03',
          sourceKind: 'system',
          sourceId: 'foundation.test',
          reasonTag: 'progression.test',
          amount: 125,
        },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(repo.grantCharacterXp).not.toHaveBeenCalled()
  })

  it('fingerprints provenance and returns a Level-up event from the atomic grant', async () => {
    let captured: Parameters<ProgressionRepository['grantCharacterXp']>[0] | undefined
    const repo = repository({
      grantCharacterXp: vi.fn(async (input) => {
        captured = input
        return {
          replayed: false,
          result: {
            grantId: '00000000-0000-4000-8000-000000000a01',
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
            levelAfter: 2,
            reachedLevel: 2,
            secondsSinceCycleStart: 30,
            createdAt: '2026-08-16T20:00:00.000Z',
          },
        }
      }),
    })

    const outcome = await grantCharacterXp(
      {
        authority,
        characterId: '00000000-0000-4000-8000-000000000a02',
        idempotencyKey: '00000000-0000-4000-8000-000000000a03',
        sourceKind: 'system',
        sourceId: 'foundation.test',
        reasonTag: 'progression.test',
        amount: 125,
      },
      repo,
    )

    expect(captured?.requestFingerprint).toHaveLength(64)
    expect(captured).toEqual(
      expect.objectContaining({
        actorKey: authority.actorKey,
        commandName: 'character.grant_xp.v1',
        sourceKind: 'system',
        amount: 125,
      }),
    )
    expect(outcome.levelUpEvent).toEqual({
      event: 'character_level_up',
      characterId: '00000000-0000-4000-8000-000000000a02',
      progressionCycle: 1,
      curveVersion: 1,
      levelBefore: 1,
      levelAfter: 2,
    })
  })

  it('does not emit a Level-up event for an XP grant that remains within one Level', async () => {
    const repo = repository({
      grantCharacterXp: vi.fn(async () => ({
        replayed: true,
        result: {
          grantId: '00000000-0000-4000-8000-000000000a01',
          characterId: '00000000-0000-4000-8000-000000000a02',
          progressionCycle: 1,
          curveVersion: 1,
          authorityKey: authority.actorKey,
          sourceKind: 'system',
          sourceId: 'foundation.test',
          reasonTag: 'progression.test',
          requestedAmount: 125,
          appliedAmount: 25,
          xpBefore: 25,
          xpAfter: 50,
          levelBefore: 1,
          levelAfter: 1,
          reachedLevel: null,
          secondsSinceCycleStart: 30,
          createdAt: '2026-08-16T20:00:00.000Z',
        },
      })),
    })

    const outcome = await grantCharacterXp(
      {
        authority,
        characterId: '00000000-0000-4000-8000-000000000a02',
        idempotencyKey: '00000000-0000-4000-8000-000000000a03',
        sourceKind: 'system',
        sourceId: 'foundation.test',
        reasonTag: 'progression.test',
        amount: 125,
      },
      repo,
    )

    expect(outcome.replayed).toBe(true)
    expect(outcome.levelUpEvent).toBeNull()
  })

  it('rejects unstable provenance tags and non-positive amounts', async () => {
    const repo = repository()

    await expect(
      grantCharacterXp(
        {
          authority,
          characterId: '00000000-0000-4000-8000-000000000a02',
          idempotencyKey: '00000000-0000-4000-8000-000000000a03',
          sourceKind: 'system',
          sourceId: 'not allowed!',
          reasonTag: 'progression.test',
          amount: 1,
        },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    await expect(
      grantCharacterXp(
        {
          authority,
          characterId: '00000000-0000-4000-8000-000000000a02',
          idempotencyKey: '00000000-0000-4000-8000-000000000a04',
          sourceKind: 'system',
          sourceId: 'foundation.test',
          reasonTag: 'progression.test',
          amount: 0,
        },
        repo,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })
})
