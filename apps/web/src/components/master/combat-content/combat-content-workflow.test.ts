import { describe, expect, it } from 'vitest'

import {
  canPublishCombatContent,
  invalidateCombatContentReview,
  nextCombatContentVersion,
  projectPublishedVersionHistory,
  projectRollbackVersionHistory,
  type CombatContentReviewState,
  type CombatContentVersionHistoryEntry,
} from './combat-content-workflow'

const reviewed: CombatContentReviewState = {
  validation: { valid: true, issues: [], derivedTags: ['Enemy', 'Single', 'Dmg'] },
  diff: { changedPaths: ['apCost'] },
  preview: { legal: true },
}

const history: readonly CombatContentVersionHistoryEntry[] = [
  {
    contentVersion: 3,
    source: 'static-baseline',
    current: true,
    publishedAt: null,
  },
  {
    contentVersion: 4,
    source: 'published',
    current: false,
    publishedAt: '2026-09-17T12:00:00.000Z',
  },
  {
    contentVersion: 5,
    source: 'published',
    current: false,
    publishedAt: '2026-09-17T13:00:00.000Z',
  },
]

describe('Master Panel combat content workflow', () => {
  it('keeps Publish disabled until validation, diff, and preview are current', () => {
    expect(canPublishCombatContent({ validation: null, diff: null, preview: null })).toBe(false)
    expect(
      canPublishCombatContent({
        validation: reviewed.validation,
        diff: null,
        preview: null,
      }),
    ).toBe(false)
    expect(
      canPublishCombatContent({
        validation: reviewed.validation,
        diff: reviewed.diff,
        preview: null,
      }),
    ).toBe(false)
    expect(canPublishCombatContent(reviewed)).toBe(true)
  })

  it('invalidates validation, diff, and preview whenever the draft changes', () => {
    expect(invalidateCombatContentReview(reviewed)).toEqual({
      validation: null,
      diff: null,
      preview: null,
    })
  })

  it('computes the next immutable version above history even after rollback to static baseline', () => {
    expect(nextCombatContentVersion(3, history)).toBe(6)
  })

  it('projects publish as a new current version without deleting history', () => {
    const next = projectPublishedVersionHistory(history, {
      contentVersion: 6,
      publishedAt: '2026-09-17T14:00:00.000Z',
    })

    expect(next.map((entry) => entry.contentVersion)).toEqual([3, 4, 5, 6])
    expect(next.find((entry) => entry.contentVersion === 6)?.current).toBe(true)
    expect(next.filter((entry) => entry.current)).toHaveLength(1)
  })

  it('projects rollback by repointing current history without deleting any version', () => {
    const rolledBack = projectRollbackVersionHistory(history, 4)

    expect(rolledBack.map((entry) => entry.contentVersion)).toEqual([3, 4, 5])
    expect(rolledBack.find((entry) => entry.contentVersion === 4)?.current).toBe(true)
    expect(rolledBack.filter((entry) => entry.current)).toHaveLength(1)
  })
})
