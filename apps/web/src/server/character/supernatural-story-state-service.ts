import 'server-only'

import { createHash } from 'node:crypto'

import type {
  SupernaturalStoryStateRecord,
  SupernaturalStoryStateRepository,
} from '@aurevane/db/supernatural-state'
import {
  applySupernaturalStoryTransition,
  assertSupernaturalStoryState,
  type SupernaturalStoryState,
  type SupernaturalStoryTransitionDefinition,
} from '@aurevane/game-core/character/supernatural-state'
import { AurevaneError } from '@aurevane/game-core/errors'

export interface SupernaturalStoryDefinition {
  id: string
  contentVersion: number
  initialNodeId: string
}

function persistenceUnavailable(detail: string) {
  return new AurevaneError('PERSISTENCE_UNAVAILABLE', detail)
}

function toCoreState(record: SupernaturalStoryStateRecord): SupernaturalStoryState {
  const state: SupernaturalStoryState = {
    schemaVersion: record.schemaVersion,
    stateVersion: record.stateVersion,
    storyId: record.storyId,
    storyVersion: record.storyVersion,
    nodeId: record.nodeId,
    path: record.path,
    ascension:
      record.ascensionId && record.ascensionContentVersion
        ? { id: record.ascensionId, contentVersion: record.ascensionContentVersion }
        : null,
    severence:
      record.severenceId && record.severenceContentVersion
        ? { id: record.severenceId, contentVersion: record.severenceContentVersion }
        : null,
    chosenAt: record.chosenAt,
    updatedAt: record.updatedAt,
  }

  try {
    assertSupernaturalStoryState(state)
  } catch (error) {
    throw persistenceUnavailable(
      error instanceof Error
        ? `Persisted supernatural state is invalid: ${error.message}`
        : 'Persisted supernatural state is invalid.',
    )
  }
  return state
}

function sameReference(
  actual: { id: string; contentVersion: number } | null,
  expected: { id: string; contentVersion: number } | undefined,
) {
  if (!expected) return actual === null
  return actual?.id === expected.id && actual.contentVersion === expected.contentVersion
}

function assertCommittedTransition(
  state: SupernaturalStoryState,
  transition: SupernaturalStoryTransitionDefinition,
  expectedStateVersion: number,
) {
  if (
    state.stateVersion !== expectedStateVersion + 1 ||
    state.storyId !== transition.storyId ||
    state.storyVersion !== transition.storyVersion ||
    state.nodeId !== transition.toNodeId ||
    state.path !== transition.result.path
  )
    throw persistenceUnavailable(
      'The committed supernatural transition did not match its definition.',
    )

  if (
    state.path === 'ascended' &&
    !sameReference(
      state.ascension,
      transition.result.path === 'ascended' ? transition.result.ascension : undefined,
    )
  )
    throw persistenceUnavailable('The committed Ascension identity did not match its definition.')

  if (
    state.path === 'severed' &&
    !sameReference(
      state.severence,
      transition.result.path === 'severed' ? transition.result.severence : undefined,
    )
  )
    throw persistenceUnavailable('The committed Severence identity did not match its definition.')

  if (state.path === 'unawakened' && (state.ascension || state.severence || state.chosenAt))
    throw persistenceUnavailable('The committed Unawakened state contained a path identity.')
}

function fingerprint(
  characterId: string,
  expectedStateVersion: number,
  transition: SupernaturalStoryTransitionDefinition,
) {
  return `sha256:${createHash('sha256')
    .update(
      JSON.stringify({
        command: 'character.supernatural-story.transition.v1',
        characterId,
        expectedStateVersion,
        transition,
      }),
    )
    .digest('hex')}`
}

export async function loadOrInitializeSupernaturalStoryState(
  userId: string,
  characterId: string,
  story: SupernaturalStoryDefinition,
  repository: SupernaturalStoryStateRepository,
): Promise<SupernaturalStoryState> {
  const existing = await repository.find(userId, characterId)
  if (existing) {
    const state = toCoreState(existing)
    if (state.storyId !== story.id || state.storyVersion !== story.contentVersion)
      throw new AurevaneError(
        'INVALID_REQUEST',
        'This character is already committed to a different supernatural story version.',
      )
    return state
  }

  const initialized = await repository.initialize({
    userId,
    characterId,
    storyId: story.id,
    storyVersion: story.contentVersion,
    initialNodeId: story.initialNodeId,
  })
  const state = toCoreState(initialized)
  if (
    state.storyId !== story.id ||
    state.storyVersion !== story.contentVersion ||
    state.nodeId !== story.initialNodeId ||
    state.path !== 'unawakened'
  )
    throw persistenceUnavailable('The initialized supernatural story state was invalid.')
  return state
}

export async function commitSupernaturalStoryTransition(
  userId: string,
  characterId: string,
  input: {
    expectedStateVersion: number
    idempotencyKey: string
    transition: SupernaturalStoryTransitionDefinition
  },
  repository: SupernaturalStoryStateRepository,
): Promise<{ state: SupernaturalStoryState; replayed: boolean }> {
  const currentRecord = await repository.find(userId, characterId)
  if (!currentRecord)
    throw new AurevaneError(
      'INVALID_REQUEST',
      'The supernatural story has not been initialized for this character.',
    )

  const current = toCoreState(currentRecord)
  if (current.stateVersion !== input.expectedStateVersion)
    throw new AurevaneError(
      'STALE_VERSION',
      'The supernatural story state changed. Refresh and try again.',
    )

  try {
    applySupernaturalStoryTransition(current, input.transition, current.updatedAt)
  } catch (error) {
    throw new AurevaneError(
      'INVALID_REQUEST',
      error instanceof Error ? error.message : 'That supernatural transition is not available.',
    )
  }

  const ascension =
    input.transition.result.path === 'ascended' ? input.transition.result.ascension : null
  const severence =
    input.transition.result.path === 'severed' ? input.transition.result.severence : null

  const committed = await repository.commitTransition({
    userId,
    characterId,
    expectedStateVersion: input.expectedStateVersion,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: fingerprint(characterId, input.expectedStateVersion, input.transition),
    transitionId: input.transition.id,
    transitionContentVersion: input.transition.contentVersion,
    storyId: input.transition.storyId,
    storyVersion: input.transition.storyVersion,
    fromNodeId: input.transition.fromNodeId,
    toNodeId: input.transition.toNodeId,
    nextPath: input.transition.result.path,
    ascensionId: ascension?.id ?? null,
    ascensionContentVersion: ascension?.contentVersion ?? null,
    severenceId: severence?.id ?? null,
    severenceContentVersion: severence?.contentVersion ?? null,
  })

  const state = toCoreState(committed.state)
  assertCommittedTransition(state, input.transition, input.expectedStateVersion)
  return { state, replayed: committed.replayed }
}
