import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseAbilityDefinition } from './combat-definition'
import {
  identityCommand,
  identitySource,
  identityState,
  type IdentityRow,
} from './essence-resonance-identity.test-utils'
import {
  ap,
  commitRosterCommand,
  give,
  hasStatus,
  restoreRosterEncounter,
  unit,
} from './roster-outcome.test-utils'
import { prepareCombatAbilityCommand } from './combat-ability-command'

const candidate = JSON.parse(
  readFileSync(
    new URL(
      '../../../../docs/verification/release-assets/2026-10-29-field-remedy-recovery-candidate.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as {
  records: (IdentityRow & { before: IdentityRow['after'] })[]
  effectRequirementAudit: { kind: string; id: string }[]
}
const row = candidate.records[0]!

function setup(hp: number, historical = false) {
  const source = identitySource(historical ? { ...row, after: row.before } : row)
  const state = identityState([source])
  unit(state).hp = hp
  return { source, state }
}

it('appends the two reviewed definitions and scopes Field Remedy to its recovery gate', () => {
  expect(candidate.records).toHaveLength(2)
  expect(row.id).toBe('wildwarden.field-remedy')
  expect(row.before.contentVersion).toBe(7)
  expect(row.after.contentVersion).toBe(8)
  const expected = structuredClone(row.before)
  expected.contentVersion = 8
  Object.assign(expected, { flavorLine: 'Clear common afflictions and recover HP.' })
  Object.assign(expected, {
    ability: {
      ...expected.ability,
      behaviors: expected.ability.behaviors.map((behavior) => ({
        ...behavior,
        effects: behavior.effects.map((effect) =>
          effect.payload.type === 'percentage-recovery'
            ? { id: effect.id, payload: effect.payload }
            : effect,
        ),
      })),
    },
  })
  expect(row.after).toEqual(expected)
  expect(() => parseAbilityDefinition(row.after.ability)).not.toThrow()
  expect(row.after.ability.behaviors[0]!.requirements).toBeNull()
  expect(row.after.ability.behaviors[0]!.effects.map((effect) => effect.payload.type)).toEqual([
    'remove-status',
    'percentage-recovery',
  ])
  expect(candidate.effectRequirementAudit.filter((entry) => entry.kind === 'skill')).toHaveLength(
    12,
  )
  expect(candidate.effectRequirementAudit.filter((entry) => entry.kind === 'essence')).toHaveLength(
    3,
  )
  expect(candidate.effectRequirementAudit.filter((entry) => entry.kind === 'resonance')).toEqual([])
})

it.each([undefined, 'guarded', 'frozen'])(
  'recovers without a removable affliction, retaining unrelated %s status',
  (status) => {
    const { state, source } = setup(600)
    if (status) give(state, status, 'actor')
    const result = commitRosterCommand(identityCommand(state, source, { kind: 'self' }))
    expect(unit(result.state).hp).toBe(690)
    expect(ap(result.state)).toBe(55)
    expect(unit(result.state).mp).toBe(246)
    if (status) expect(hasStatus(result.state, status)).toBe(true)
    const retry = prepareCombatAbilityCommand(
      identityCommand(result.state, source, { kind: 'self' }),
    )
    expect(retry.evaluation.legal).toBe(false)
    expect(retry.evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'cooldown-active' }),
    )
  },
)

it.each(['burn', 'bleed', 'poison', 'slow', 'root', 'exposed', 'mark', 'challenged', 'suppress'])(
  'clears %s and then recovers HP from the immutable candidate',
  (status) => {
    const { state, source } = setup(600)
    give(state, status, 'actor')
    const restored = restoreRosterEncounter(state)
    const result = commitRosterCommand(identityCommand(restored, source, { kind: 'self' }))
    expect(hasStatus(result.state, status)).toBe(false)
    expect(unit(result.state).hp).toBe(690)
  },
)

it.each([990, 1000])('never exceeds maximum HP when starting at %s HP', (hp) => {
  const { state, source } = setup(hp)
  give(state, 'poison', 'actor')
  const result = commitRosterCommand(identityCommand(state, source, { kind: 'self' }))
  expect(unit(result.state).hp).toBe(unit(result.state).maxHp)
  expect(hasStatus(result.state, 'poison')).toBe(false)
  expect(ap(result.state)).toBe(55)
  expect(unit(result.state).mp).toBe(246)
})

