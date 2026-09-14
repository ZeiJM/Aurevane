import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-dot-contract',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 10,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 10,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: Array.from({ length: 3 }, (_, x) => ({
        position: { x, y: 0 },
        elevation: 0,
        terrainId: 'open',
      })),
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
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
    }),
  )
}

function action(effect: CombatEffectDefinition): CombatActionDefinition {
  return {
    id: 'test.current-poison',
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [effect],
  }
}

const currentPoison = {
  type: 'poison',
  recipient: 'primary-unit',
} as unknown as CombatEffectDefinition

describe('current Poison runtime', () => {
  it('stores Poison in versioned effect state instead of the legacy timed status list', () => {
    const result = executeCombatAction(
      encounter(),
      action(currentPoison),
      { kind: 'unit', combatantId: 'target' },
      { statuses: [] },
    )

    expect(result.state.effectState?.poison).toEqual([
      {
        targetCombatantId: 'target',
        sourceCombatantId: 'actor',
        sourceActionId: 'test.current-poison',
        profileVersion: 1,
        movementRemainder: 0,
      },
    ])
    expect(
      result.state.statusState.find((row) => row.combatantId === 'target')?.statuses ?? [],
    ).toEqual([])
  })
})
