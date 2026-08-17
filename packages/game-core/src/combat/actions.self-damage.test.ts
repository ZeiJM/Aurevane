import { describe, expect, it } from 'vitest'

import { createPendingBattle, startBattle } from './battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  createTacticalBattleState,
} from './board'
import {
  P2_3_COMBAT_CONTENT,
  createCombatEncounterState,
  evaluateCombatAction,
  type CombatActionDefinition,
} from './actions'

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'p2-3-self-damage',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 7,
      combatants: [
        {
          id: 'wayfarer',
          teamId: 'players',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 5,
          baseMovementBudget: 3,
          hp: 80,
          maxHp: 80,
          mp: 10,
          maxMp: 10,
        },
      ],
    }),
  ).state

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: P2_2_VERTICAL_SLICE_TERRAINS,
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
        { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      ],
      movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
      placements: [
        {
          combatantId: 'wayfarer',
          position: { x: 0, y: 0 },
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
    }),
  )
}

describe('P2.3 self-damage lifecycle boundary', () => {
  it('rejects direct self-damage as a stable legality issue', () => {
    const action: CombatActionDefinition = {
      id: 'test.self-damage',
      version: 1,
      sourceType: 'test',
      tags: ['test'],
      target: {
        kind: 'self',
        teamPolicy: 'self',
        shape: { kind: 'single' },
        minimumRange: 0,
        maximumRange: 0,
        requiresLineOfSight: false,
        maximumElevationDifference: null,
        friendlyFire: 'allies-only',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'actor', amount: 100 }],
    }

    expect(
      evaluateCombatAction(encounter(), action, { kind: 'self' }, P2_3_COMBAT_CONTENT),
    ).toMatchObject({
      legal: false,
      issues: [expect.objectContaining({ code: 'self-damage-deferred' })],
    })
  })

  it('rejects area damage when the current actor is among affected units', () => {
    const action: CombatActionDefinition = {
      id: 'test.all-unit-burst',
      version: 1,
      sourceType: 'test',
      tags: ['test', 'area'],
      target: {
        kind: 'ground-tile',
        teamPolicy: 'any',
        shape: { kind: 'circle', radius: 1 },
        minimumRange: 0,
        maximumRange: 2,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        friendlyFire: 'all-units',
      },
      cost: { spendsAction: true, mp: 0 },
      requirements: [],
      effects: [{ type: 'damage', recipient: 'affected-units', amount: 10 }],
    }

    expect(
      evaluateCombatAction(
        encounter(),
        action,
        { kind: 'tile', position: { x: 0, y: 0 } },
        P2_3_COMBAT_CONTENT,
      ),
    ).toMatchObject({
      legal: false,
      issues: [expect.objectContaining({ code: 'self-damage-deferred' })],
    })
  })
})
