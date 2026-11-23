import { expect, it } from 'vitest'
import { FERRY_ASTERWAKE_DOCK, FERRY_MAINLAND_DOCK, FERRY_NORTH_DOCK } from '@/world/ferry'
import { ASTERWAKE_GOLDEN_TREE } from '@/world/asterwake'
import type { WorldAtlasCell } from '@/world/types'
import { worldKeyLocations, worldTravelDestination } from './world-travel-points'

const cell = (id: string, name: string, charted = true, townId?: string): WorldAtlasCell => ({
  id,
  name,
  charted,
  townId,
  coordinate: 'S09-09',
  column: 8,
  row: 8,
  regionId: 'verdant-expanse',
})

it('lists public key locations and the favorite in name order without duplicates', () => {
  const atlas = [
    cell('town', 'Verdant Expanse', true, 'town'),
    cell(FERRY_NORTH_DOCK.sectorId, 'North Shore Ferry Terminal'),
    cell('favorite', 'Amberwood Glade'),
    cell('hidden', 'A private place', false, 'hidden'),
    cell('unmarked', 'Ordinary countryside'),
  ]
  const anchors = [{ id: 'anchor-a', name: 'Anchor', sectorId: 'favorite' }]
  expect(worldKeyLocations({ atlas, anchors }, 'favorite').map(({ id }) => id)).toEqual([
    'favorite',
    FERRY_NORTH_DOCK.sectorId,
    'town',
  ])
  expect(worldKeyLocations({ atlas, anchors: [] }, 'hidden').map(({ id }) => id)).not.toContain(
    'hidden',
  )
  expect(worldKeyLocations({ atlas, anchors: [] }, 'favorite')[0]?.id).toBe('favorite')
  expect(worldKeyLocations({ atlas, anchors: [] }, null).some(({ id }) => id === 'favorite')).toBe(
    false,
  )
})

it('selects the authored docks and the dry approach to Gildroot Oak', () => {
  for (const dock of [FERRY_MAINLAND_DOCK, FERRY_NORTH_DOCK, FERRY_ASTERWAKE_DOCK])
    expect(worldTravelDestination(dock.sectorId)).toEqual(dock)
  expect(worldTravelDestination(ASTERWAKE_GOLDEN_TREE.sectorId)).toEqual({
    ...ASTERWAKE_GOLDEN_TREE,
    y: 6,
  })
})
