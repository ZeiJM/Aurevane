import type { SupernaturalStoryTransitionDefinition } from './supernatural-state'

export type AuthoredSupernaturalIdentityKind = 'ascension' | 'severence'

export interface AuthoredSupernaturalIdentityDefinition {
  id: string
  contentVersion: number
  kind: AuthoredSupernaturalIdentityKind
  title: string
  summary: string
}

export const SUPERNATURAL_STORY_DEFINITION = {
  id: 'supernatural.main',
  contentVersion: 1,
  initialNodeId: 'awakening.threshold',
} as const

export const ASCENSION_PROOF = {
  id: 'ascension.proof',
  contentVersion: 1,
  kind: 'ascension',
  title: 'Ascension Proof',
  summary:
    'Representative authored Ascension identity for the Phase-5 content contract; combat power is not attached yet.',
} as const satisfies AuthoredSupernaturalIdentityDefinition

export const SEVERENCE_PROOF = {
  id: 'severence.proof',
  contentVersion: 1,
  kind: 'severence',
  title: 'Severence Proof',
  summary:
    'Representative authored Severence identity for the Phase-5 content contract; combat power is not attached yet.',
} as const satisfies AuthoredSupernaturalIdentityDefinition

export const SUPERNATURAL_IDENTITY_PROOFS = [ASCENSION_PROOF, SEVERENCE_PROOF] as const

export const SUPERNATURAL_CHOICE_TRANSITIONS = [
  {
    id: 'supernatural.main.choose-ascension',
    contentVersion: 1,
    storyId: SUPERNATURAL_STORY_DEFINITION.id,
    storyVersion: SUPERNATURAL_STORY_DEFINITION.contentVersion,
    fromNodeId: SUPERNATURAL_STORY_DEFINITION.initialNodeId,
    toNodeId: 'awakening.bound',
    result: {
      path: 'ascended',
      ascension: {
        id: ASCENSION_PROOF.id,
        contentVersion: ASCENSION_PROOF.contentVersion,
      },
    },
  },
  {
    id: 'supernatural.main.choose-severence',
    contentVersion: 1,
    storyId: SUPERNATURAL_STORY_DEFINITION.id,
    storyVersion: SUPERNATURAL_STORY_DEFINITION.contentVersion,
    fromNodeId: SUPERNATURAL_STORY_DEFINITION.initialNodeId,
    toNodeId: 'awakening.bound',
    result: {
      path: 'severed',
      severence: {
        id: SEVERENCE_PROOF.id,
        contentVersion: SEVERENCE_PROOF.contentVersion,
      },
    },
  },
] as const satisfies readonly SupernaturalStoryTransitionDefinition[]

export function resolveSupernaturalChoiceTransition(id: string, contentVersion: number) {
  return (
    SUPERNATURAL_CHOICE_TRANSITIONS.find(
      (transition) => transition.id === id && transition.contentVersion === contentVersion,
    ) ?? null
  )
}
