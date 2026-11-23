import { expect, it } from 'vitest'
import { itemSupportOptions } from './item-support-options'
import type { CharacterItemsView } from '@/server/character/character-items-service'
import type { ItemPresentation } from '@/lib/items/item-presentation'
it('offers only equipped enabled bound supports, distinguishes both hands without stack identifiers', () => {
  const item = {
    id: 'shield',
    enabled: true,
    actions: { support: { name: 'Brace', behaviorId: 'brace' } },
  } as ItemPresentation
  const view = {
    equipment: { 'main-hand': 'private-id', 'off-hand': 'private-id' },
    stacks: [{ id: 'private-id', item }],
  } as unknown as CharacterItemsView
  const choices = itemSupportOptions(view)
  expect(choices.map((c) => c.label)).toEqual(['Brace', 'Brace'])
  expect(JSON.stringify(choices)).not.toContain('private-id')
  expect(choices[0]!.selection).toEqual({
    kind: 'equipment',
    position: 'main-hand',
    itemId: 'shield',
    behaviorId: 'brace',
  })
  expect(itemSupportOptions({ ...view, equipment: {} })).toHaveLength(0)
  expect(
    itemSupportOptions({ ...view, stacks: [{ ...view.stacks[0]!, item: null }] }),
  ).toHaveLength(0)
})
