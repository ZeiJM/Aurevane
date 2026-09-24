import { describe, expect, it } from 'vitest'

import {
  applySupernaturalStoryTransition,
  createInitialSupernaturalStoryState,
} from './supernatural-state'
import {
  ASCENSION_PROOF,
  SEVERENCE_PROOF,
  SUPERNATURAL_CHOICE_TRANSITIONS,
  SUPERNATURAL_IDENTITY_PROOFS,
  SUPERNATURAL_STORY_DEFINITION,
  resolveSupernaturalChoiceTransition,
} from './supernatural-content'

describe('authored supernatural proof content', () => {
  it('keeps one versioned proof identity for each ordinary supernatural path', () => {
    expect(SUPERNATURAL_IDENTITY_PROOFS).toEqual([ASCENSION_PROOF, SEVERENCE_PROOF])
    expect(new Set(SUPERNATURAL_IDENTITY_PROOFS.map((identity) => identity.id)).size).toBe(2)
    expect(ASCENSION_PROOF).toMatchObject({
      id: 'ascension.proof',
      contentVersion: 1,
      kind: 'ascension',
    })
    expect(SEVERENCE_PROOF).toMatchObject({
      id: 'severence.proof',
      contentVersion: 1,
      kind: 'severence',
    })
  })

  it('authors the permanent normal-path choice directly on the existing story-state contract', () => {
    expect(SUPERNATURAL_STORY_DEFINITION).toEqual({
      id: 'supernatural.main',
      contentVersion: 1,
      initialNodeId: 'awakening.threshold',
    })

    expect(SUPERNATURAL_CHOICE_TRANSITIONS).toHaveLength(2)
    expect(
      SUPERNATURAL_CHOICE_TRANSITIONS.map((transition) => transition.result.path).sort(),
    ).toEqual(['ascended', 'severed'])
    expect(
      SUPERNATURAL_CHOICE_TRANSITIONS.every(
        (transition) => transition.storyId === 'supernatural.main',
      ),
    ).toBe(true)
    expect(
      SUPERNATURAL_CHOICE_TRANSITIONS.every(
        (transition) => transition.fromNodeId === 'awakening.threshold',
      ),
    ).toBe(true)
  })

  it('executes both authored choices through the canonical story-state transition engine', () => {
    const initial = createInitialSupernaturalStoryState({
      storyId: SUPERNATURAL_STORY_DEFINITION.id,
      storyVersion: SUPERNATURAL_STORY_DEFINITION.contentVersion,
      initialNodeId: SUPERNATURAL_STORY_DEFINITION.initialNodeId,
      now: '2026-09-23T12:00:00.000Z',
    })

    const ascended = applySupernaturalStoryTransition(
      initial,
      SUPERNATURAL_CHOICE_TRANSITIONS[0],
      '2026-09-23T12:05:00.000Z',
    )
    const severed = applySupernaturalStoryTransition(
      initial,
      SUPERNATURAL_CHOICE_TRANSITIONS[1],
      '2026-09-23T12:05:00.000Z',
    )

    expect(ascended).toMatchObject({
      path: 'ascended',
      ascension: {
        id: ASCENSION_PROOF.id,
        contentVersion: ASCENSION_PROOF.contentVersion,
      },
      severence: null,
    })
    expect(severed).toMatchObject({
      path: 'severed',
      ascension: null,
      severence: {
        id: SEVERENCE_PROOF.id,
        contentVersion: SEVERENCE_PROOF.contentVersion,
      },
    })
  })

  it('pins each authored transition to the matching versioned identity', () => {
    const ascension = SUPERNATURAL_CHOICE_TRANSITIONS.find(
      (transition) => transition.result.path === 'ascended',
    )!
    const severence = SUPERNATURAL_CHOICE_TRANSITIONS.find(
      (transition) => transition.result.path === 'severed',
    )!

    expect(ascension.result).toEqual({
      path: 'ascended',
      ascension: {
        id: ASCENSION_PROOF.id,
        contentVersion: ASCENSION_PROOF.contentVersion,
      },
    })
    expect(severence.result).toEqual({
      path: 'severed',
      severence: {
        id: SEVERENCE_PROOF.id,
        contentVersion: SEVERENCE_PROOF.contentVersion,
      },
    })
  })

  it('resolves exact authored versions and fails closed on unknown or stale references', () => {
    expect(resolveSupernaturalChoiceTransition('supernatural.main.choose-ascension', 1)).toEqual(
      SUPERNATURAL_CHOICE_TRANSITIONS[0],
    )
    expect(resolveSupernaturalChoiceTransition('supernatural.main.choose-severence', 1)).toEqual(
      SUPERNATURAL_CHOICE_TRANSITIONS[1],
    )
    expect(resolveSupernaturalChoiceTransition('supernatural.main.choose-ascension', 2)).toBeNull()
    expect(resolveSupernaturalChoiceTransition('supernatural.main.unknown', 1)).toBeNull()
  })

  it('does not expose Anomaly or retired terminology as ordinary proof content', () => {
    const serialized = JSON.stringify({
      identities: SUPERNATURAL_IDENTITY_PROOFS,
      transitions: SUPERNATURAL_CHOICE_TRANSITIONS,
    }).toLowerCase()

    for (const forbidden of ['anomaly', 'soulmark', 'mantle', 'severance'])
      expect(serialized).not.toContain(forbidden)
  })
})
