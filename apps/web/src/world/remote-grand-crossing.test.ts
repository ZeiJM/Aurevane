import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasSectors } from './atlas'
import { findWorldRoute, newWorldState, isWalkable } from './travel'
import { projectWorldSector } from '@/server/world/world-service'
import { grandBridgeArt, grandBridgeDiscoveryArt } from '@/components/world/map-surface-art'
it('authors an actual remote grand crossing on known broad shallows with an uninterrupted saved avenue', () => {
  const sector = atlasSectors().find((s) => s.id === 'atlas:71:32')!
  expect(sector.townId).toBeUndefined()
  expect(sector.rows[4]).toBe('=============')
  for (const y of [3, 5]) expect(sector.rows[y]!.slice(4, 9)).toBe('wwwww')
  for (const x of [3, 9]) expect(sector.rows[4]![x]).toBe('=')
  expect(sector.landmarks).toContainEqual({
    id: 'atlas:71:32:grand-crossing',
    name: 'Longwater Crossing',
    kind: 'bridge',
    x: 6,
    y: 4,
  })
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 13; x++) expect(isWalkable(sector, { x, y })).toBe(true)
  const from = { sectorId: sector.id, x: 1, y: 4 },
    to = { sectorId: sector.id, x: 11, y: 4 }
  expect(findWorldRoute(from, to, [sector])).toHaveLength(10)
  const view = projectWorldSector({ ...newWorldState(), position: from }, sector)
  expect(grandBridgeArt(view, 6)).toBe(0)
  expect(grandBridgeDiscoveryArt(view, 6)).toMatchObject({
    sheet: 'grand-discoveries',
    index: 0,
    columns: 2,
    rows: 2,
  })
  expect(
    grandBridgeDiscoveryArt(
      { ...view, cells: view.cells.filter((c) => c.x !== 4 || c.y !== 3) },
      6,
    ),
  ).toBeUndefined()
  expect(grandBridgeDiscoveryArt({ ...view, charted: false }, 6)).toBeUndefined()
  expect(grandBridgeDiscoveryArt(view, 3)).toBeUndefined()
})
