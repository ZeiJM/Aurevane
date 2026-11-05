import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import { assertRuntimeItemPublication } from './runtime-item-validation'

it('rejects new weapon passives without breaking retained historical reads', () => {
  const weapon = starterItemDefinitions().find((item) => item.id === 'emberbrand')!
  const armor = starterItemDefinitions().find((item) => item.id === 'roadworn-trousers')!
  const passive = armor.ability!.behaviors[0]!
  const definition = {
    ...weapon,
    ability: {
      ...weapon.ability!,
      behaviors: [...weapon.ability!.behaviors.filter((group) => group.id !== passive.id), passive],
    },
  }
  expect(parseRuntimeItemDefinition(definition)).toEqual(definition)
  expect(() => assertRuntimeItemPublication(definition)).toThrow(/weapons.*manual|weapon.*passive/i)
  expect(() => assertRuntimeItemPublication(armor)).not.toThrow()
})

it('rejects active armor actions without breaking retained historical reads', () => {
  const weapon = starterItemDefinitions().find((item) => item.id === 'emberbrand')!
  const armor = starterItemDefinitions().find((item) => item.id === 'roadworn-trousers')!
  const technique = weapon.ability!.behaviors.find((group) => group.id === 'kindle')!
  const definition = {
    ...armor,
    actions: { support: { behaviorId: technique.id, name: 'Prayer' } },
    ability: { ...armor.ability!, behaviors: [...armor.ability!.behaviors, technique] },
  }
  expect(parseRuntimeItemDefinition(definition)).toEqual(definition)
  expect(() => assertRuntimeItemPublication(definition)).toThrow(/armor.*passive|gloves.*passive/i)
})
