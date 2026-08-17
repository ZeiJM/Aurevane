import { describe, expect, it } from 'vitest'

import { createPendingBattle, startBattle } from './battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
  type CombatTile,
} from './board'
import {
  P2_3_COMBAT_CONTENT,
  createCombatEncounterState,
  evaluateCombatAction,
  type CombatActionDefinition,
} from './actions'

const groundStrike: CombatActionDefinition = {
  id: 'test.single-enemy-ground',
  version: 1,
  sourceType: 'test',
  tags: ['test', 'damage'],
  target: {
    kind: 'ground-tile',
    teamPolicy: 'any',
    shape: { kind: 'single' },
    minimumRange: 1,
    maximumRange: 2,
    requiresLineOfSight: false,
    maximumElevationDifference: 1,
    friendlyFire: 'enemies-only',
  },
  cost: { spendsAction: true, mp: 0 },
  requirements: [],
  effects: [{ type: 'damage', recipient: 'affected-units', amount: 10 }],
}

function createEncounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'p2-3-friendly-fire',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x12345678,
      combatants: [
        {
          id: 'wayfarer',
          teamId: 'players',
          initiative: 12,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'ally',
          teamId: 'players',
          initiative: 8,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 4,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 30,
          maxMp: 30,
        },
      ],
    }),
  ).state

  const tiles: CombatTile[] = [0, 1, 2].map((x) => ({
    position: { x, y: 0 },
    elevation: 0,
    terrainId: 'open-ground',
  }))

  const tactical = createTacticalBattleState({
    battle,
    width: 3,
    height: 1,
    terrains: P2_2_VERTICAL_SLICE_TERRAINS,
    tiles,
    movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
    placements: [
      {
        combatantId: 'wayfarer',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'ordinary-ground',
      },
      {
        combatantId: 'ally',
        position: { x: 1, y: 0 },
        facing: 'east',
        movementProfileId: 'ordinary-ground',
      },
      {
        combatantId: 'recruit',
        position: { x: 2, y: 0 },
        facing: 'west',
        movementProfileId: 'ordinary-ground',
      },
    ],
  })

  return createCombatEncounterState(tactical)
}

describe('P2.3 single-tile friendly-fire policy', () => {
  it('filters an ally from enemies-only affected-unit effects', () => {
    const evaluation = evaluateCombatAction(
      createEncounter(),
      groundStrike,
      { kind: 'tile', position: { x: 1, y: 0 } },
      P2_3_COMBAT_CONTENT,
    )

    expect(evaluation).toMatchObject({
      legal: false,
      affectedCombatantIds: [],
      issues: expect.arrayContaining([expect.objectContaining({ code: 'effect-target-missing' })]),
    })
  })

  it('keeps an enemy on the same single-tile policy as a legal affected unit', () => {
    const evaluation = evaluateCombatAction(
      createEncounter(),
      groundStrike,
      { kind: 'tile', position: { x: 2, y: 0 } },
      P2_3_COMBAT_CONTENT,
    )

    expect(evaluation).toMatchObject({
      legal: true,
      primaryCombatantId: 'recruit',
      affectedCombatantIds: ['recruit'],
      issues: [],
    })
  })
})
