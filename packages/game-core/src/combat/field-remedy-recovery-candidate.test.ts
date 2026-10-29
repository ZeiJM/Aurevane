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

it('appends only Field Remedy with unchanged execution except its recovery gate', () => {
  expect(candidate.records).toHaveLength(1)
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
