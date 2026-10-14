import { validateCombatAbilityState } from './combat-ability-state'
import { reconcileCombatAbilitySources } from './combat-behavior-runtime'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { describe, expect, it } from 'vitest'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { validateAbilityDefinition } from './combat-definition'

import { source } from './combat-behavior.test-utils'

describe('private canonical execution capture', () => {
  it('capture_cannot_change_in_place detaches and freezes every execution field', () => {
    const original = source({
      activationLimits: ['once-per-battle'],
      accuracy: { kind: 'fixed', chanceBasisPoints: 0 },
    })
    const captured = captureCombatAbilitySource(original)
    expect(captured).toEqual(original)
    expect(captured).not.toBe(original)
    expect(Object.isFrozen(captured.definition.behaviors[0]!.effects[0]!.payload)).toBe(true)
    expect(() => Object.assign(captured.definition.behaviors[0]!, { costs: [] })).toThrow()
    Object.assign(original.definition.behaviors[0]!, { costs: [] })
    expect(captured.definition.behaviors[0]!.costs).toHaveLength(3)
  })
  it('capture_persistence retains private accuracy and activation scopes across JSON reconnect', () => {
    const captured = captureCombatAbilitySource(
      source({
        activationLimits: ['once-per-owner-turn', 'once-per-round'],
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      }),
    )
    const restored = captureCombatAbilitySource(JSON.parse(JSON.stringify(captured)))
    expect(restored).toEqual(captured)
    expect(restored.definition.behaviors[0]!.accuracy).toEqual({
      kind: 'fixed',
      chanceBasisPoints: 10000,
    })
  })
  it('capture rejects malformed present envelopes and invalid identity/version', () => {
    expect(() => captureCombatAbilitySource({ ...source(), definition: null } as never)).toThrow()
    expect(() => captureCombatAbilitySource({ ...source(), contentVersion: 0 })).toThrow()
    expect(() => captureCombatAbilitySource({ ...source(), ownerCombatantId: '' })).toThrow()
  })
  it('ongoing continuous packets stay unsupported by the canonical producer', () => {
    for (const payload of [
      { type: 'damage', recipient: 'actor', amount: 1 },
      { type: 'healing', recipient: 'actor', amount: 1 },
      { type: 'apply-status', recipient: 'actor', statusId: 'suppress', stacks: 1 },
    ]) {
      const value = source({
        activation: 'ongoing',
        mode: 'modifier',
        targeting: null,
        costs: [],
        effects: [{ id: 'unsupported', payload } as never],
      })
      expect(validateAbilityDefinition(value.definition)).toContainEqual(
        expect.objectContaining({ code: 'unsupported-combination' }),
      )
    }
  })
})

it('restored condition truth admits only unique exact known Automatic action entries', () => {
  const captured = captureCombatAbilitySource(
    source({ activation: 'automatic', automaticTarget: { subject: 'owner' } }),
  )
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [captured])
  const valid = {
    sourceInstanceId: captured.sourceInstanceId,
    behaviorId: captured.definition.behaviors[0]!.id,
    holds: false,
  }
  const withTruth = (conditionTruth: unknown) =>
    ({ ...state, abilityRuntime: { ...state.abilityRuntime!, conditionTruth } }) as never
  expect(validateCombatAbilityState(withTruth([valid]))).toEqual([])
  for (const bad of [
    null,
    [valid, valid],
    [{ ...valid, holds: 1 }],
    [{ ...valid, sourceInstanceId: 'unknown' }],
    [{ ...valid, behaviorId: 'unknown' }],
    [{ ...valid, extra: true }],
  ])
    expect(validateCombatAbilityState(withTruth(bad)).length).toBeGreaterThan(0)
  expect(validateCombatAbilityState(JSON.parse(JSON.stringify(withTruth([valid]))))).toEqual([])
})

it('restored usage and maintenance reject foreign, duplicate and malformed inventory authority', () => {
  const captured = captureCombatAbilitySource(source())
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [captured])
  const valid = {
    key: JSON.stringify([
      state.tactical.battle.battleId,
      captured.sourceInstanceId,
      captured.ownerCombatantId,
      captured.abilityId,
      captured.contentVersion,
      captured.definition.behaviors[0]!.id,
    ]),
    rootActionId: 'original-root',
    commandId: 'original-root',
    ownerCycle: 0,
    round: state.tactical.battle.round,
    battleId: state.tactical.battle.battleId,
  }
  const withUsage = (usage: unknown) =>
    ({ ...state, abilityRuntime: { ...state.abilityRuntime!, usage } }) as never
  expect(validateCombatAbilityState(withUsage([valid]))).toEqual([])
  for (const usage of [
    [null],
    [valid, valid],
    [{ ...valid, key: 'foreign' }],
    [{ ...valid, battleId: 'foreign' }],
    [{ ...valid, rootActionId: '' }],
    [{ ...valid, commandId: 3 }],
    [{ ...valid, ownerCycle: -1 }],
    [{ ...valid, ownerCycle: state.tactical.battle.turnNumber + 1 }],
    [{ ...valid, round: 1.5 }],
    [{ ...valid, extra: true }],
    [{ ...valid, pendingRootActionIds: ['foreign'] }],
    [{ ...valid, pendingRootActionIds: ['original-root', 'original-root'] }],
  ])
    expect(validateCombatAbilityState(withUsage(usage)).length).toBeGreaterThan(0)
  for (const maintained of [
    [null],
    [
      {
        sourceInstanceId: captured.sourceInstanceId,
        ownerCombatantId: 'actor',
        behaviorId: 'root',
        effectId: 'missing',
        multiplierBasisPoints: 13000,
      },
    ],
  ])
    expect(
      validateCombatAbilityState({
        ...state,
        abilityRuntime: { ...state.abilityRuntime!, maintained },
      } as never).length,
    ).toBeGreaterThan(0)
})

it('maintenance restore matches the exact active captured Ongoing contribution', () => {
  const captured = captureCombatAbilitySource(
    source({
      activation: 'ongoing',
      mode: 'modifier',
      classification: 'utility',
      attackFamily: undefined,
      targeting: null,
      costs: [],
      effects: [
        {
          id: 'bonus',
          payload: { type: 'damage-bonus', recipient: 'actor', multiplierBasisPoints: 13000 },
        },
      ],
    }),
  )
  const state = reconcileCombatAbilitySources(percentageDotEncounter(), [captured])
  const row = state.abilityRuntime!.maintained[0]!
  expect(row).toBeDefined()
  expect(validateCombatAbilityState(JSON.parse(JSON.stringify(state)))).toEqual([])
  for (const maintained of [
    [row, row],
    [{ ...row, ownerCombatantId: 'enemy' }],
    [{ ...row, effectId: 'foreign' }],
    [{ ...row, multiplierBasisPoints: 14000 }],
    [{ ...row, extra: true }],
  ])
    expect(
      validateCombatAbilityState({
        ...state,
        abilityRuntime: { ...state.abilityRuntime!, maintained },
      } as never).length,
    ).toBeGreaterThan(0)
  expect(
    validateCombatAbilityState({
      ...state,
      abilityRuntime: { ...state.abilityRuntime!, activeSourceIds: [] },
    }).length,
  ).toBeGreaterThan(0)
})
