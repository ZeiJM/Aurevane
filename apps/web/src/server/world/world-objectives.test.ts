import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { newWorldState } from '@/world/travel'
import type { WorldObjective, WorldState } from '@/world/types'

import {
  AURETH_SETTLEMENT,
  CROWN_HINTERLAND_PATROL,
  CROWN_HINTERLAND_PATROL_INTERACTION_ID,
  CROWN_HINTERLAND_PATROL_OBJECTIVE_ID,
  EASTERN_WATCH_INTERACTION_ID,
  EASTERN_WATCH_OBJECTIVE_ID,
  VERDANT_SETTLEMENT,
  advanceWorldObjectiveProgress,
  effectiveWorldObjectives,
  isInteractionWorldObjectiveId,
  localWorldInteractions,
  resolveWorldInteraction,
  worldObjectiveProgress,
} from './world-objectives'

const patrolObjective: WorldObjective = {
  id: CROWN_HINTERLAND_PATROL_OBJECTIVE_ID,
  name: 'Hinterland Patrol',
  description: 'Reach the central road in Crown Hinterland, then return.',
  kind: 'quest',
  autoPath: true,
  guidance: 'exact',
  destination: CROWN_HINTERLAND_PATROL,
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

describe('authored settlement interaction objectives', () => {
  it('preserves the existing Eastern Watch interaction contract', () => {
    expect(localWorldInteractions(at(VERDANT_SETTLEMENT))).toEqual([
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

  it('surfaces Hinterland Patrol only at the Aureth Crown settlement', () => {
    expect(localWorldInteractions(at(AURETH_SETTLEMENT))).toEqual([
      expect.objectContaining({
        id: CROWN_HINTERLAND_PATROL_INTERACTION_ID,
        objectiveId: CROWN_HINTERLAND_PATROL_OBJECTIVE_ID,
        title: 'Hinterland Patrol',
        speaker: 'Watch officer',
        actionLabel: 'Accept objective',
        progress: 'available',
      }),
    ])
    expect(localWorldInteractions(at(CROWN_HINTERLAND_PATROL))).toEqual([])
  })

  it('requires accept, patrol arrival, return, and explicit report before completion', () => {
    const accepted = resolveWorldInteraction(
      at(AURETH_SETTLEMENT),
      CROWN_HINTERLAND_PATROL_INTERACTION_ID,
    )!

    expect(worldObjectiveProgress(accepted, CROWN_HINTERLAND_PATROL_OBJECTIVE_ID)).toBe('active')
    expect(effectiveWorldObjectives(accepted, [patrolObjective])[0]).toMatchObject({
      destination: CROWN_HINTERLAND_PATROL,
      description: 'Reach the central road in Crown Hinterland.',
      completed: false,
      progress: 'active',
    })

    const arrived = advanceWorldObjectiveProgress({
      ...accepted,
      position: CROWN_HINTERLAND_PATROL,
    })
    expect(worldObjectiveProgress(arrived, CROWN_HINTERLAND_PATROL_OBJECTIVE_ID)).toBe('ready')
    expect(effectiveWorldObjectives(arrived, [patrolObjective])[0]).toMatchObject({
      destination: AURETH_SETTLEMENT,
      description: 'Return to the Aureth Crown settlement and report to the watch officer.',
      completed: false,
      progress: 'ready',
    })

    const returned = { ...arrived, position: AURETH_SETTLEMENT }
    expect(localWorldInteractions(returned)[0]).toMatchObject({
      actionLabel: 'Report back',
      progress: 'ready',
    })

    const completed = resolveWorldInteraction(returned, CROWN_HINTERLAND_PATROL_INTERACTION_ID)!
    expect(worldObjectiveProgress(completed, CROWN_HINTERLAND_PATROL_OBJECTIVE_ID)).toBe(
      'completed',
    )
    expect(completed.completedObjectives).toContain(CROWN_HINTERLAND_PATROL_OBJECTIVE_ID)
    expect(effectiveWorldObjectives(completed, [patrolObjective])[0]).toMatchObject({
      destination: null,
      autoPath: false,
      description: 'The Crown Hinterland patrol has been recorded.',
      completed: true,
      progress: 'completed',
    })
  })

  it('rejects the patrol interaction remotely or while travelling', () => {
    expect(
      resolveWorldInteraction(at(VERDANT_SETTLEMENT), CROWN_HINTERLAND_PATROL_INTERACTION_ID),
    ).toBeNull()

    const travelling = {
      ...at(AURETH_SETTLEMENT),
      route: [{ position: CROWN_HINTERLAND_PATROL, durationMs: 1100 }],
      nextStepAt: 2100,
    }
    expect(resolveWorldInteraction(travelling, CROWN_HINTERLAND_PATROL_INTERACTION_ID)).toBeNull()
  })

  it('identifies interaction-driven objectives so arrival cannot auto-complete them', () => {
    expect(isInteractionWorldObjectiveId(EASTERN_WATCH_OBJECTIVE_ID)).toBe(true)
    expect(isInteractionWorldObjectiveId(CROWN_HINTERLAND_PATROL_OBJECTIVE_ID)).toBe(true)
    expect(isInteractionWorldObjectiveId('last-survey')).toBe(false)
  })
})
