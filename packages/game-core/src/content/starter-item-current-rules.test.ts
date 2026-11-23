import { expect, it } from 'vitest'
import { starterItemDefinitions } from './starter-items'

it('gives every hand weapon only deliberate manual actions, retaining armor passives', () => {
  const items = starterItemDefinitions()
  for (const item of items.filter((item) => item.itemClass === 'weapon')) {
    expect(
      item.ability!.behaviors.every(
        (group) => group.activation === 'manual' && group.mode === 'action',
      ),
      item.id,
    ).toBe(true)
    expect(item.actions?.attack, item.id).toBeDefined()
  }
  expect(items.find((item) => item.id === 'emberbrand')!.actions?.support?.name).toBe('Kindle')
  expect(items.find((item) => item.id === 'tower-shield')!.actions?.support?.name).toBe(
    'Tower Guard',
  )
  for (const armor of items.filter((item) => ['armor', 'hand-armor'].includes(item.itemClass))) {
    expect(
      armor.ability!.behaviors.every(
        (group) => group.mode === 'modifier' && group.activation !== 'manual',
      ),
      armor.id,
    ).toBe(true)
    expect(Object.keys(armor.actions ?? {}), armor.id).toHaveLength(0)
  }
  expect(
    items.find((item) => item.id === 'roadworn-trousers')!.ability!.behaviors[0]!.activation,
  ).toBe('ongoing')
})

it('leaves all Item action timings to the global tag policy, above the released version floor', () => {
  for (const item of starterItemDefinitions()) {
    for (const group of item.ability?.behaviors ?? []) {
      if (group.activation !== 'manual') continue
      expect(item.contentVersion, item.id).toBeGreaterThan(5)
      for (const effect of group.effects)
        expect(effect.timing, `${item.id}:${effect.id}`).toBeUndefined()
    }
  }
})
