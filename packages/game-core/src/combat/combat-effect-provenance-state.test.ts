import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { normalizeCombatEffectState } from './combat-effect-state'

const CONTENT = { statuses: [] }

const poisonAction: CombatActionDefinition = {
  id: 'test.k3.poison',
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
  effects: [{ type: 'poison', recipient: 'primary-unit' }],
}

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k3-provenance-state',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 20,
          maxHp: 20,
          mp: 10,
          maxMp: 10,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 3,
          hp: 20,
          maxHp: 20,
          mp: 10,
          maxMp: 10,
        },
      ],
    }),
  ).state

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
      ],
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

function historicalPoisonState() {
  return executeCombatAction(
    encounter(),
    poisonAction,
    { kind: 'unit', combatantId: 'target' },
    CONTENT,
  ).state
}

describe('P4.K3 persistent effect provenance compatibility', () => {
  it('continues to validate historical effect rows that omit K3 provenance', () => {
    expect(validateCombatEncounterState(historicalPoisonState())).toEqual([])
  })

  it('fails closed when present persisted effect provenance is malformed', () => {
    const historical = historicalPoisonState()
    const effects = normalizeCombatEffectState(historical.effectState)
    const malformed = {
      ...historical,
      effectState: {
        ...effects,
        poison: effects.poison.map((instance) => ({
          ...instance,
          provenance: { instanceId: '' },
        })),
      },
    }

    expect(validateCombatEncounterState(malformed)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: expect.stringMatching(/provenance/i) }),
      ]),
    )
  })
})
