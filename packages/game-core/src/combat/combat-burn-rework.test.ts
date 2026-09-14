import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEffectDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-burn-contract',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 73,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 4,
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

function action(effect: CombatEffectDefinition, id = 'test.current-burn'): CombatActionDefinition {
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

const currentBurn = {
  type: 'burn',
  recipient: 'primary-unit',
} as unknown as CombatEffectDefinition

function finishTurn(state: CombatEncounterState, facing: 'east' | 'west' = 'east') {
  const faced = selectCurrentFinalFacing(state.tactical, facing)
  return endCombatTurn({ ...state, tactical: faced.state }, CONTENT)
}

function targetHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((combatant) => combatant.id === 'target')!.hp
}

describe('current Burn pressure runtime', () => {
  it('stores one current Burn instance separately from the legacy timed Burn status', () => {
    const result = executeCombatAction(
      encounter(),
      action(currentBurn),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(result.state.effectState?.burn).toEqual([
      {
        targetCombatantId: 'target',
        sourceCombatantId: 'actor',
        sourceActionId: 'test.current-burn',
        profileVersion: 1,
        stage: 0,
      },
    ])
    expect(
      result.state.statusState.find((row) => row.combatantId === 'target')?.statuses ?? [],
    ).toEqual([])
  })

  it('deals the canonical 4 then 3 then 2 damage on target end-turns and expires', () => {
    const burned = executeCombatAction(
      encounter(),
      action(currentBurn),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    const targetTurn1 = finishTurn(burned.state)
    const tick1 = finishTurn(targetTurn1.state, 'west')
    expect(targetHp(tick1.state)).toBe(26)
    expect(tick1.state.effectState?.burn[0]?.stage).toBe(1)

    const targetTurn2 = finishTurn(tick1.state)
    const tick2 = finishTurn(targetTurn2.state, 'west')
    expect(targetHp(tick2.state)).toBe(23)
    expect(tick2.state.effectState?.burn[0]?.stage).toBe(2)

    const targetTurn3 = finishTurn(tick2.state)
    const tick3 = finishTurn(targetTurn3.state, 'west')
    expect(targetHp(tick3.state)).toBe(21)
    expect(tick3.state.effectState?.burn).toEqual([])
  })

  it('reapplication restarts the 4 -> 3 -> 2 sequence instead of stacking', () => {
    const first = executeCombatAction(
      encounter(),
      action(currentBurn, 'test.burn-a'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const targetTurn = finishTurn(first.state)
    const afterFirstTick = finishTurn(targetTurn.state, 'west')
    expect(targetHp(afterFirstTick.state)).toBe(26)
    expect(afterFirstTick.state.effectState?.burn[0]?.stage).toBe(1)

    const reapplied = executeCombatAction(
      afterFirstTick.state,
      action(currentBurn, 'test.burn-b'),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    expect(reapplied.state.effectState?.burn).toEqual([
      expect.objectContaining({ sourceActionId: 'test.burn-b', stage: 0 }),
    ])

    const targetTurnAgain = finishTurn(reapplied.state)
    const restartedTick = finishTurn(targetTurnAgain.state, 'west')
    expect(targetHp(restartedTick.state)).toBe(22)
    expect(restartedTick.state.effectState?.burn[0]?.stage).toBe(1)
  })

  it('Cleanse removes the current Burn instance', () => {
    const burned = executeCombatAction(
      encounter(),
      action(currentBurn),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const cleansed = executeCombatAction(
      burned.state,
      action(
        { type: 'remove-status', recipient: 'primary-unit', statusIds: ['burn'] },
        'test.cleanse-burn',
      ),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(cleansed.state.effectState?.burn).toEqual([])
    expect(cleansed.events).toContainEqual(
      expect.objectContaining({ event: 'status_removed', statusId: 'burn' }),
    )
  })

  it('rejects duplicate or out-of-range current Burn state', () => {
    const state = encounter()
    const issues = validateCombatEncounterState({
      ...state,
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'actor',
            sourceActionId: 'test.burn-a',
            profileVersion: 1,
            stage: 3,
          },
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'actor',
            sourceActionId: 'test.burn-b',
            profileVersion: 1,
            stage: 0,
          },
        ],
        temporarySkills: [],
        damageHistory: [],
      },
    })

    expect(issues.some((issue) => issue.field === 'effectState.burn')).toBe(true)
  })

  it('preserves historical apply-status Burn independently from current Burn state', () => {
    const legacy = executeCombatAction(
      encounter(),
      action({ type: 'apply-status', recipient: 'primary-unit', statusId: 'burn', stacks: 1 }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(legacy.state.effectState?.burn ?? []).toEqual([])
    expect(
      legacy.state.statusState.find((row) => row.combatantId === 'target')?.statuses,
    ).toContainEqual(expect.objectContaining({ statusId: 'burn' }))
  })
})
