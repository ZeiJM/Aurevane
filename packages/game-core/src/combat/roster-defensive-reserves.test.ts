import { expect, it } from 'vitest'
import { prepareCombatAbilityCommand, commitCombatAbilityCommand } from './combat-ability-command'
import {
  fixture,
  input,
  unit,
  ap,
  give,
  hasStatus,
  commitRosterCommand as cast,
  restoreRosterEncounter as restored,
  advanceRosterTurns as nextTurns,
} from './roster-outcome.test-utils'

it.each(['bastion.hold-fast', 'essence.bastion.last-bastion'])(
  '%s is a finite emergency reserve across cooldown expiry and JSON restoration',
  (id) => {
    const state = fixture([id])
    unit(state).hp = 200
    const first = cast(input(state, id, { kind: 'self' }))
    expect(unit(first.state).hp).toBeGreaterThan(200)
    const later = restored(nextTurns(first.state, 16))
    unit(later).hp = 200
    const command = input(later, id, { kind: 'self' })
    const before = JSON.stringify(later)
    const quote = prepareCombatAbilityCommand(command)
    expect(quote.evaluation.legal).toBe(false)
    expect(quote.evaluation.issues).toContainEqual(
      expect.objectContaining({ code: 'activation-limit' }),
    )
    expect(() => commitCombatAbilityCommand(command)).toThrow()
    expect(JSON.stringify(later)).toBe(before)
  },
)

it.each(['wildwarden.field-remedy', 'essence.dawnshield.dawns-oath'])(
  '%s preserves its repair action but heals only when an actual removable affliction was present',
  (id) => {
    const state = fixture([id])
    unit(state).hp = 600
    give(state, 'guarded', 'actor')
    const before = JSON.stringify(state)
    const command = input(state, id, { kind: 'self' })
    const result = cast(command)
    expect(unit(result.state).hp).toBe(600)
    expect(JSON.stringify(state)).toBe(before)
    expect(ap(result.state)).toBe(id === 'wildwarden.field-remedy' ? 55 : 35)
    expect(unit(result.state).mp).toBe(id === 'wildwarden.field-remedy' ? 16 : 10)
  },
)

it.each(
  ['wildwarden.field-remedy', 'essence.dawnshield.dawns-oath'].flatMap((id) =>
    ['burn', 'bleed', 'poison', 'slow', 'root', 'exposed', 'mark', 'challenged', 'suppress'].map(
      (status) => ({ id, status }),
    ),
  ),
)('$id still cleanses actual $status before recovering the wounded recipient', ({ id, status }) => {
  const state = fixture([id])
  unit(state).hp = 600
  give(state, status, 'actor')
  const result = cast(input(state, id, { kind: 'self' }))
  expect(hasStatus(result.state, status)).toBe(false)
  expect(unit(result.state).hp).toBe(id === 'wildwarden.field-remedy' ? 690 : 740)
  expect(ap(result.state)).toBe(id === 'wildwarden.field-remedy' ? 55 : 35)
  expect(unit(result.state).mp).toBe(id === 'wildwarden.field-remedy' ? 16 : 10)
})

it.each([false, true])(
  "Dawn's Oath recovery checks the selected ally, not a different afflicted owner (ally afflicted: %s)",
  (afflicted) => {
    const id = 'essence.dawnshield.dawns-oath'
    const state = fixture([id])
    unit(state).hp = 600
    unit(state, 'ally').hp = 600
    give(state, 'poison', 'actor')
    if (afflicted) give(state, 'suppress', 'ally')
    const result = cast(input(state, id, { kind: 'unit', combatantId: 'ally' }))
    expect(unit(result.state, 'ally').hp).toBe(afflicted ? 740 : 600)
    expect(unit(result.state).hp).toBe(600)
    expect(hasStatus(result.state, 'poison', 'actor')).toBe(true)
    expect(hasStatus(result.state, 'suppress', 'ally')).toBe(false)
    expect(hasStatus(result.state, 'guarded', 'ally')).toBe(true)
  },
)

it.each(['wildwarden.field-remedy', 'essence.dawnshield.dawns-oath'])(
  '%s does not count Chilled outside its Cleanse set as a repair opportunity',
  (id) => {
    const state = fixture([id])
    unit(state).hp = 600
    give(state, 'frozen', 'actor')
    const result = cast(input(state, id, { kind: 'self' }))
    expect(unit(result.state).hp).toBe(600)
    expect(hasStatus(result.state, 'frozen')).toBe(true)
  },
)
