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
it('uses Gloves and a Basic Attack slot label without a template caption', () => {
  const html = renderToStaticMarkup(<CharacterItems initialView={view} />)
  const text = html.replace(/<[^>]+>/g, '')
  expect(text).toContain('Gloves')
  expect(text).not.toContain('hand armor')
  expect(text).not.toContain('Template')
  expect(text).toContain('Basic Attack slot: Unarmed')
})
it('names the equipped weapon in the Basic Attack slot independently of its technique name', () => {
  const weapon = item({
    id: 'sunsplitter',
    name: 'Sunsplitter',
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 2 },
    actions: { attack: { behaviorId: 'attack', name: 'Solar Slash' } },
  })
  const html = renderToStaticMarkup(
    <CharacterItems
      initialView={{
        ...view,
        equipment: { 'main-hand': 'blade' },
        stacks: [stack('blade', weapon)],
      }}
    />,
  )
  expect(html.replace(/<[^>]+>/g, '')).toContain('Basic Attack slot: Sunsplitter')
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
it('renders six categories, forty addressable slots, real art and exactly eight equipment positions', () => {
  const html = renderToStaticMarkup(<CharacterItems initialView={view} />)
  for (const name of [
    'Gear',
    'Consumables',
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
    'Consumable 1',
    'Consumable 2',
  ])
    expect(html).toContain(name)
  expect(html.match(/data-inventory-slot=/g)).toHaveLength(40)
  expect(html).toContain('/media/art/items/thumbnails/wayfarer-hood-v01.webp')
  expect(html).toContain('8 / 100 QP')
  expect(html).toContain('Wayfarer Hood, quantity 1, equipped')
  expect(html).not.toContain('Ready for the road')
  expect(html).not.toContain('Equip your discoveries.')
  expect(html).not.toContain('ARSENAL · ITEMS')
  expect(html).not.toContain('Reload Items')
})
it('recovers loading and battle locks automatically without manual save or reload controls', () => {
  expect(renderToStaticMarkup(<CharacterItems initialView={null} />)).not.toContain('Reload Items')
  expect(
    renderToStaticMarkup(<CharacterItems initialView={{ ...view, battleLocked: true }} />),
  ).not.toContain('Reload Items')
  expect(renderToStaticMarkup(<CharacterItems initialView={view} />)).not.toContain('Save order')
})
it('omits the Unavailable filter while retaining unavailable owned Items for repair', () => {
  const html = renderToStaticMarkup(
    <CharacterItems initialView={{ ...view, stacks: [stack('old', null)] }} />,
  )
  expect(html).not.toContain('<option value="unavailable">')
  expect(html).toContain('Unavailable Item')
  expect(html).toContain('Head: Unavailable Item')
})
it('offers useful Gear controls with readable slots and no quantity sorting', () => {
  const html = renderToStaticMarkup(<CharacterItems initialView={view} />)
  expect(html).toContain('<option value="slot:main-hand">Main Hand</option>')
  expect(html).toContain('<option value="slot:off-hand">Off Hand</option>')
  expect(html).not.toContain('<option value="slot:hand">')
  expect(html).not.toContain('<option value="quantity">')
  expect(html).toContain('<option value="quality-points">Quality Points</option>')
})
it('places slot captions outside equipment buttons while retaining names, QP and accessible positions', () => {
  const html = renderToStaticMarkup(<CharacterItems initialView={view} />)
  const slot = html.slice(
    html.indexOf('data-equipment-position="head"'),
    html.indexOf('data-equipment-position="body"'),
  )
  expect(slot.indexOf('<strong>Wayfarer Hood</strong>')).toBeLessThan(slot.indexOf('<img'))
  expect(slot.indexOf('<small>8 QP</small>')).toBeLessThan(slot.indexOf('<img'))
  expect(slot.indexOf('>Head</span>')).toBeGreaterThan(slot.indexOf('<img'))
  expect(slot.indexOf('>Head</span>')).toBeGreaterThan(slot.indexOf('</button>'))
  expect(slot).toContain('aria-label="Head: Wayfarer Hood"')
})
it('shows consumable stock once on its image instead of beside the QP cost', () => {
  const salve = item({
    id: 'salve',
    name: 'Mender Salve',
    itemClass: 'battle-item',
    inventoryCategory: 'battle-items',
    artworkSrc: '/media/art/items/mender-salve-v01.webp',
    qualityPoints: 5,
    equipment: { slot: 'hand', hands: 1 },
    maximumStack: 99,
  })
  const html = renderToStaticMarkup(
    <CharacterItems
      initialView={{
        ...view,
        equipment: { 'consumable-1': 'salve' },
        stacks: [stack('salve', salve, 11)],
      }}
    />,
  )
  const slot = html.slice(
    html.indexOf('data-equipment-position="consumable-1"'),
    html.indexOf('data-equipment-position="consumable-2"'),
  )
  expect(slot).toContain('<small>5 QP</small>')
  expect(slot).toContain('>×11</span>')
  expect(slot).toContain('aria-description="Quantity 11"')
  expect(slot).not.toContain('owned')
  expect(slot.match(/×11/g)).toHaveLength(1)
})
it('uses the saved presentation for neutral faceless equipment templates', () => {
  for (const presentationId of ['masculine', 'feminine', 'androgynous'] as const) {
    const html = renderToStaticMarkup(
      <CharacterItems initialView={view} presentationId={presentationId} />,
    )
    expect(html).toContain(`data-equipment-template="${presentationId}"`)
    expect(html).toContain(`/media/art/items/equipment-${presentationId}-v01.webp`)
    expect(html).not.toContain('equipment-mannequin-v01')
  }
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
it('keeps unmet authoritative character requirements visible in equipment proposals', () => {
  const restricted = {
    ...view.stacks[0]!,
    unmetEquipRequirements: ['Level 10 required (current 2).'],
  }
  expect(equipmentProposal({ ...view, equipment: {} }, restricted, 'head', []).issue).toBe(
    'Level 10 required (current 2).',
  )
})
it('blocks the same Consumable identity in both positions regardless of owned quantity or separate stacks', () => {
  const potion = item({
    id: 'draught',
    inventoryCategory: 'battle-items',
    itemClass: 'battle-item',
    equipment: { slot: 'hand', hands: 1 },
    qualityPoints: 7,
    maximumStack: 99,
  })
  const s = stack('potion', potion, 1),
    v = { ...view, qualityPoints: 7, equipment: { 'consumable-1': 'potion' }, stacks: [s] }
  expect(equipmentProposal(v, s, 'consumable-2', []).issue).toMatch(/different Items/)
  expect(
    equipmentProposal(
      { ...v, stacks: [{ ...s, quantity: 2 }] },
      { ...s, quantity: 2 },
      'consumable-2',
      [],
    ).issue,
  ).toMatch(/different Items/)
  const second = { ...s, id: 'second-stack', quantity: 4 }
  expect(
    equipmentProposal({ ...v, stacks: [s, second] }, second, 'consumable-2', []).issue,
  ).toMatch(/different Items/)
  expect(equipmentProposal({ ...v, equipment: {} }, second, 'consumable-2', []).issue).toBeNull()
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

it('shows actual armor and weapon positions without internal hand counts', async () => {
  const { ItemDetails } = await import('./item-details')
  for (const slot of ['head', 'body', 'pants', 'boots'] as const) {
    const html = renderToStaticMarkup(
      <ItemDetails item={item({ equipment: { slot, hands: 1 } })} />,
    )
    expect(html).toContain(`<dd>${slot[0]!.toUpperCase()}${slot.slice(1)}</dd>`)
    expect(html).not.toContain(`${slot} · 1 hand`)
  }
  for (const hands of [1, 2] as const)
    expect(
      renderToStaticMarkup(
        <ItemDetails item={item({ itemClass: 'weapon', equipment: { slot: 'hand', hands } })} />,
      ),
    ).toContain('<dd>Main Hand</dd>')
})
it('describes battle Items as consumables rather than hand equipment', async () => {
  const { ItemDetails } = await import('./item-details')
  const html = renderToStaticMarkup(
    <ItemDetails
      item={item({ itemClass: 'battle-item', equipment: { slot: 'hand', hands: 1 } })}
    />,
  )
  expect(html).toContain('<dd>Consumable Slot</dd>')
  expect(html).not.toContain('hand · 1 hand')
})
it('shows why a starter grant is deferred without implying any quantity was granted', () => {
  const html = renderToStaticMarkup(
    <CharacterItems initialView={{ ...view, notices: ['starter-items-deferred-capacity'] }} />,
  )
  expect(html).toContain('Starter Items have not been granted')
  expect(html).toContain('inventory space')
})
