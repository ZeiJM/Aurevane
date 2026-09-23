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
    if (objective.id !== EASTERN_WATCH_OBJECTIVE_ID)
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
        description: 'Speak with the watch officer at the protected settlement.',
        completed: false,
        progress,
      }
    if (progress === 'active')
      return {
        ...objective,
        destination: EASTERN_WATCH,
        description: 'Reach the eastern watchtower across the river.',
        completed: false,
        progress,
      }
    if (progress === 'ready')
      return {
        ...objective,
        destination: VERDANT_SETTLEMENT,
        description: 'Return to the protected settlement and report to the watch officer.',
        completed: false,
        progress,
      }
    return {
      ...objective,
      autoPath: false,
      destination: null,
      description: 'The eastern route has been verified.',
      completed: true,
      progress,
    }
  })
}

export function advanceWorldObjectiveProgress(state: WorldState): WorldState {
  if (
    worldObjectiveProgress(state, EASTERN_WATCH_OBJECTIVE_ID) === 'active' &&
    samePosition(state.position, EASTERN_WATCH)
  )
    return setObjectiveProgress(state, EASTERN_WATCH_OBJECTIVE_ID, 'ready')
  return state
}

export function resolveWorldInteraction(
  state: WorldState,
  interactionId: string,
): WorldState | null {
  if (
    interactionId !== EASTERN_WATCH_INTERACTION_ID ||
    state.route.length ||
    !samePosition(state.position, VERDANT_SETTLEMENT)
  )
    return null

  const progress = worldObjectiveProgress(state, EASTERN_WATCH_OBJECTIVE_ID)
  if (progress === 'available')
    return setObjectiveProgress(state, EASTERN_WATCH_OBJECTIVE_ID, 'active')
  if (progress !== 'ready') return null

  const completedObjectives = new Set(state.completedObjectives)
  completedObjectives.add(EASTERN_WATCH_OBJECTIVE_ID)
  return {
    ...setObjectiveProgress(state, EASTERN_WATCH_OBJECTIVE_ID, 'completed'),
    completedObjectives: [...completedObjectives],
  }
}

export function localWorldInteractions(state: WorldState): WorldInteraction[] {
  if (!samePosition(state.position, VERDANT_SETTLEMENT)) return []

  const progress = worldObjectiveProgress(state, EASTERN_WATCH_OBJECTIVE_ID)
  const base = {
    id: EASTERN_WATCH_INTERACTION_ID,
    objectiveId: EASTERN_WATCH_OBJECTIVE_ID,
    title: 'The Eastern Watch',
    speaker: 'Watch officer',
    progress,
  } as const

  if (progress === 'available')
    return [
      {
        ...base,
        body: 'The eastern tower has gone quiet. Confirm it is standing, then report back.',
        actionLabel: 'Accept objective',
      },
    ]
  if (progress === 'active')
    return [
      {
        ...base,
        body: 'The watch officer is waiting for your report from the eastern tower.',
        actionLabel: null,
      },
    ]
  if (progress === 'ready')
    return [
      {
        ...base,
        body: 'You have seen the tower. Give the watch officer your report so the route can be marked verified.',
        actionLabel: 'Report back',
      },
    ]
  return [
    {
      ...base,
      body: 'Your report is already recorded. The eastern route remains verified.',
      actionLabel: null,
    },
  ]
}
