import 'server-only'

import { samePosition } from '@/world/travel'
import type {
  WorldInteraction,
  WorldObjective,
  WorldObjectiveProgress,
  WorldPosition,
  WorldState,
} from '@/world/types'

export const EASTERN_WATCH_OBJECTIVE_ID = 'eastern-watch'
export const EASTERN_WATCH_INTERACTION_ID = 'eastern-watch-officer'
export const CROWN_HINTERLAND_PATROL_OBJECTIVE_ID = 'crown-hinterland-patrol'
export const CROWN_HINTERLAND_PATROL_INTERACTION_ID = 'crown-hinterland-watch-officer'

export const VERDANT_SETTLEMENT: WorldPosition = {
  sectorId: 'verdant-expanse',
  x: 2,
  y: 4,
}
export const EASTERN_WATCH: WorldPosition = {
  sectorId: 'verdant-expanse',
  x: 12,
  y: 4,
}
export const AURETH_SETTLEMENT: WorldPosition = {
  sectorId: 'aureth-crown',
  x: 2,
  y: 4,
}
export const CROWN_HINTERLAND_PATROL: WorldPosition = {
  sectorId: 'crown-hinterland',
  x: 6,
  y: 4,
}

interface InteractionObjectiveDefinition {
  objectiveId: string
  interactionId: string
  origin: WorldPosition
  target: WorldPosition
  title: string
  speaker: string
  descriptions: Record<WorldObjectiveProgress, string>
  bodies: Record<WorldObjectiveProgress, string>
}

const INTERACTION_OBJECTIVES: readonly InteractionObjectiveDefinition[] = [
  {
    objectiveId: EASTERN_WATCH_OBJECTIVE_ID,
    interactionId: EASTERN_WATCH_INTERACTION_ID,
    origin: VERDANT_SETTLEMENT,
    target: EASTERN_WATCH,
    title: 'The Eastern Watch',
    speaker: 'Watch officer',
    descriptions: {
      available: 'Speak with the watch officer at the protected settlement.',
      active: 'Reach the eastern watchtower across the river.',
      ready: 'Return to the protected settlement and report to the watch officer.',
      completed: 'The eastern route has been verified.',
    },
    bodies: {
      available:
        'The eastern tower has gone quiet. Confirm it is standing, then report back.',
      active: 'The watch officer is waiting for your report from the eastern tower.',
      ready:
        'You have seen the tower. Give the watch officer your report so the route can be marked verified.',
      completed: 'Your report is already recorded. The eastern route remains verified.',
    },
  },
  {
    objectiveId: CROWN_HINTERLAND_PATROL_OBJECTIVE_ID,
    interactionId: CROWN_HINTERLAND_PATROL_INTERACTION_ID,
    origin: AURETH_SETTLEMENT,
    target: CROWN_HINTERLAND_PATROL,
    title: 'Hinterland Patrol',
    speaker: 'Watch officer',
    descriptions: {
      available: 'Speak with the watch officer at the Aureth Crown settlement.',
      active: 'Reach the central road in Crown Hinterland.',
      ready: 'Return to the Aureth Crown settlement and report to the watch officer.',
      completed: 'The Crown Hinterland patrol has been recorded.',
    },
    bodies: {
      available:
        'The hinterland road needs a fresh patrol. Reach its central stretch, then report back.',
      active: 'The watch officer is waiting for your report from Crown Hinterland.',
      ready:
        'You have reached Crown Hinterland. Give the watch officer your patrol report.',
      completed:
        'Your patrol report is already recorded. The hinterland route remains under watch.',
    },
  },
]

function interactionObjectiveDefinition(objectiveId: string) {
  return INTERACTION_OBJECTIVES.find((definition) => definition.objectiveId === objectiveId) ?? null
}

export function isInteractionWorldObjectiveId(objectiveId: string) {
  return interactionObjectiveDefinition(objectiveId) !== null
}

export function worldObjectiveProgress(
  state: WorldState,
  objectiveId: string,
): WorldObjectiveProgress {
  if (state.completedObjectives.includes(objectiveId)) return 'completed'
  return state.objectiveProgress?.[objectiveId] ?? 'available'
}

function setObjectiveProgress(
  state: WorldState,
  objectiveId: string,
  progress: WorldObjectiveProgress,
): WorldState {
  return {
    ...state,
    objectiveProgress: {
      ...(state.objectiveProgress ?? {}),
      [objectiveId]: progress,
    },
  }
}

export function effectiveWorldObjectives(
  state: WorldState,
  objectives: readonly WorldObjective[],
): WorldObjective[] {
  return objectives.map((objective) => {
    const definition = interactionObjectiveDefinition(objective.id)
    if (!definition)
      return {
        ...objective,
        completed: state.completedObjectives.includes(objective.id),
        progress: state.completedObjectives.includes(objective.id) ? 'completed' : undefined,
      }

    const progress = worldObjectiveProgress(state, objective.id)
    if (progress === 'available')
      return {
        ...objective,
        autoPath: false,
        destination: null,
        description: definition.descriptions.available,
        completed: false,
        progress,
      }
    if (progress === 'active')
      return {
        ...objective,
        destination: definition.target,
        description: definition.descriptions.active,
        completed: false,
        progress,
      }
    if (progress === 'ready')
      return {
        ...objective,
        destination: definition.origin,
        description: definition.descriptions.ready,
        completed: false,
        progress,
      }
    return {
      ...objective,
      autoPath: false,
      destination: null,
      description: definition.descriptions.completed,
      completed: true,
      progress,
    }
  })
}

export function advanceWorldObjectiveProgress(state: WorldState): WorldState {
  let next = state
  for (const definition of INTERACTION_OBJECTIVES)
    if (
      worldObjectiveProgress(next, definition.objectiveId) === 'active' &&
      samePosition(next.position, definition.target)
    )
      next = setObjectiveProgress(next, definition.objectiveId, 'ready')
  return next
}

export function resolveWorldInteraction(
  state: WorldState,
  interactionId: string,
): WorldState | null {
  const definition = INTERACTION_OBJECTIVES.find(
    (candidate) => candidate.interactionId === interactionId,
  )
  if (!definition || state.route.length || !samePosition(state.position, definition.origin))
    return null

  const progress = worldObjectiveProgress(state, definition.objectiveId)
  if (progress === 'available')
    return setObjectiveProgress(state, definition.objectiveId, 'active')
  if (progress !== 'ready') return null

  const completedObjectives = new Set(state.completedObjectives)
  completedObjectives.add(definition.objectiveId)
  return {
    ...setObjectiveProgress(state, definition.objectiveId, 'completed'),
    completedObjectives: [...completedObjectives],
  }
}

export function localWorldInteractions(state: WorldState): WorldInteraction[] {
  return INTERACTION_OBJECTIVES.flatMap((definition) => {
    if (!samePosition(state.position, definition.origin)) return []

    const progress = worldObjectiveProgress(state, definition.objectiveId)
    const base = {
      id: definition.interactionId,
      objectiveId: definition.objectiveId,
      title: definition.title,
      speaker: definition.speaker,
      progress,
    } as const

    if (progress === 'available')
      return [{ ...base, body: definition.bodies.available, actionLabel: 'Accept objective' }]
    if (progress === 'active')
      return [{ ...base, body: definition.bodies.active, actionLabel: null }]
    if (progress === 'ready')
      return [{ ...base, body: definition.bodies.ready, actionLabel: 'Report back' }]
    return [{ ...base, body: definition.bodies.completed, actionLabel: null }]
  })
}
