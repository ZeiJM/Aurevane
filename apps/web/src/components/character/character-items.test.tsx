import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import type { CharacterItemsView } from '@/server/character/character-items-service'
import type { ItemPresentation } from '@/lib/items/item-presentation'
import { CharacterItems } from './character-items'
import { equipmentProposal, itemPositions } from './item-equipment-preview'
const item = (overrides: Partial<ItemPresentation> = {}): ItemPresentation => ({
  id: 'helm',
  contentVersion: 1,
  name: 'Wayfarer Hood',
  description: 'Weathered linen.',
  enabled: true,
  inventoryCategory: 'gear',
  itemClass: 'armor',
  tier: 'D',
  qualityPoints: 8,
  equipment: { slot: 'head', hands: 1 },
  maximumStack: 1,
  battleUses: null,
  consumeOnUse: false,
  artworkSrc: '/media/art/items/wayfarer-hood-v01.webp',
  tags: [],
  actions: {},
  reports: [],
  ...overrides,
})
const stack = (id: string, value: ItemPresentation | null, quantity = 1) => ({
  id,
  itemId: value?.id ?? 'archived',
  inventoryCategory: value?.inventoryCategory ?? ('gear' as const),
  slotIndex: 0,
  quantity,
  item: value,
})
export const view: CharacterItemsView = {
  characterId: 'character',
  revision: 7,
  catalogueToken: 'a'.repeat(32),
  battleLocked: false,
  qualityPoints: 8,
  qualityPointLimit: 100,
  equipmentIssue: null,
  equipment: { head: 'old' },
  selectedSupport: { kind: 'basic', actionId: 'basic.recover' },
  stacks: [stack('old', item())],
  notices: [],
}
it('renders six categories, forty addressable slots, real art and exactly six equipment positions', () => {
  const html = renderToStaticMarkup(<CharacterItems initialView={view} />)
  for (const name of [
    'Gear',
    'Battle Items',
    'Materials',
    'General',
    'Event',
    'Companion',
    'Head',
    'Body',
    'Pants',
    'Boots',
    'Main Hand',
    'Off Hand',
  ])
    expect(html).toContain(name)
  expect(html.match(/data-inventory-slot=/g)).toHaveLength(40)
  expect(html).toContain('/media/art/items/thumbnails/wayfarer-hood-v01.webp')
  expect(html).toContain('8 / 100 QP')
})
it('previews explicit two-hand replacement once and shortage without silently removing armor', () => {
  const weapon = item({
    id: 'sword',
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 2 },
    qualityPoints: 50,
  })
  const v = {
    ...view,
    qualityPoints: 98,
    equipment: { head: 'old', 'off-hand': 'off' },
    stacks: [
      ...view.stacks,
      stack(
        'off',
        item({
          id: 'shield',
          itemClass: 'hand-armor',
          equipment: { slot: 'hand', hands: 1 },
          qualityPoints: 20,
        }),
      ),
      stack('new', weapon),
    ],
  }
  const result = equipmentProposal(v, v.stacks[2]!, 'main-hand', [])
  expect(result.requiredReplacements).toEqual(['off-hand'])
  expect(result.qualityPoints).toBe(128)
  expect(result.shortage).toBe(28)
  expect(result.removals).not.toContain('head')
  expect(itemPositions(weapon)).toEqual(['main-hand'])
})
it('allows the same battle stack twice only with two owned copies and charges QP per hand', () => {
  const potion = item({
    id: 'draught',
    inventoryCategory: 'battle-items',
    itemClass: 'battle-item',
    equipment: { slot: 'hand', hands: 1 },
    qualityPoints: 7,
    maximumStack: 99,
  })
  const s = stack('potion', potion, 1),
    v = { ...view, qualityPoints: 7, equipment: { 'main-hand': 'potion' }, stacks: [s] }
  expect(equipmentProposal(v, s, 'off-hand', []).issue).toMatch(/two owned/)
  expect(
    equipmentProposal(
      { ...v, stacks: [{ ...s, quantity: 2 }] },
      { ...s, quantity: 2 },
      'off-hand',
      [],
    ).qualityPoints,
  ).toBe(14)
})
it('keeps unavailable owned equipment visible and marks partial QP as invalid', () => {
  const html = renderToStaticMarkup(
    <CharacterItems
      initialView={{
        ...view,
        equipmentIssue: { code: 'definition', message: 'Current Item unavailable.' },
        stacks: [stack('old', null)],
      }}
    />,
  )
  expect(html).toContain('Unavailable Item')
  expect(html).toContain('Current Item unavailable.')
  expect(html).toContain('QP incomplete')
  expect(html).toContain('Repair equipment')
})
