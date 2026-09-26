import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { newWorldState } from '@/world/travel'
import type { WorldObjective, WorldState } from '@/world/types'

import {
  AURETH_SETTLEMENT,
  CROWN_HINTERLAND_CROSSING,
  CROWN_HINTERLAND_SURVEY_INTERACTION_ID,
  CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID,
  EASTERN_WATCH_INTERACTION_ID,
  EASTERN_WATCH_OBJECTIVE_ID,
  VERDANT_SETTLEMENT,
  advanceWorldObjectiveProgress,
  effectiveWorldObjectives,
  isInteractionWorldObjective,
  localWorldInteractions,
  resolveWorldInteraction,
  worldObjectiveProgress,
} from './world-objectives'

const crownObjective: WorldObjective = {
  id: CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID,
  name: 'Hinterland Survey',
  description: 'Reach the Crown Hinterland crossing and return with a route report.',
  kind: 'quest',
  autoPath: true,
  guidance: 'exact',
  destination: CROWN_HINTERLAND_CROSSING,
  completed: false,
}

function at(position: WorldState['position']): WorldState {
  return {
    ...newWorldState(),
    position,
    route: [],
    nextStepAt: null,
  }
}

describe('authored settlement interaction quests', () => {
  it('preserves the existing Eastern Watch interaction contract', () => {
    const interactions = localWorldInteractions(at(VERDANT_SETTLEMENT))

    expect(interactions).toEqual([
      expect.objectContaining({
        id: EASTERN_WATCH_INTERACTION_ID,
        objectiveId: EASTERN_WATCH_OBJECTIVE_ID,
        title: 'The Eastern Watch',
        speaker: 'Watch officer',
        actionLabel: 'Accept objective',
        progress: 'available',
      }),
    ])
  })

  it('surfaces the Crown Hinterland survey only at the Aureth settlement', () => {
    const interactions = localWorldInteractions(at(AURETH_SETTLEMENT))

    expect(interactions).toEqual([
      expect.objectContaining({
        id: CROWN_HINTERLAND_SURVEY_INTERACTION_ID,
        objectiveId: CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID,
        title: 'Hinterland Survey',
        speaker: 'Survey clerk',
        actionLabel: 'Accept objective',
        progress: 'available',
      }),
    ])
    expect(localWorldInteractions(at(CROWN_HINTERLAND_CROSSING))).toEqual([])
  })

  it('requires accept, field arrival, return, and explicit report before completion', () => {
    const initial = at(AURETH_SETTLEMENT)
    const accepted = resolveWorldInteraction(initial, CROWN_HINTERLAND_SURVEY_INTERACTION_ID)!

    expect(worldObjectiveProgress(accepted, CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID)).toBe('active')
    expect(effectiveWorldObjectives(accepted, [crownObjective])[0]).toMatchObject({
      destination: CROWN_HINTERLAND_CROSSING,
      description: 'Reach the western Crown Hinterland crossing.',
      completed: false,
      progress: 'active',
    })

    const arrived = advanceWorldObjectiveProgress({
      ...accepted,
      position: CROWN_HINTERLAND_CROSSING,
    })
    expect(worldObjectiveProgress(arrived, CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID)).toBe('ready')
    expect(effectiveWorldObjectives(arrived, [crownObjective])[0]).toMatchObject({
      destination: AURETH_SETTLEMENT,
      description: 'Return to Aureth Crown and file the route report.',
      completed: false,
      progress: 'ready',
    })

    const returned = { ...arrived, position: AURETH_SETTLEMENT }
    expect(localWorldInteractions(returned)[0]).toMatchObject({
      actionLabel: 'File report',
      progress: 'ready',
    })

    const completed = resolveWorldInteraction(returned, CROWN_HINTERLAND_SURVEY_INTERACTION_ID)!
    expect(worldObjectiveProgress(completed, CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID)).toBe(
      'completed',
    )
    expect(completed.completedObjectives).toContain(CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID)
    expect(effectiveWorldObjectives(completed, [crownObjective])[0]).toMatchObject({
      destination: null,
      autoPath: false,
      description: 'The Crown Hinterland crossing has been recorded.',
      completed: true,
      progress: 'completed',
    })
  })

  it('rejects the survey interaction remotely or while a route is active', () => {
    expect(
      resolveWorldInteraction(at(VERDANT_SETTLEMENT), CROWN_HINTERLAND_SURVEY_INTERACTION_ID),
    ).toBeNull()

    const travelling = {
      ...at(AURETH_SETTLEMENT),
      route: [{ position: CROWN_HINTERLAND_CROSSING, durationMs: 1100 }],
      nextStepAt: 2100,
    }
    expect(resolveWorldInteraction(travelling, CROWN_HINTERLAND_SURVEY_INTERACTION_ID)).toBeNull()
  })

  it('identifies all interaction-driven objectives so arrival cannot auto-complete them', () => {
    expect(isInteractionWorldObjective(EASTERN_WATCH_OBJECTIVE_ID)).toBe(true)
    expect(isInteractionWorldObjective(CROWN_HINTERLAND_SURVEY_OBJECTIVE_ID)).toBe(true)
    expect(isInteractionWorldObjective('last-survey')).toBe(false)
  })
})
