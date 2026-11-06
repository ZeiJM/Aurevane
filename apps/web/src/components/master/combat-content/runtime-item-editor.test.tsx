import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { itemFixture } from '../../../../../../packages/game-core/src/content/items-test-fixtures'
import { ContentDefinitionFields } from './content-definition-fields'
import { upgradeRetainedItem } from './runtime-item-editor'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'
import { COMBAT_CONTENT_CATEGORIES } from '@/server/combat/combat-content-categories'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { ItemDetails } from '@/components/character/item-details'
import { presentItem } from '@/lib/items/item-presentation'
it('edits sanitized V2 inventory controls with the shared ability editor and real Item reader', () => {
  const ability = defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability
  const item = itemFixture({
    media: { artworkId: 'environment.entry.gateway' },
    inventoryCategory: 'battle-items',
    itemClass: 'battle-item',
    equipment: { slot: 'hand', hands: 1 },
    maximumStack: 99,
    battleUses: 3,
    ability,
    actions: { use: { name: 'Drink', behaviorId: ability.behaviors[0]!.id } },
  })
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="item"
      tab="Parameters"
      value={{ ...item }}
      onChange={() => {}}
    />,
  )
  expect(html).toContain('aria-label="Class"')
  expect(html).not.toContain('aria-label="Type"')
  expect(html).toContain('Type: Consumable')
  expect(html).toContain('Cost (QP)')
  expect(html).toContain('Battle uses')
  expect(html).not.toContain('aria-label="Consumable action"')
  expect(html).not.toContain('Use binding')
  expect(html).toContain('Consumable action name')
  expect(html).toContain('Consumable 1 or Consumable 2')
  expect(html).not.toContain('Usage intent')
  expect(html).not.toContain('Equipment intent')
  const preview = renderToStaticMarkup(<ItemDetails item={presentItem(item)} />)
  expect(preview).toContain('<dt>Uses per battle</dt><dd>3</dd>')
  expect(preview).toContain('data-ability-parameters')
  expect(preview).toContain('Effect explanations')
  expect(preview).toContain(encodeURIComponent('/media/art/entry/gateway-v01.webp'))
})
it('explicitly upgrades V1 without mutating retained bytes and refuses to discard wrapper Requirements', () => {
  const retained = {
    schemaVersion: 1 as const,
    id: 'test.material',
    contentVersion: 1,
    name: 'Ore',
    description: 'Ore',
    sortOrder: 0,
    enabled: true,
    media: { artworkId: 'environment.entry.gateway' },
    itemClass: 'material' as const,
    usage: 'none' as const,
    equipmentSlot: null,
    acquisition: 'unimplemented' as const,
    requirements: null,
    ability: null,
  }
  const before = JSON.stringify(retained)
  expect(upgradeRetainedItem(retained)).toMatchObject({
    schemaVersion: 2,
    inventoryCategory: 'materials',
    maximumStack: 99,
    qualityPoints: 0,
    requirements: null,
  })
  expect(JSON.stringify(retained)).toBe(before)
  expect(() =>
    upgradeRetainedItem({
      ...retained,
      requirements: {
        kind: 'status-presence',
        subject: 'owner',
        statusId: 'guarded',
        present: true,
      },
    }),
  ).toThrow(/Requirements/)
})

it('keeps internal Item ordering out of the rendered editor while other ordered content remains editable', () => {
  const item = itemFixture({ sortOrder: 317 })
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="item"
      tab="Parameters"
      value={{ ...item }}
      onChange={() => {}}
    />,
  )
  expect(html).not.toContain('Display order')
  expect(item.sortOrder).toBe(317)
  const discipline = COMBAT_CONTENT_CATEGORIES.find((row) => row.category === 'discipline')!.editor
    .defaultDefinition!
  expect(
    renderToStaticMarkup(
      <ContentDefinitionFields
        kind="discipline"
        tab="Parameters"
        value={discipline}
        onChange={() => {}}
      />,
    ),
  ).toContain('aria-label="Display order"')
})

