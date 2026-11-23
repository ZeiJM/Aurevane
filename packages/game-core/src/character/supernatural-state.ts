export const SUPERNATURAL_STATE_SCHEMA_VERSION = 1 as const

export type SupernaturalPath = 'unawakened' | 'ascended' | 'severed'

export interface SupernaturalContentReference {
  id: string
  contentVersion: number
}

export interface SupernaturalStoryState {
  schemaVersion: typeof SUPERNATURAL_STATE_SCHEMA_VERSION
  stateVersion: number
  storyId: string
  storyVersion: number
  nodeId: string
  path: SupernaturalPath
  ascension: SupernaturalContentReference | null
  severence: SupernaturalContentReference | null
  chosenAt: string | null
  updatedAt: string
}

export type SupernaturalStoryTransitionResult =
  | {
      path: 'unawakened'
      ascension?: never
      severence?: never
    }
  | {
      path: 'ascended'
      ascension: SupernaturalContentReference
      severence?: never
    }
  | {
      path: 'severed'
      ascension?: never
      severence: SupernaturalContentReference
    }

export interface SupernaturalStoryTransitionDefinition {
  id: string
  contentVersion: number
  storyId: string
  storyVersion: number
  fromNodeId: string
  toNodeId: string
  result: SupernaturalStoryTransitionResult
}

export class SupernaturalStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SupernaturalStateError'
  }
}

function validStableId(value: string) {
  return /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value)
}

function assertPositiveVersion(value: number, label: string) {
  if (!Number.isInteger(value) || value <= 0)
    throw new SupernaturalStateError(`${label} must be a positive integer.`)
}

function assertStableId(value: string, label: string) {
  if (!validStableId(value))
    throw new SupernaturalStateError(`${label} must be a stable lowercase content id.`)
}

function assertReference(reference: SupernaturalContentReference, label: string) {
  assertStableId(reference.id, `${label} id`)
  assertPositiveVersion(reference.contentVersion, `${label} content version`)
}

export function assertSupernaturalStoryState(state: SupernaturalStoryState) {
  if (state.schemaVersion !== SUPERNATURAL_STATE_SCHEMA_VERSION)
    throw new SupernaturalStateError('Unsupported supernatural state schema version.')
  assertPositiveVersion(state.stateVersion, 'State version')
  assertStableId(state.storyId, 'Story id')
  assertPositiveVersion(state.storyVersion, 'Story version')
  assertStableId(state.nodeId, 'Story node id')

  if (state.path === 'unawakened') {
    if (state.ascension || state.severence || state.chosenAt)
      throw new SupernaturalStateError(
        'Unawakened supernatural state cannot contain a bound path identity.',
      )
    return
  }

  if (!state.chosenAt)
    throw new SupernaturalStateError('A permanent supernatural choice requires chosenAt.')

  if (state.path === 'ascended') {
    if (!state.ascension || state.severence)
      throw new SupernaturalStateError(
        'Ascended state requires exactly one Ascension reference and no Severence reference.',
      )
    assertReference(state.ascension, 'Ascension')
    return
  }

  if (!state.severence || state.ascension)
    throw new SupernaturalStateError(
      'Severed state requires exactly one Severence reference and no Ascension reference.',
    )
  assertReference(state.severence, 'Severence')
}

export function createInitialSupernaturalStoryState(input: {
  storyId: string
  storyVersion: number
  initialNodeId: string
  now: string
}): SupernaturalStoryState {
  const state: SupernaturalStoryState = {
    schemaVersion: SUPERNATURAL_STATE_SCHEMA_VERSION,
    stateVersion: 1,
    storyId: input.storyId,
    storyVersion: input.storyVersion,
    nodeId: input.initialNodeId,
    path: 'unawakened',
    ascension: null,
    severence: null,
    chosenAt: null,
    updatedAt: input.now,
  }
  assertSupernaturalStoryState(state)
  return state
}

export function applySupernaturalStoryTransition(
  state: SupernaturalStoryState,
  transition: SupernaturalStoryTransitionDefinition,
  now: string,
): SupernaturalStoryState {
  assertSupernaturalStoryState(state)
  assertStableId(transition.id, 'Transition id')
  assertPositiveVersion(transition.contentVersion, 'Transition content version')
  assertStableId(transition.storyId, 'Transition story id')
  assertPositiveVersion(transition.storyVersion, 'Transition story version')
  assertStableId(transition.fromNodeId, 'Transition source node id')
  assertStableId(transition.toNodeId, 'Transition destination node id')

  if (transition.storyId !== state.storyId || transition.storyVersion !== state.storyVersion)
    throw new SupernaturalStateError('That supernatural transition belongs to a different story.')
  if (transition.fromNodeId !== state.nodeId)
    throw new SupernaturalStateError(
      'That supernatural transition is not available from this node.',
    )

  const nextPath = transition.result.path
  if (state.path !== 'unawakened' && nextPath !== state.path)
    throw new SupernaturalStateError(
      'The ordinary Ascension / Severence choice is permanent and mutually exclusive.',
    )

  const next: SupernaturalStoryState = {
    ...state,
    stateVersion: state.stateVersion + 1,
    nodeId: transition.toNodeId,
    path: nextPath,
    ascension: nextPath === 'ascended' ? transition.result.ascension : null,
    severence: nextPath === 'severed' ? transition.result.severence : null,
    chosenAt: nextPath === 'unawakened' ? null : (state.chosenAt ?? now),
    updatedAt: now,
  }

  assertSupernaturalStoryState(next)
  return next
}
