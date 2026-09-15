import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
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

function encounter(): CombatEncounterState {
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

function historicalPersistentState(): CombatEncounterState {
  const poisoned = executeCombatAction(
    encounter(),
    poisonAction,
    { kind: 'unit', combatantId: 'target' },
    CONTENT,
  ).state
  const effects = normalizeCombatEffectState(poisoned.effectState)

  return {
    ...poisoned,
    statusState: poisoned.statusState.map((row) =>
      row.combatantId === 'target'
        ? {
            ...row,
            statuses: [
              {
                statusId: 'historical-status',
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 1,
                sourceCombatantId: 'actor',
              },
            ],
          }
        : row,
    ),
    effectState: {
      ...effects,
      ongoingRecovery: [
        {
          kind: 'hp',
          sourceCombatantId: 'actor',
          targetCombatantId: 'target',
          sourceActionId: 'test.k3.recovery',
          amountPerTick: 2,
          remainingFutureTicks: 1,
        },
      ],
      bleed: [
        {
          targetCombatantId: 'target',
          sourceCombatantId: 'actor',
          sourceActionId: 'test.k3.bleed',
          damagePerTick: 2,
          remainingTicks: 2,
          applicationOrder: 1,
        },
      ],
      burn: [
        {
          targetCombatantId: 'target',
          sourceCombatantId: 'actor',
          sourceActionId: 'test.k3.burn',
          profileVersion: 1,
          stage: 0,
        },
      ],
    },
  }
}

type PersistentFamily = 'status' | 'recovery' | 'poison' | 'bleed' | 'burn'

function withMalformedProvenance(family: PersistentFamily): CombatEncounterState {
  const historical = historicalPersistentState()
  const malformedProvenance = { instanceId: '' }

  if (family === 'status') {
    return {
      ...historical,
      statusState: historical.statusState.map((row) =>
        row.combatantId === 'target'
          ? {
              ...row,
              statuses: row.statuses.map((status) => ({
                ...status,
                provenance: malformedProvenance,
              })),
            }
          : row,
      ),
    } as unknown as CombatEncounterState
  }

  const effects = normalizeCombatEffectState(historical.effectState)
  if (family === 'recovery') {
    return {
      ...historical,
      effectState: {
        ...effects,
        ongoingRecovery: effects.ongoingRecovery.map((row) => ({
          ...row,
          provenance: malformedProvenance,
        })),
      },
    } as unknown as CombatEncounterState
  }
  if (family === 'poison') {
    return {
      ...historical,
      effectState: {
        ...effects,
        poison: effects.poison.map((instance) => ({
          ...instance,
          provenance: malformedProvenance,
        })),
      },
    } as unknown as CombatEncounterState
  }
  if (family === 'bleed') {
    return {
      ...historical,
      effectState: {
        ...effects,
        bleed: effects.bleed.map((stack) => ({
          ...stack,
          provenance: malformedProvenance,
        })),
      },
    } as unknown as CombatEncounterState
  }
  return {
    ...historical,
    effectState: {
      ...effects,
      burn: effects.burn.map((instance) => ({
        ...instance,
        provenance: malformedProvenance,
      })),
    },
  } as unknown as CombatEncounterState
}

describe('P4.K3 persistent effect provenance compatibility', () => {
  it('continues to validate historical persistent rows that omit K3 provenance', () => {
    expect(validateCombatEncounterState(historicalPersistentState())).toEqual([])
  })

  it.each<PersistentFamily>(['status', 'recovery', 'poison', 'bleed', 'burn'])(
    'fails closed when present %s provenance is malformed',
    (family) => {
      expect(validateCombatEncounterState(withMalformedProvenance(family))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.stringMatching(/provenance/i) }),
        ]),
      )
    },
  )
})
