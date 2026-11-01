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
