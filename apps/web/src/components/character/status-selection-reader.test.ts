import { expect, it } from 'vitest'
import { createAuthorableEffectPayload } from '@aurevane/game-core/combat/combat-effect-authoring'
import { nativeCombatTagPayload } from '@aurevane/game-core/combat/combat-tag-registry'
import { previewEffect } from './skill-effect-preview'
import { skillEffectDescription } from './skill-detail-presentation'
it('shared readers name complete and partial status selections', () => {
  const all = nativeCombatTagPayload(createAuthorableEffectPayload('copy-buffs')!)
  expect(previewEffect(all).explanation).toContain('All Buffs')
  expect(skillEffectDescription(all)).toContain('All Buffs')
  const partial = {
    type: 'copy-statuses' as const,
    mode: 'curse' as const,
    recipient: 'primary-unit' as const,
    statusIds: ['slow'],
  }
  expect(previewEffect(partial).explanation).toContain('Slow')
  expect(skillEffectDescription(partial)).toContain('Slow')
  const cleanse = nativeCombatTagPayload(createAuthorableEffectPayload('cleanse')!)
  expect(previewEffect(cleanse).explanation).toContain('All Debuffs')
  expect(skillEffectDescription(cleanse)).toContain('All Debuffs')
})
it('MP Drain readers explain the saved percentage of recipient maximum MP', () => {
  const effect = nativeCombatTagPayload(createAuthorableEffectPayload('mp-drain')!)
  expect(previewEffect(effect).magnitude).toBe('1%')
  expect(previewEffect(effect).explanation).toContain('maximum MP')
  expect(skillEffectDescription(effect)).toContain('1%')
  expect(skillEffectDescription(effect)).toContain('maximum MP')
})
it('compact effect values condense complete conditional and Copy selections', async () => {
  const { selectableCombatStatusIds } =
    await import('@aurevane/game-core/combat/combat-status-selection')
  expect(
    previewEffect({
      type: 'remove-status',
      recipient: 'actor',
      removalMode: 'specified',
      statusIds: selectableCombatStatusIds('debuffs'),
    }).magnitude,
  ).toBe('All Debuffs')
  expect(
    previewEffect({
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'amplify',
      statusIds: selectableCombatStatusIds('copy-buffs'),
    }).magnitude,
  ).toBe('All Buffs')
  expect(
    previewEffect({
      type: 'copy-statuses',
      recipient: 'primary-unit',
      mode: 'curse',
      statusIds: ['slow'],
    }).magnitude,
  ).toBe('Slow')
})
