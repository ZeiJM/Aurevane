import { expect, it } from 'vitest'
import {
  combatEffectIdentity,
  currentCombatTagName,
  AUTHORABLE_EFFECT_TAGS,
  isCombatPresentationTagId,
} from './combat-effect-identities'
import { combatEffectPresentationTags } from './gameplay-tags'
import { defaultCombatTagDefinitions } from './combat-tag-wording'
import { combatGroundContactEffectKey } from './combat-ground-contact'
it('presents saved default Counter metadata as Reflect while preserving custom names and IDs', () => {
  expect(currentCombatTagName('counter', 'Counter')).toBe('Reflect')
  expect(currentCombatTagName('counter', 'Mirror Ward')).toBe('Mirror Ward')
  const effect = {
    type: 'apply-status' as const,
    recipient: 'actor' as const,
    statusId: 'counter',
    stacks: 1,
    counter: { kind: 'mystic' as const, basisPoints: 17500 },
  }
  expect(combatEffectIdentity(effect)).toMatchObject({
    id: 'counter',
    label: 'Reflect',
    statusId: 'counter',
  })
  expect(combatEffectPresentationTags(effect)).toEqual(['Reflect [Magical Reflect 175%]'])
})

it('retires the standalone Chilled cleanse from current defaults and readers while accepting saved identifiers', () => {
  const retained = {
    type: 'remove-status' as const,
    recipient: 'actor' as const,
    statusIds: ['frozen'],
  }
  const before = JSON.stringify(retained)
  expect(combatEffectIdentity(retained)).toMatchObject({
    id: 'conditional-cleanse',
    label: 'Conditional Cleanse',
  })
  expect(combatEffectPresentationTags(retained)).toEqual(['Conditional Cleanse'])
  expect(defaultCombatTagDefinitions().some((tag) => tag.tagId === 'cleanse-chilled')).toBe(false)
  expect(AUTHORABLE_EFFECT_TAGS.some((tag) => tag.id === 'cleanse-chilled')).toBe(false)
  expect(isCombatPresentationTagId('cleanse-chilled')).toBe(true)
  expect(currentCombatTagName('cleanse-chilled', 'Cleanse Chilled')).toBe('Conditional Cleanse')
  expect(currentCombatTagName('cleanse-chilled', 'Thawing Ember')).toBe('Thawing Ember')
  expect(JSON.stringify(retained)).toBe(before)
  expect(combatGroundContactEffectKey(retained)).toBe('removal:cleanse')
  expect(
    combatGroundContactEffectKey({
      ...retained,
      removalMode: 'specified',
      selectionKind: 'debuffs',
    }),
  ).toBe('removal:conditional-cleanse')
})
