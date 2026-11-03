import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRuntimeItemDefinition } from './items'
import { starterItemDefinitions, starterItemGrant } from './starter-items'

it('ships the complete illustrated 47 Item catalogue with genuine executable equipment and bounded sample quantities', () => {
  const items = starterItemDefinitions()
  const artwork = JSON.parse(
    readFileSync(
      new URL('../../../../docs/artwork/2026-11-03-starter-items.json', import.meta.url),
      'utf8',
    ),
  )
  expect(items).toHaveLength(47)
  expect(new Set(items.map((x) => x.id)).size).toBe(47)
  expect(items.map((x) => x.media.artworkId).sort()).toEqual(
    artwork.items.map((x: { assetKey: string }) => `item.${x.assetKey}.art.v1`).sort(),
  )
  for (const [itemClass, count] of Object.entries({
    armor: 11,
    'hand-armor': 2,
    weapon: 8,
    'battle-item': 11,
    material: 5,
    general: 4,
    event: 3,
    companion: 3,
  }))
    expect(
      items.filter((x) => x.itemClass === itemClass),
      itemClass,
    ).toHaveLength(count)
  for (const item of items) {
    expect(parseRuntimeItemDefinition(item)).toEqual(item)
    expect(item.requirements).toBeNull()
    expect(item.consumeOnUse).toBe(false)
    expect(item.equipment ? item.ability?.behaviors.length : item.ability === null).toBeTruthy()
  }
  expect(starterItemGrant.items.map((x) => x.itemId).sort()).toEqual(items.map((x) => x.id).sort())
  expect(starterItemGrant.items.map((x) => x.quantity)).toEqual(
    expect.arrayContaining([12, 40, 99]),
  )
  expect(items.find((x) => x.id === 'sunsplitter')).toMatchObject({
    qualityPoints: 50,
    equipment: { slot: 'hand', hands: 2 },
  })
  const boots = ['trailbound-boots', 'galewalker-boots'].map((id) =>
    items.find((x) => x.id === id)!,
  )
  expect(boots[1]!.qualityPoints).toBeGreaterThan(boots[0]!.qualityPoints)
  boots.forEach((item, index) =>
    expect(item.ability?.behaviors[0]?.effects[0]?.payload).toEqual({
      type: 'stat-bonus',
      recipient: 'actor',
      stat: 'movement',
      amount: index + 1,
    }),
  )
})
