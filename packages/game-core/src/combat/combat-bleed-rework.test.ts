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
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-bleed-contract',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 211,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 5,
          hp: 40,
          maxHp: 40,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 5,
          hp: 40,
          maxHp: 40,
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

function finishTurn(state: CombatEncounterState): CombatEncounterState {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  return endCombatTurn({ ...state, tactical: faced.state }, CONTENT).state
}

function action(effect: CombatEffectDefinition, id: string): CombatActionDefinition {
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

function bleed(damagePerTick: number, ticks: number): CombatEffectDefinition {
  return {
    type: 'bleed',
    recipient: 'primary-unit',
    damagePerTick,
    ticks,
  } as unknown as CombatEffectDefinition
}

function apply(
  state: CombatEncounterState,
  damagePerTick: number,
  ticks: number,
  id: string,
): CombatEncounterState {
  return executeCombatAction(
    state,
    action(bleed(damagePerTick, ticks), id),
    { kind: 'unit', combatantId: 'target' },
    CONTENT,
  ).state
}

function targetHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((row) => row.id === 'target')!.hp
}

describe('current Bleed runtime', () => {
  it('stores independent stacks with stable application order', () => {
    let state = apply(encounter(), 5, 1, 'test.bleed.one')
    state = apply(state, 4, 2, 'test.bleed.two')
    state = apply(state, 3, 3, 'test.bleed.three')

    expect(state.effectState?.bleed).toEqual([
      expect.objectContaining({
        sourceActionId: 'test.bleed.one',
        damagePerTick: 5,
        remainingTicks: 1,
        applicationOrder: 1,
      }),
      expect.objectContaining({
        sourceActionId: 'test.bleed.two',
        damagePerTick: 4,
        remainingTicks: 2,
        applicationOrder: 2,
      }),
      expect.objectContaining({
        sourceActionId: 'test.bleed.three',
        damagePerTick: 3,
        remainingTicks: 3,
        applicationOrder: 3,
      }),
    ])
    expect(state.statusState.find((row) => row.combatantId === 'target')?.statuses ?? []).toEqual(
      [],
    )
  })

  it('ticks stacks independently and expires each stack on its own timer', () => {
    let state = apply(encounter(), 5, 1, 'test.bleed.one')
    state = apply(state, 4, 2, 'test.bleed.two')

    state = finishTurn(state)
    state = finishTurn(state)
    expect(targetHp(state)).toBe(31)
    expect(state.effectState?.bleed).toEqual([
      expect.objectContaining({ sourceActionId: 'test.bleed.two', remainingTicks: 1 }),
    ])

    state = finishTurn(state)
    state = finishTurn(state)
    expect(targetHp(state)).toBe(27)
    expect(state.effectState?.bleed).toEqual([])
  })

  it('replaces the fewest-remaining stack and breaks ties by oldest application', () => {
    let state = apply(encounter(), 3, 2, 'test.bleed.oldest-two')
    state = apply(state, 2, 2, 'test.bleed.newer-two')
    state = apply(state, 2, 4, 'test.bleed.four')
    state = apply(state, 3, 3, 'test.bleed.replacement')

    expect(state.effectState?.bleed.map((row) => row.sourceActionId)).toEqual([
      'test.bleed.newer-two',
      'test.bleed.four',
      'test.bleed.replacement',
    ])
    expect(state.effectState?.bleed.map((row) => row.applicationOrder)).toEqual([2, 3, 4])
  })

  it('Cleanse removes every current Bleed stack', () => {
    let state = apply(encounter(), 5, 1, 'test.bleed.one')
    state = apply(state, 4, 2, 'test.bleed.two')
    state = executeCombatAction(
      state,
      action(
        { type: 'remove-status', recipient: 'primary-unit', statusIds: ['bleed'] },
        'test.cleanse-bleed',
      ),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    ).state

    expect(state.effectState?.bleed).toEqual([])
  })

  it('rejects authored Bleed outside 1-4 ticks or above 10 raw total', () => {
    expect(() => validateCombatActionDefinition(action(bleed(4, 3), 'test.invalid-total'))).toThrow(
      /Bleed raw per-stack total must not exceed 10 damage/,
    )
    expect(() =>
      validateCombatActionDefinition(action(bleed(2, 5), 'test.invalid-duration')),
    ).toThrow(/Bleed duration ticks must be an integer between 1 and 4/)
    expect(() =>
      validateCombatActionDefinition(action(bleed(2, 4), 'test.valid-bleed')),
    ).not.toThrow()
  })

  it('rejects malformed current Bleed encounter state', () => {
    const state = encounter()
    const issues = validateCombatEncounterState({
      ...state,
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [
          {
            targetCombatantId: 'target',
            sourceCombatantId: 'actor',
            sourceActionId: 'test.invalid',
            damagePerTick: 4,
            remainingTicks: 3,
            applicationOrder: 1,
          },
        ],
        burn: [],
        temporarySkills: [],
        damageHistory: [],
      },
    })

    expect(issues.some((issue) => issue.field === 'effectState.bleed')).toBe(true)
  })

  it('preserves legacy Bleed status decoding separately from current Bleed state', () => {
    const legacy = executeCombatAction(
      encounter(),
      action(
        { type: 'apply-status', recipient: 'primary-unit', statusId: 'bleed', stacks: 1 },
        'test.legacy-bleed',
      ),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(legacy.state.effectState?.bleed ?? []).toEqual([])
    expect(legacy.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual([
      expect.objectContaining({ statusId: 'bleed' }),
    ])
  })
})
