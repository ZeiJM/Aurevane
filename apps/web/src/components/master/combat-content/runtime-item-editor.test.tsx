import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { itemFixture } from '../../../../../../packages/game-core/src/content/items-test-fixtures'
import { ContentDefinitionFields } from './content-definition-fields'
import { upgradeRetainedItem } from './runtime-item-editor'
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
  expect(html).toContain('Quality Points')
  expect(html).toContain('Battle uses')
  expect(html).toContain('Use binding')
  expect(html).toContain('Consumable 1 or Consumable 2')
  expect(html).not.toContain('Usage intent')
  expect(html).not.toContain('Equipment intent')
  const preview = renderToStaticMarkup(<ItemDetails item={presentItem(item)} />)
  expect(preview).toContain('3 uses per battle')
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
