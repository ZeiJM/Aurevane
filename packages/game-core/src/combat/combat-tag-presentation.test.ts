import { expect, it } from 'vitest'
import {
  captureCombatTagPresentation,
  combatTagPresentationIssues,
  combatTagDefinition,
  combatEffectTagPresentation,
  resolvedCombatEffectTagPresentation,
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

it('keeps exact retained Chilled-only captured wording ahead of a generic sibling while normalizing only its obsolete default name', () => {
  const retained = {
    type: 'remove-status' as const,
    recipient: 'actor' as const,
    statusIds: ['frozen'],
  }
  const legacy = {
    contentKey: 'tag.cleanse-chilled',
    contentVersion: 7,
    tagId: 'cleanse-chilled',
    name: 'Thawing Ember',
    full: 'Saved full Chilled-only text.',
    compact: 'Saved compact Chilled-only text.',
  }
  const generic = {
    contentKey: 'tag.conditional-cleanse',
    contentVersion: 9,
    tagId: 'conditional-cleanse',
    name: 'Other Cleanse',
    full: 'Other full text.',
    compact: 'Other compact text.',
  }
  const snapshots = [generic, legacy]
  const before = JSON.stringify({ retained, snapshots })
  expect(combatEffectTagPresentation(snapshots, retained)).toBe(legacy)
  expect(resolvedCombatEffectTagPresentation(snapshots, retained, 'Generated')).toEqual(legacy)
  expect(
    resolvedCombatEffectTagPresentation(
      [{ ...legacy, name: 'Cleanse Chilled' }, generic],
      retained,
      'Generated',
    ),
  ).toEqual({ ...legacy, name: 'Conditional Cleanse' })
  expect(
    combatEffectTagPresentation(snapshots, {
      ...retained,
      removalMode: 'specified',
      selectionKind: 'debuffs',
    }),
  ).toBe(generic)
  expect(JSON.stringify({ retained, snapshots })).toBe(before)
})
