import { describe, expect, it } from 'vitest'
import {
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'

function encounter(policy = true): CombatEncounterState {
  const state = percentageDotEncounter()
  return {
    ...state,
    ...(policy ? { skillPacketPolicyVersion: 1 } : {}),
    statBalancePolicyVersion: 1,
    statBridge: {
      ...state.statBridge,
      schemaVersion: 4,
      rulesVersion: 4,
      combatants: state.statBridge.combatants.map((profile) => ({
        ...profile,
        level: 1,
        criticalChance: profile.combatantId === 'actor' ? 7500 : 0,
        statusResistance: 1500,
        accuracy: 5000,
      })),
    },
  }
}
const action: CombatActionDefinition = {
  id: 'test.sevenfold',
  version: 1,
  sourceType: 'discipline-skill',
  tags: ['attack'],
  accuracyMode: 'per-target',
  cost: { mp: 3, spendsAction: false },
  requirements: [],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 0,
    maximumRange: 5,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  effects: Array.from({ length: 7 }, () => ({
    type: 'damage' as const,
    recipient: 'primary-unit' as const,
    amount: 9,
  })),
}
const cast = (state: CombatEncounterState, definition = action) =>
  executeCombatAction(state, definition, { kind: 'unit', combatantId: 'enemy' }, { statuses: [] })

describe('pinned independent repeated Skill packets', () => {
  it('draws independent accuracy and criticals, spends MP once, and survives reload', () => {
    const state = JSON.parse(JSON.stringify(encounter())) as CombatEncounterState
    expect(validateCombatEncounterState(state)).toEqual([])
    const result = cast(state)
    const accuracy = result.events.filter((event) => event.event === 'combat_accuracy_resolved')
    expect(accuracy).toHaveLength(7)
    expect(accuracy.some((event) => event.hit)).toBe(true)
    expect(accuracy.some((event) => !event.hit)).toBe(true)
    const hits = accuracy.filter((event) => event.hit).length
    const criticals = result.events.filter((event) => event.event === 'combat_critical_resolved')
    expect(criticals).toHaveLength(hits)
    expect(result.events.filter((event) => event.event === 'damage_applied')).toHaveLength(hits)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.mp).toBe(17)
    expect(cast(state)).toEqual(result)
  })
  it('keeps historical multi-hit accuracy shared', () => {
    const result = cast(encounter(false))
    expect(
      result.events.filter((event) => event.event === 'combat_accuracy_resolved'),
    ).toHaveLength(1)
    expect(
      result.events.filter((event) => event.event === 'combat_critical_resolved').length,
    ).toBeLessThanOrEqual(1)
  })
  it('rolls applicable resistance independently after each successful duplicated tag', () => {
    const state = encounter()
    state.statBridge!.combatants.forEach((profile) => {
      Object.assign(profile, { accuracy: 10000 })
    })
    const result = cast(state, {
      ...action,
      effects: Array.from({ length: 8 }, () => ({
        type: 'bleed' as const,
        recipient: 'primary-unit' as const,
        damagePerTick: 1,
        ticks: 2,
      })),
    })
    const resistance = result.events.filter(
      (event) => event.event === 'combat_status_resistance_resolved',
    )
    expect(resistance).toHaveLength(8)
    expect(new Set(resistance.map((event) => event.rollBasisPoints)).size).toBeGreaterThan(1)
    const landed = resistance.filter((event) => !event.resisted).length
    expect(result.state.effectState?.bleed).toHaveLength(landed)
  })
  it('rejects unknown or incompatible packet policy snapshots', () => {
    for (const state of [
      { ...encounter(), skillPacketPolicyVersion: 2 },
      { ...encounter(), statBridge: { ...encounter().statBridge!, rulesVersion: 3 } },
    ])
      expect(
        validateCombatEncounterState(state as CombatEncounterState).some(
          (issue) => issue.field === 'skillPacketPolicyVersion',
        ),
      ).toBe(true)
  })
})

it('does not let dependent bonus damage confirm its own prerequisite hit or consume bonus RNG', () => {
  const initial = encounter()
  initial.statBridge!.combatants.forEach((p) => Object.assign(p, { criticalChance: 0 }))
  const result = executeCombatAction(
    initial,
    { ...action, effects: action.effects.slice(0, 5) },
    { kind: 'unit', combatantId: 'enemy' },
    { statuses: [] },
    undefined,
    { effectOrdinals: [1, 2, 3, 4] },
  )
  expect(result.hitDependentEffectsActivated).toBe(false)
  expect(result.events.filter((e) => e.event === 'combat_accuracy_resolved')).toHaveLength(1)
  expect(result.events.filter((e) => e.event === 'damage_applied')).toHaveLength(0)
  expect(result.state.tactical.battle.rng.draws - initial.tactical.battle.rng.draws).toBe(1)
})
