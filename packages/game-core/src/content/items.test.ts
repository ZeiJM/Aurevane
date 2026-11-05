import { expect, it } from 'vitest'
import { defaultBasicSkills } from '../combat/combat-basic-actions'
import { parseNoncombatContentDefinition } from './authored-content'
import { parseRuntimeItemDefinition } from './items'

import { itemFixture } from './items-test-fixtures'
it('dispatches V2 through the ordinary parser without rewriting input', () => {
  const item = itemFixture()
  expect(parseRuntimeItemDefinition(item)).toEqual(item)
  expect(parseNoncombatContentDefinition('item', item)).toEqual(item)
  expect(parseRuntimeItemDefinition(item)).not.toBe(item)
})
it.each([
  { qualityPoints: 0 },
  { maximumStack: 2 },
  { equipment: { slot: 'head', hands: 2 } },
  { inventoryCategory: 'materials' },
  { consumeOnUse: true },
  { requirements: { kind: 'all', children: [] } },
  { extra: true },
  { media: {} },
])('rejects inconsistent executable Item fields: %j', (override) => {
  expect(() => parseRuntimeItemDefinition({ ...itemFixture(), ...override })).toThrow()
})
it('binds every manual action once and rejects missing, duplicate, or passive bindings', () => {
  const ability = defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability!
  const behaviorId = ability.behaviors[0]!.id
  const item = itemFixture({
    id: 'test.potion',
    inventoryCategory: 'battle-items',
    itemClass: 'battle-item',
    equipment: { slot: 'hand', hands: 1 },
    maximumStack: 99,
    ability,
    actions: { use: { behaviorId, name: 'Drink' } },
    battleUses: 2,
  })
  expect(parseRuntimeItemDefinition(item)).toEqual(item)
  for (const actions of [
    {},
    { use: { behaviorId: 'missing', name: 'Drink' } },
    { use: { behaviorId, name: 'Drink' }, support: { behaviorId, name: 'Support' } },
  ])
    expect(() => parseRuntimeItemDefinition({ ...item, actions })).toThrow()
  expect(() =>
    parseRuntimeItemDefinition({
      ...item,
      ability: {
        ...ability,
        behaviors: [...ability.behaviors, { ...ability.behaviors[0], id: 'unbound' }],
      },
    }),
  ).toThrow()
})
it.each([{ itemClass: ['armor'] }, { tier: ['D'] }, { equipment: { slot: ['head'], hands: 1 } }])(
  'rejects coercible non-string enum values: %j',
  (patch) => {
    expect(() => parseRuntimeItemDefinition({ ...itemFixture(), ...patch })).toThrow()
  },
)

it('preserves optional equip requirements independently of null legacy wrapper Requirements', () => {
  const item = itemFixture({
    equipRequirements: {
      minimumLevel: 3,
      disciplineIds: ['custom.flame'],
      minimumCoreStats: { might: 12 },
    },
  })
  expect(parseRuntimeItemDefinition(item)).toEqual(item)
  expect(parseNoncombatContentDefinition('item', item)).toEqual(item)
  expect(() => parseRuntimeItemDefinition({ ...item, equipRequirements: null })).toThrow()
  expect(() => parseRuntimeItemDefinition({ ...item, requirements: { minimumLevel: 1 } })).toThrow()
  expect(() =>
    parseRuntimeItemDefinition({
      ...item,
      itemClass: 'material',
      inventoryCategory: 'materials',
      equipment: null,
      qualityPoints: 0,
    }),
  ).toThrow(/equipRequirements/)
})
