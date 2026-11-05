import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { defaultBasicSkills } from '@aurevane/game-core/combat/combat-basic-actions'
import { itemFixture } from '../../../../../packages/game-core/src/content/items-test-fixtures'
import { presentItem } from '@/lib/items/item-presentation'
import { ItemDetails } from './item-details'
import { starterItemDefinitions } from '@aurevane/game-core/content/starter-items'

it('shows the ordered two-row facts and one Consumable uses field, retaining other limits', () => {
  const ability = structuredClone(
    defaultBasicSkills().find((row) => row.id === 'basic.recover')!.ability!,
  )
  const behavior = ability.behaviors[0]!
  const item = itemFixture({
    itemClass: 'battle-item',
    inventoryCategory: 'battle-items',
    maximumStack: 99,
    equipment: { slot: 'hand', hands: 1 },
    battleUses: 3,
    ability: {
      ...ability,
      behaviors: [
        { ...behavior, maximumUsesPerBattle: 2, activationLimits: ['once-per-owner-turn'] },
      ],
    },
    actions: { use: { behaviorId: behavior.id, name: 'Salve' } },
  })
  const presentation = presentItem(item)
  const before = JSON.stringify(presentation)
  const html = renderToStaticMarkup(<ItemDetails item={presentation} />)
  expect(html).toContain('<dt>Class</dt><dd>Consumables</dd>')
  expect([...html.matchAll(/<dt>(.*?)<\/dt>/g)].slice(0, 7).map((match) => match[1])).toEqual([
    'Tier',
    'Quality Points',
    'Maximum stack',
    'Class',
    'Position',
    'Type',
    'Uses per battle',
  ])
  expect(html).toContain('<dt>Position</dt><dd>Consumable Slot</dd>')
  expect(html.match(/Uses per battle/g)).toHaveLength(1)
  expect(html).not.toMatch(/\d+ uses per battle|Uses refill each battle/)
  expect(html).toContain('Once per owner turn')
  expect(JSON.stringify(presentation)).toBe(before)
})
it('omits the uses field for passive equipment', () => {
  const html = renderToStaticMarkup(
    <ItemDetails
      item={presentItem(
        itemFixture({ itemClass: 'hand-armor', equipment: { slot: 'hand', hands: 1 } }),
      )}
    />,
  )
  expect(html).toContain('<dt>Class</dt><dd>Gear</dd>')
  expect(html).toContain('<dt>Type</dt><dd>Gloves</dd>')
  expect(html).toContain('<dt>Position</dt><dd>Off Hand</dd>')
  expect(html).not.toContain('Uses per battle')
})

it('uses actual equipment slot names and N/A for non-equippable classes', () => {
  const weapon = renderToStaticMarkup(
    <ItemDetails
      item={presentItem(
        itemFixture({ itemClass: 'weapon', equipment: { slot: 'hand', hands: 2 } }),
      )}
    />,
  )
  expect(weapon).toContain('<dt>Position</dt><dd>Main Hand</dd>')
  const material = renderToStaticMarkup(
    <ItemDetails
      item={presentItem(
        itemFixture({
          itemClass: 'material',
          inventoryCategory: 'materials',
          equipment: null,
          maximumStack: 99,
        }),
      )}
    />,
  )
  expect(material).toContain('<dt>Class</dt><dd>Materials</dd>')
  expect(material).toContain('<dt>Position</dt><dd>N/A</dd>')
})

it('shows equip requirements separately from the ability activation Requirements', () => {
  const html = renderToStaticMarkup(
    <ItemDetails
      item={presentItem(
        itemFixture({
          equipRequirements: {
            minimumLevel: 12,
            disciplineIds: ['vanguard'],
            minimumCoreStats: { might: 20 },
          },
        }),
      )}
    />,
  )
  expect(html).toContain('Equip requirements')
  expect(html).toContain('Level 12')
  expect(html).toContain('Discipline: Vanguard')
  expect(html).toContain('Base Might 20')
})

it.each([
  ['evasion', 100, 'Evasion', '+1%'],
  ['evasion', 250, 'Evasion', '+2.5%'],
  ['initiative', 3, 'Initiative', '+3'],
  ['movement', 2, 'Movement', '+2'],
  ['jump', 1, 'Jump', '+1'],
  ['physical-power', 12, 'Physical Power', '+12'],
  ['mystic-defense', 16, 'Mystic Defense', '+16'],
] as const)(
  'reports %s bonuses with readable names and units',
  (stat, amount, label, magnitude) => {
    const item = starterItemDefinitions().find((row) => row.id === 'wayfarer-hood')!
    const group = item.ability!.behaviors[0]!
    const presentation = presentItem({
      ...item,
      ability: {
        ...item.ability!,
        behaviors: [
          {
            ...group,
            effects: [
              { id: 'bonus', payload: { type: 'stat-bonus', stat, amount, recipient: 'actor' } },
            ],
          },
        ],
      },
    })
    expect(presentation.reports[0]!.effects[0]!.parts).toMatchObject({ label, magnitude })
    const html = renderToStaticMarkup(<ItemDetails item={presentation} />)
    expect(html).toContain(`${label} ${magnitude}`)
    expect(html).not.toMatch(/basis points|\(rating\)|while Requirements hold/)
  },
)
