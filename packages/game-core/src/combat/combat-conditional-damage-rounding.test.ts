import { describe, expect, it } from 'vitest'
import {
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { applyCurrentBurnState } from './combat-dots'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { normalizeCombatRuntimeEncounterState } from './combat-runtime-state'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'
import { conditionalDamageMultiplier } from './damage-modifiers'

const target = { kind: 'unit' as const, combatantId: 'enemy' }
function attack(amount: number): CombatActionDefinition {
  return {
    id: 'test.conditional-rounding',
    version: 1,
    sourceType: 'test',
    tags: ['attack'],
    cost: { mp: 0, spendsAction: false },
    requirements: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      friendlyFire: 'enemies-only',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 4,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
    },
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }],
  }
}

function warded(stacks = 5, potencyBasisPoints = 5000, current = true): CombatEncounterState {
  let state: CombatEncounterState = {
    ...percentageDotEncounter(),
    percentageDotPolicyVersion: undefined,
    ...(current ? { conditionalDamageRoundingPolicyVersion: 1 as const } : {}),
  }
  state = applyCurrentBurnState(state, 'enemy', 'actor', 'test.burn', true, 1, 4)
  state.statusState.find((row) => row.combatantId === 'enemy')!.statuses = [
    {
      statusId: 'warded',
      statusVersion: 1,
      stacks,
      potencyBasisPoints,
      sourceCombatantId: 'enemy',
      remainingOwnerTurnStarts: 4,
    },
  ]
  return state
}

function assertDamage(state: CombatEncounterState, amount: number, damage: number) {
  const action = attack(amount)
  const before = JSON.stringify(state)
  expect(
    evaluateCombatAction(state, action, target, PV1F_COMBAT_CONTENT).projectedEffects,
  ).toContainEqual(
    expect.objectContaining({ effectType: 'damage', before: 1000, after: 1000 - damage }),
  )
  const result = executeCombatAction(state, action, target, PV1F_COMBAT_CONTENT)
  expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'enemy')!.hp).toBe(
    1000 - damage,
  )
  expect(JSON.stringify(state)).toBe(before)
  return result.state
}

describe('pinned conditional damage rounding', () => {
  it('keeps five 50% reductions exact until whole damage settles, including after reload', () => {
    const state = JSON.parse(JSON.stringify(warded())) as CombatEncounterState
    expect(normalizeCombatRuntimeEncounterState(state)).toHaveProperty(
      'conditionalDamageRoundingPolicyVersion',
      1,
    )
    expect(validateCombatEncounterState(state)).toEqual([])
    const result = assertDamage(state, 32, 1)
    expect(result).toHaveProperty('conditionalDamageRoundingPolicyVersion', 1)
  })

  it('retains the captured integer-basis-point calculation when the policy is absent', () => {
    const state = warded(5, 5000, false)
    expect(conditionalDamageMultiplier(state, 'actor', 'enemy', PV1F_COMBAT_CONTENT)).toBe(312)
    assertDamage(state, 32, 0)
    expect(state).not.toHaveProperty('conditionalDamageRoundingPolicyVersion')
  })

  it.each([
    [5000, 5],
    [10000, 0],
  ])('preserves a single %s basis-point Burn Ward on eleven damage', (potency, damage) => {
    assertDamage(warded(1, potency), 11, damage)
  })

  it('requires active Burn for the reduction', () => {
    const state = warded()
    state.effectState!.burn = []
    assertDamage(state, 32, 32)
  })

  it('rounds exact conditional modifiers together with Suppress', () => {
    const state = warded()
    state.statusState.find((row) => row.combatantId === 'actor')!.statuses = [
      {
        statusId: 'suppress',
        statusVersion: 1,
        stacks: 1,
        potencyBasisPoints: 5000,
        sourceCombatantId: 'enemy',
        remainingOwnerTurnStarts: 4,
      },
    ]
    assertDamage(state, 64, 1)
  })

  it.each([
    [true, 493],
    [false, 492],
  ])('preserves exact Inspired applications only in the current policy (%s)', (current, damage) => {
    const state: CombatEncounterState = {
      ...percentageDotEncounter(),
      ...(current ? { conditionalDamageRoundingPolicyVersion: 1 as const } : {}),
    }
    state.statusState.find((row) => row.combatantId === 'actor')!.statuses = [
      {
        statusId: 'inspired',
        statusVersion: 1,
        stacks: 7,
        potencyBasisPoints: 1000,
        sourceCombatantId: 'actor',
        remainingOwnerTurnStarts: 4,
      },
    ]
    assertDamage(state, 253, damage)
  })

  it.each([0, 2, '1'])('rejects unsupported persisted rounding policy %s', (policy) => {
    const state = { ...warded(), conditionalDamageRoundingPolicyVersion: policy }
    expect(() => normalizeCombatRuntimeEncounterState(state as CombatEncounterState)).toThrow(
      'conditionalDamageRoundingPolicyVersion',
    )
  })
})
