import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

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

function action(
  effect: CombatEffectDefinition,
  id = 'test.current-poison',
): CombatActionDefinition {
  return {
    id,
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

const currentPoison: CombatEffectDefinition = {
  type: 'poison',
  recipient: 'primary-unit',
}

describe('current Poison runtime', () => {
  it('stores Poison in versioned effect state instead of the legacy timed status list', () => {
    const result = executeCombatAction(
      encounter(),
      action(currentPoison),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
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

  it('reapplication remains non-stacking and preserves movement progress', () => {
    const first = executeCombatAction(
      encounter(),
      action(currentPoison, 'test.poison-a'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const progressed = {
      ...first.state,
      effectState: {
        ...first.state.effectState!,
        poison: first.state.effectState!.poison.map((row) => ({ ...row, movementRemainder: 3 })),
      },
    }

    const reapplied = executeCombatAction(
      progressed,
      action(currentPoison, 'test.poison-b'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(reapplied.state.effectState?.poison).toEqual([
      {
        targetCombatantId: 'target',
        sourceCombatantId: 'actor',
        sourceActionId: 'test.poison-b',
        profileVersion: 1,
        movementRemainder: 3,
      },
    ])
  })

  it('deals the canonical 2 damage at each poisoned unit end-turn without expiring naturally', () => {
    const poisoned = executeCombatAction(
      encounter(),
      action(currentPoison),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    const targetTurn = endCombatTurn(poisoned.state, CONTENT)
    expect(targetTurn.state.tactical.battle.currentTurn?.combatantId).toBe('target')
    expect(targetTurn.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(
      30,
    )

    const firstTick = endCombatTurn(targetTurn.state, CONTENT)
    expect(firstTick.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(
      28,
    )
    expect(firstTick.state.effectState?.poison).toHaveLength(1)

    const secondTargetTurn = endCombatTurn(firstTick.state, CONTENT)
    const secondTick = endCombatTurn(secondTargetTurn.state, CONTENT)
    expect(secondTick.state.tactical.battle.combatants.find((row) => row.id === 'target')?.hp).toBe(
      26,
    )
    expect(secondTick.state.effectState?.poison).toHaveLength(1)
  })

  it('explicit Poison removal clears current state and a later fresh application restarts movement progress', () => {
    const poisoned = executeCombatAction(
      encounter(),
      action(currentPoison, 'test.poison-a'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const progressed = {
      ...poisoned.state,
      effectState: {
        ...poisoned.state.effectState!,
        poison: poisoned.state.effectState!.poison.map((row) => ({ ...row, movementRemainder: 4 })),
      },
    }

    const cleansed = executeCombatAction(
      progressed,
      action(
        { type: 'remove-status', recipient: 'primary-unit', statusIds: ['poison'] },
        'test.cleanse-poison',
      ),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    expect(cleansed.state.effectState?.poison).toEqual([])

    const fresh = executeCombatAction(
      cleansed.state,
      action(currentPoison, 'test.poison-b'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    expect(fresh.state.effectState?.poison[0]?.movementRemainder).toBe(0)
  })

  it('rejects invalid or duplicate current Poison encounter state', () => {
    const state = encounter()
    const issues = validateCombatEncounterState({
      ...state,
      effectState: {
        ongoingRecovery: [],
        poison: [
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'actor',
            sourceActionId: 'test.poison-a',
            profileVersion: 1,
            movementRemainder: 5,
          },
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'missing-source',
            sourceActionId: 'test.poison-b',
            profileVersion: 1,
            movementRemainder: 0,
          },
        ],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [],
      },
    })

    expect(issues.some((issue) => issue.field === 'effectState.poison')).toBe(true)
  })
})
