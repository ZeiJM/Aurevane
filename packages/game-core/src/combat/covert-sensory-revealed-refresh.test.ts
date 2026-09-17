import { describe, expect, it } from 'vitest'

import { createCombatEncounterState, executeCombatAction, type CombatActionDefinition } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createCovertStatusDefinition,
  createRevealedStatusDefinition,
} from './covert-sensory-revealed'

const covert = createCovertStatusDefinition(3)
const revealed = createRevealedStatusDefinition(2)
const content = { statuses: [covert, revealed] }

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:csr1-revealed-refresh',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x13572468,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
    ],
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [
      {
        combatantId: 'actor',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'ground',
      },
      {
        combatantId: 'target',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'ground',
      },
    ],
  })
  const state = createCombatEncounterState(tactical, [
    { combatantId: 'actor', statuses: [] },
    {
      combatantId: 'target',
      statuses: [
        {
          statusId: 'covert',
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 3,
          sourceCombatantId: 'target',
        },
        {
          statusId: 'revealed',
          statusVersion: 1,
          stacks: 1,
          remainingOwnerTurnStarts: 1,
          sourceCombatantId: 'actor',
        },
      ],
    },
  ])
  return {
    ...state,
    effectState: {
      ongoingRecovery: [
        {
          kind: 'hp' as const,
          sourceCombatantId: 'target',
          targetCombatantId: 'target',
          sourceActionId: 'test.regeneration-schedule',
          amountPerTick: 4,
          remainingFutureTicks: 2,
        },
      ],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    },
  }
}

const sensory: CombatActionDefinition = {
  id: 'test.sensory-refresh',
  version: 1,
  sourceType: 'test',
  tags: ['test', 'sensory'],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 1,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: 1,
    friendlyFire: 'enemies-only',
  },
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  effects: [
    {
      type: 'sensory',
      recipient: 'primary-unit',
      revealedDurationOwnerTurnStarts: 2,
    },
  ],
}

describe('CSR-1 Revealed refresh boundary', () => {
  it('refreshes existing Revealed and preserves scheduled recovery when Sensory removes Covert', () => {
    const before = encounter()
    const transition = executeCombatAction(
      before,
      sensory,
      { kind: 'unit', combatantId: 'target' },
      content,
    )
    const statuses =
      transition.state.statusState.find((row) => row.combatantId === 'target')?.statuses ?? []

    expect(statuses).toEqual([
      {
        statusId: 'revealed',
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: 'actor',
      },
    ])
    expect(transition.state.effectState?.ongoingRecovery).toEqual(before.effectState.ongoingRecovery)
    expect(transition.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'status_removed', statusId: 'covert' }),
        expect.objectContaining({
          event: 'status_applied',
          statusId: 'revealed',
          refreshed: true,
          remainingOwnerTurnStarts: 2,
        }),
      ]),
    )
  })
})
