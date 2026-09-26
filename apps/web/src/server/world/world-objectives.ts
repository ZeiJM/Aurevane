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
export const CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID = 'crown-hinterland-survey'
export const CROWN_HINTERLAND_SURVEY_INTERACTION_ID = 'crown-survey-clerk'

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
export const CROWN_HINTERLAND_CROSSING: WorldPosition = {
  sectorId: 'crown-hinterland',
  x: 0,
  y: 4,
}

interface InteractionQuestDefinition {
  objectiveId: string
  interactionId: string
  settlement: WorldPosition
  destination: WorldPosition
  title: string
  speaker: string
  descriptions: Record<WorldObjectiveProgress, string>
  bodies: Record<WorldObjectiveProgress, string>
  availableActionLabel: string
  readyActionLabel: string
}

const INTERACTION_QUESTS: readonly InteractionQuestDefinition[] = [
  {
    objectiveId: EASTERN_WATCH_OBJECTIVE_ID,
    interactionId: EASTERN_WATCH_INTERACTION_ID,
    settlement: VERDANT_SETTLEMENT,
    destination: EASTERN_WATCH,
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
    availableActionLabel: 'Accept objective',
    readyActionLabel: 'Report back',
  },
  {
    objectiveId: CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID,
    interactionId: CROWN_HINTERLAND_SURVEY_INTERACTION_ID,
    settlement: AURETH_SETTLEMENT,
    destination: CROWN_HINTERLAND_CROSSING,
    title: 'Hinterland Survey',
    speaker: 'Survey clerk',
    descriptions: {
      available: 'Speak with the survey clerk at the Aureth Crown settlement.',
      active: 'Reach the western Crown Hinterland crossing.',
      ready: 'Return to Aureth Crown and file the route report.',
      completed: 'The Crown Hinterland crossing has been recorded.',
    },
    bodies: {
      available:
        'The newly charted hinterland road needs a field check. Walk to the western Crown Hinterland crossing, then return with a route report.',
      active: 'The survey clerk is waiting for your report from the Crown Hinterland crossing.',
      ready: 'You reached the crossing. File the route report so the chart can be marked verified.',
      completed:
        'Your route report is already filed. The Crown Hinterland crossing remains verified.',
    },
    availableActionLabel: 'Accept objective',
    readyActionLabel: 'File report',
  },
]

function interactionQuestByObjective(objectiveId: string) {
  return INTERACTION_QUESTS.find((quest) => quest.objectiveId === objectiveId) ?? null
}

function interactionQuestByInteraction(interactionId: string) {
  return INTERACTION_QUESTS.find((quest) => quest.interactionId === interactionId) ?? null
}

export function isInteractionWorldObjective(objectiveId: string) {
  return interactionQuestByObjective(objectiveId) !== null
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
    const quest = interactionQuestByObjective(objective.id)
    if (!quest)
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
        description: quest.descriptions.available,
        completed: false,
        progress,
      }
    if (progress === 'active')
      return {
        ...objective,
        destination: quest.destination,
        description: quest.descriptions.active,
        completed: false,
        progress,
      }
    if (progress === 'ready')
      return {
        ...objective,
        destination: quest.settlement,
        description: quest.descriptions.ready,
        completed: false,
        progress,
      }
    return {
      ...objective,
      autoPath: false,
      destination: null,
      description: quest.descriptions.completed,
      completed: true,
      progress,
    }
  })
}

export function advanceWorldObjectiveProgress(state: WorldState): WorldState {
  let next = state
  for (const quest of INTERACTION_QUESTS)
    if (
      worldObjectiveProgress(next, quest.objectiveId) === 'active' &&
      samePosition(next.position, quest.destination)
    )
      next = setObjectiveProgress(next, quest.objectiveId, 'ready')
  return next
}

export function resolveWorldInteraction(
  state: WorldState,
  interactionId: string,
): WorldState | null {
  const quest = interactionQuestByInteraction(interactionId)
  if (!quest || state.route.length || !samePosition(state.position, quest.settlement)) return null

  const progress = worldObjectiveProgress(state, quest.objectiveId)
  if (progress === 'available')
    return setObjectiveProgress(state, quest.objectiveId, 'active')
  if (progress !== 'ready') return null

  const completedObjectives = new Set(state.completedObjectives)
  completedObjectives.add(quest.objectiveId)
  return {
    ...setObjectiveProgress(state, quest.objectiveId, 'completed'),
    completedObjectives: [...completedObjectives],
  }
}

function interactionFor(
  state: WorldState,
  quest: InteractionQuestDefinition,
): WorldInteraction {
  const progress = worldObjectiveProgress(state, quest.objectiveId)
  return {
    id: quest.interactionId,
    objectiveId: quest.objectiveId,
    title: quest.title,
    speaker: quest.speaker,
    body: quest.bodies[progress],
    actionLabel:
      progress === 'available'
        ? quest.availableActionLabel
        : progress === 'ready'
          ? quest.readyActionLabel
          : null,
    progress,
  }
}

export function localWorldInteractions(state: WorldState): WorldInteraction[] {
  return INTERACTION_QUESTS.filter((quest) => samePosition(state.position, quest.settlement)).map(
    (quest) => interactionFor(state, quest),
  )
}