it('retains the original recovery gate for historical v7 captures', () => {
  const { state, source } = setup(600, true)
  const result = commitRosterCommand(identityCommand(state, source, { kind: 'self' }))
  expect(unit(result.state).hp).toBe(600)
  expect(source.contentVersion).toBe(7)
  expect(source.definition).toEqual(row.before.ability)
})

it.each([600, 990, 1000])(
  'Dawn’s Oath restores unconditionally and caps at maximum from %s HP',
  (hp) => {
    const oath = candidate.records.find((entry) => entry.id === 'essence.dawnshield.dawns-oath')!
    expect(oath).toBeDefined()
    const source = identitySource(oath)
    const state = identityState([source])
    unit(state).hp = hp
    const result = commitRosterCommand(
      identityCommand(restoreRosterEncounter(state), source, {
        kind: 'unit',
        combatantId: 'actor',
      }),
    )
    expect(unit(result.state).hp).toBe(Math.min(1000, hp + 140))
    expect(ap(result.state)).toBe(35)
    expect(unit(result.state).mp).toBe(240)
    const retry = prepareCombatAbilityCommand(
      identityCommand(result.state, source, { kind: 'unit', combatantId: 'actor' }),
    )
    expect(retry.evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'cooldown-active' }),
    )
  },
)

it.each([
  'burn',
  'bleed',
  'poison',
  'slow',
  'root',
  'exposed',
  'mark',
  'challenged',
  'suppress',
  'frozen',
])('Dawn’s Oath retains cleanse semantics and recovery with %s', (status) => {
  const oath = candidate.records.find((entry) => entry.id === 'essence.dawnshield.dawns-oath')!
  const source = identitySource(oath)
  const state = identityState([source])
  unit(state).hp = 600
  give(state, status, 'actor')
  const result = commitRosterCommand(
    identityCommand(state, source, { kind: 'unit', combatantId: 'actor' }),
  )
  expect(unit(result.state).hp).toBe(740)
  expect(hasStatus(result.state, status)).toBe(status === 'frozen')
})

it('preserves Dawn’s Oath v7 gated recovery and exactly scopes the v8 definition', () => {
  const oath = candidate.records.find((entry) => entry.id === 'essence.dawnshield.dawns-oath')!
  const expected = structuredClone(oath.before)
  expected.contentVersion = 8
  Object.assign(expected, {
    flavorLine: 'Cleanse and shield a friendly, restoring health.',
    skill: { ...expected.skill, contentVersion: 8 },
  })
  const behavior = expected.ability.behaviors[0]!
  Object.assign(behavior, {
    effects: behavior.effects.map((effect) =>
      effect.payload.type === 'percentage-recovery'
        ? { id: effect.id, payload: effect.payload }
        : effect,
    ),
  })
  expect(oath.after).toEqual(expected)
  const source = identitySource({ ...oath, after: oath.before })
  const state = identityState([source])
  unit(state).hp = 600
  const result = commitRosterCommand(
    identityCommand(state, source, { kind: 'unit', combatantId: 'actor' }),
  )
  expect(unit(result.state).hp).toBe(600)
})

it.each([600, 990, 1000])(
  'Dawn’s Oath recovers an eligible ally from %s HP without an affliction',
  (hp) => {
    const oath = candidate.records.find((entry) => entry.id === 'essence.dawnshield.dawns-oath')!
    const source = identitySource(oath)
    const state = identityState([source])
    unit(state, 'ally').hp = hp
    const result = commitRosterCommand(
      identityCommand(state, source, { kind: 'unit', combatantId: 'ally' }),
    )
    expect(unit(result.state, 'ally').hp).toBe(Math.min(1000, hp + 140))
    expect(unit(result.state).hp).toBe(unit(state).hp)
    expect(ap(result.state)).toBe(35)
    expect(unit(result.state).mp).toBe(240)
  },
)
