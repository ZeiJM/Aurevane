import { expect, it } from 'vitest'
import {
  captureCombatTagPresentation,
  combatTagPresentationIssues,
  combatTagDefinition,
} from './combat-tag-registry'
it('attaches versioned wording to an existing canonical handler and rejects invented mechanics', () => {
  const tag = {
    id: 'tag.damage',
    contentVersion: 3,
    tagId: 'damage',
    name: 'Impact',
    description: 'Relative power.',
    explanation: 'Damage uses relative power, not fixed HP.',
  }
  expect(captureCombatTagPresentation(tag)).toEqual({
    contentKey: 'tag.damage',
    contentVersion: 3,
    tagId: 'damage',
    name: 'Impact',
    compact: 'Relative power.',
    full: 'Damage uses relative power, not fixed HP.',
  })
  expect(combatTagDefinition('damage')?.handler).toBe('combat-action')
  expect(() => captureCombatTagPresentation({ ...tag, tagId: 'invented' })).toThrow()
  expect(
    combatTagPresentationIssues([{ ...captureCombatTagPresentation(tag), accuracyRule: {} }]),
  ).not.toEqual([])
})
