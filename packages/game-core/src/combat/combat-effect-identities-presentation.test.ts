import { expect, it } from 'vitest'
import { combatEffectIdentity, currentCombatTagName } from './combat-effect-identities'
import { combatEffectPresentationTags } from './gameplay-tags'
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
