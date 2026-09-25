import { describe, expect, it } from 'vitest'

import {
  applySupernaturalStoryTransition,
  assertSupernaturalStoryState,
  createInitialSupernaturalStoryState,
  type SupernaturalStoryState,
  type SupernaturalStoryTransitionDefinition,
} from './supernatural-state'

const now = '2026-09-23T12:00:00.000Z'

function initial() {
  return createInitialSupernaturalStoryState({
    storyId: 'supernatural.main',
    storyVersion: 1,
    initialNodeId: 'awakening.threshold',
    now,
  })
}

function transition(
  result: SupernaturalStoryTransitionDefinition['result'],
  overrides: Partial<SupernaturalStoryTransitionDefinition> = {},
): SupernaturalStoryTransitionDefinition {
  return {
    id: 'supernatural.main.choose-path',
    contentVersion: 1,
    storyId: 'supernatural.main',
    storyVersion: 1,
    fromNodeId: 'awakening.threshold',
    toNodeId: result.path === 'unawakened' ? 'awakening.threshold' : 'awakening.bound',
    result,
    ...overrides,
  }
}

describe('supernatural story state', () => {
  it('starts as versioned Unawakened state with no implicit path entitlement', () => {
    expect(initial()).toEqual({
      schemaVersion: 1,
      stateVersion: 1,
      storyId: 'supernatural.main',
      storyVersion: 1,
      nodeId: 'awakening.threshold',
      path: 'unawakened',
      ascension: null,
      severence: null,
      chosenAt: null,
      updatedAt: now,
    })
  })

  it('applies an authored Ascension choice and preserves the original chosenAt thereafter', () => {
    const ascended = applySupernaturalStoryTransition(
      initial(),
      transition({
        path: 'ascended',
        ascension: { id: 'ascension.proof', contentVersion: 1 },
      }),
      '2026-09-23T12:05:00.000Z',
    )

    expect(ascended).toMatchObject({
      stateVersion: 2,
      nodeId: 'awakening.bound',
      path: 'ascended',
      ascension: { id: 'ascension.proof', contentVersion: 1 },
      severence: null,
      chosenAt: '2026-09-23T12:05:00.000Z',
    })

    const progressed = applySupernaturalStoryTransition(
      ascended,
      {
        id: 'supernatural.main.ascended-followup',
        contentVersion: 1,
        storyId: 'supernatural.main',
        storyVersion: 1,
        fromNodeId: 'awakening.bound',
        toNodeId: 'awakening.after',
        result: {
          path: 'ascended',
          ascension: { id: 'ascension.proof', contentVersion: 1 },
        },
      },
      '2026-09-23T13:00:00.000Z',
    )

    expect(progressed.chosenAt).toBe(ascended.chosenAt)
    expect(progressed.stateVersion).toBe(3)
  })

  it('applies an authored Severence choice without inventing a separate Mantle identity layer', () => {
    const severed = applySupernaturalStoryTransition(
      initial(),
      transition({
        path: 'severed',
        severence: { id: 'severence.proof', contentVersion: 1 },
      }),
      '2026-09-23T12:05:00.000Z',
    )

    expect(severed).toMatchObject({
      path: 'severed',
      ascension: null,
      severence: { id: 'severence.proof', contentVersion: 1 },
      chosenAt: '2026-09-23T12:05:00.000Z',
    })
  })

  it('rejects ordinary cross-path transitions after the permanent choice', () => {
    const ascended = applySupernaturalStoryTransition(
      initial(),
      transition({
        path: 'ascended',
        ascension: { id: 'ascension.proof', contentVersion: 1 },
      }),
      '2026-09-23T12:05:00.000Z',
    )

    expect(() =>
      applySupernaturalStoryTransition(
        ascended,
        {
          id: 'supernatural.main.illegal-switch',
          contentVersion: 1,
          storyId: 'supernatural.main',
          storyVersion: 1,
          fromNodeId: 'awakening.bound',
          toNodeId: 'awakening.illegal',
          result: {
            path: 'severed',
            severence: { id: 'severence.proof', contentVersion: 1 },
          },
        },
        '2026-09-23T13:00:00.000Z',
      ),
    ).toThrow(/permanent and mutually exclusive/)
  })

  it('rejects return to Unawakened after a permanent choice', () => {
    const severed = applySupernaturalStoryTransition(
      initial(),
      transition({
        path: 'severed',
        severence: { id: 'severence.proof', contentVersion: 1 },
      }),
      '2026-09-23T12:05:00.000Z',
    )

    expect(() =>
      applySupernaturalStoryTransition(
        severed,
        {
          id: 'supernatural.main.illegal-reset',
          contentVersion: 1,
          storyId: 'supernatural.main',
          storyVersion: 1,
          fromNodeId: 'awakening.bound',
          toNodeId: 'awakening.threshold',
          result: { path: 'unawakened' },
        },
        '2026-09-23T13:00:00.000Z',
      ),
    ).toThrow(/permanent and mutually exclusive/)
  })

  it('fails closed on stale story versions and wrong source nodes', () => {
    expect(() =>
      applySupernaturalStoryTransition(
        initial(),
        transition(
          {
            path: 'ascended',
            ascension: { id: 'ascension.proof', contentVersion: 1 },
          },
          { storyVersion: 2 },
        ),
        now,
      ),
    ).toThrow(/different story/)

    expect(() =>
      applySupernaturalStoryTransition(
        initial(),
        transition(
          {
            path: 'ascended',
            ascension: { id: 'ascension.proof', contentVersion: 1 },
          },
          { fromNodeId: 'awakening.other' },
        ),
        now,
      ),
    ).toThrow(/not available from this node/)
  })

  it('rejects malformed persisted path combinations instead of normalizing them silently', () => {
    const invalid: SupernaturalStoryState = {
      ...initial(),
      path: 'ascended',
      ascension: null,
      chosenAt: '2026-09-23T12:05:00.000Z',
    }

    expect(() => assertSupernaturalStoryState(invalid)).toThrow(/requires exactly one Ascension/)
  })
})
