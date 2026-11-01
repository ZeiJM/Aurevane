import { combatStatusDetails } from './status-content'
import { createAuthorableEffectPayload } from './combat-effect-authoring'
import { expect, it } from 'vitest'
import {
  combatStatusSelectionSummary,
  selectableCombatStatusIds,
  validateCombatStatusSelection,
} from './combat-status-selection'
import { nativeCombatTagPayload, validateCombatTagPayload } from './combat-tag-registry'
it('offers current Copy Buffs without Blindside and with Covert, preserving positive historical captures', () => {
  const ids = selectableCombatStatusIds('copy-buffs')
  expect(ids).toContain('covert')
  expect(ids).toContain('invisible')
  expect(ids).not.toContain('blindside')
  expect(combatStatusSelectionSummary(ids, 'copy-buffs')).toBe('All Buffs')
  expect(() => validateCombatStatusSelection(['blindside'], 'copy-buffs')).not.toThrow()
  const captured = {
    type: 'copy-statuses' as const,
    recipient: 'primary-unit' as const,
    mode: 'amplify' as const,
    statusIds: ['blindside'],
  }
  expect(validateCombatTagPayload(captured)).toEqual([])
  expect(nativeCombatTagPayload(JSON.parse(JSON.stringify(captured)))).toEqual(captured)
})

it('pins current Copy Buffs Invisible donor selection in the authored capture', () => {
  expect(createAuthorableEffectPayload('copy-buffs')).toMatchObject({
    invisibleDonorPolicyVersion: 1,
  })
})

it('explains the current Copy Buffs exception in Invisible help', () => {
  expect(combatStatusDetails('invisible').description).toContain('Copy Buffs')
})

it('excludes persistent DoTs from current Copy Debuffs while retaining removal and captured selection support', () => {
  const ids = selectableCombatStatusIds('copy-debuffs')
  expect(ids).toHaveLength(10)
  expect(ids).toContain('slow')
  for (const id of ['burn', 'poison', 'bleed']) {
    expect(ids).not.toContain(id)
    expect(selectableCombatStatusIds('debuffs')).toContain(id)
    expect(() => validateCombatStatusSelection([id], 'copy-debuffs')).not.toThrow()
    expect(
      validateCombatTagPayload({
        type: 'copy-statuses',
        recipient: 'primary-unit',
        mode: 'curse',
        statusIds: [id],
      }),
    ).toEqual([])
  }
  expect(combatStatusSelectionSummary(ids, 'copy-debuffs')).toBe('All Debuffs')
})
it.each(['copy-buffs', 'copy-debuffs'] as const)(
  'pins current duration semantics on new %s payloads',
  (id) => {
    expect(createAuthorableEffectPayload(id)).toMatchObject({ durationPolicyVersion: 1 })
  },
)

it('excludes Endure from Dispel choices and All Buffs while allowing retained captures to parse', () => {
  expect(selectableCombatStatusIds('buffs')).not.toContain('endure')
  expect(selectableCombatStatusIds('copy-buffs')).not.toContain('endure')
  expect(() => validateCombatStatusSelection(['endure'], 'buffs')).not.toThrow()
  expect(createAuthorableEffectPayload('dispel')).toMatchObject({ invisibleTargetPolicyVersion: 1 })
})