it('offers every passive armor position with Gloves in Off Hand and no weapon-only hands field', () => {
  const item = itemFixture({ equipment: { slot: 'body', hands: 1 }, itemClass: 'armor' })
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="item"
      tab="Parameters"
      value={{ ...item }}
      onChange={() => {}}
    />,
  )
  expect(html).toContain('aria-label="Position"')
  expect(html).toContain('>Off Hand (Gloves)</option>')
  expect(html).toContain('>Gloves</option>')
  expect(html).not.toContain('aria-label="Hands"')
  expect(html).not.toContain('Optional Support action')
  expect(html).not.toContain('Support binding')
})

it('keeps multiple weapon actions selectable while weapon Support moves to Imbued Technique', () => {
  const weapon = starterItemDefinitions().find((item) => item.id === 'emberbrand')!
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="item"
      tab="Parameters"
      value={{ ...weapon }}
      onChange={() => {}}
    />,
  )
  // Emberbrand has a separate optional Support action, so Basic Attack remains a choice.
  expect(html).toContain('aria-label="Basic Attack action"')
  expect(html).toContain('aria-label="Basic Attack name"')
  expect(html).not.toContain('aria-label="Support action"')
  expect(html).not.toContain('Optional Support action')
  expect(html).not.toContain('>attack</option>')
  expect(html).toContain('Behavior 1')
})

it.each(['unbound', 'missing'] as const)(
  'keeps %s Basic Attack binding repairable using readable action choices',
  (state) => {
    const weapon = starterItemDefinitions().find((item) => item.id === 'sunsplitter')!
    const value = {
      ...weapon,
      actions:
        state === 'unbound'
          ? {}
          : { attack: { behaviorId: 'missing-private-id', name: 'Saved Strike' } },
    }
    const before = JSON.stringify(value)
    const html = renderToStaticMarkup(
      <ContentDefinitionFields kind="item" tab="Parameters" value={value} onChange={() => {}} />,
    )
    expect(html).toContain('aria-label="Basic Attack action"')
    expect(html).toContain('Behavior 1')
    if (state === 'missing') expect(html).toContain('Unavailable action')
    expect(html).not.toContain('>attack</option>')
    expect(JSON.stringify(value)).toBe(before)
  },
)

it('offers six Classes and Gear-only Types while non-equippable Items show N/A', () => {
  for (const item of starterItemDefinitions()) {
    const html = renderToStaticMarkup(
      <ContentDefinitionFields
        kind="item"
        tab="Parameters"
        value={{ ...item }}
        onChange={() => {}}
      />,
    )
    expect(html).toContain('aria-label="Class"')
    for (const label of ['Gear', 'Consumables', 'Materials', 'General', 'Event', 'Companion'])
      expect(html).toContain(`>${label}</option>`)
    if (item.inventoryCategory === 'gear') {
      expect(html).toContain('aria-label="Type"')
      for (const label of ['Weapon', 'Armor', 'Gloves'])
        expect(html).toContain(`>${label}</option>`)
      expect(html).not.toContain('>Material</option>')
    } else {
      expect(html).not.toContain('aria-label="Type"')
      expect(html).toContain(item.itemClass === 'battle-item' ? 'Type: Consumable' : 'Type: N/A')
      if (!item.equipment) expect(html).toContain('Position: N/A')
    }
  }
})

it('offers explicit passive-only repair for retained armor actions without silently changing the draft', () => {
  const armor = starterItemDefinitions().find((item) => item.id === 'wardstone-bracer')!
  const active = starterItemDefinitions()
    .find((item) => item.id === 'emberbrand')!
    .ability!.behaviors.find((group) => group.id === 'kindle')!
  const draft = {
    ...armor,
    actions: { support: { behaviorId: active.id, name: 'Old Prayer' } },
    ability: { ...armor.ability!, behaviors: [...armor.ability!.behaviors, active] },
  }
  const before = JSON.stringify(draft)
  const html = renderToStaticMarkup(
    <ContentDefinitionFields
      kind="item"
      tab="Parameters"
      value={draft}
      onChange={() => {
        throw new Error('Rendering must not rewrite retained drafts')
      }}
    />,
  )
  expect(html).toContain('Keep passive effects only')
  expect(html).not.toContain('Optional Support action')
  expect(JSON.stringify(draft)).toBe(before)
})
