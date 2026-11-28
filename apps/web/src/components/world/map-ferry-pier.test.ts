import { expect, it, vi } from 'vitest'
import { PUBLIC_FERRY_TERMINALS } from '@/world/ferry'
import { VOID_REALMS } from '@/world/void-realms'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import { atlasSectors } from '@/world/atlas'
import { wrapAtlasColumn } from '@/world/topology'
import { resolveSector } from '@/server/world/world-content'
import { worldFerryDock } from '@/server/world/world-ferry'
import { voidRealmFerryDock } from '@/server/world/void-realms'
import { ferryPierPlacement } from './map-ferry-pier'
import { isWaterTerrain } from './map-water'

vi.mock('server-only', () => ({}))

const ids = [
  ...PUBLIC_FERRY_TERMINALS.map(({ dock }) => dock.sectorId),
  ...VOID_REALMS.map(({ id }) => voidRealmFerryDock(id).sectorId),
]

it.each(ids)('places the whole pier over water from the shore in %s', (sectorId) => {
  const position = worldFerryDock(sectorId)!
  const sector = resolveSector(sectorId)!
  const { shoreSide, x, y } = position
  const offsetX = (sector.atlasColumn ?? sector.sceneColumn!) * GRID_WIDTH
  const offsetY = (sector.atlasRow ?? sector.sceneRow!) * GRID_HEIGHT
  const atlas = new Map(
    atlasSectors().map((entry) => [`${entry.atlasColumn}:${entry.atlasRow}`, entry]),
  )
  const waterAt = ({ x, y }: { x: number; y: number }) => {
    const column = Math.floor(x / GRID_WIDTH)
    const row = Math.floor(y / GRID_HEIGHT)
    const cellX = Math.floor(x - column * GRID_WIDTH)
    const cellY = Math.floor(y - row * GRID_HEIGHT)
    const neighbor = sector.charted
      ? atlas.get(`${wrapAtlasColumn(column)}:${row}`)
      : resolveSector(sector.id.split(':').slice(0, 2).join(':') + `:${column}:${row}`)
    return neighbor ? isWaterTerrain(neighbor.rows[cellY]?.[cellX]) : sector.charted
  }
  const pier = ferryPierPlacement(
    { x: offsetX + x + 0.5, y: offsetY + y + 0.5 },
    shoreSide,
    waterAt,
  )
  expect(pier).not.toBeNull()
  const { from, normal, cross, length, mooring } = pier!
  // Only the lip meets land. Even the outer corners and piles stay over water.
  for (let along = 0.1; along <= length; along += 0.1)
    for (const side of [-0.39, 0.39])
      expect(
        waterAt({
          x: from.x + normal.x * along + cross.x * side,
          y: from.y + normal.y * along + cross.y * side,
        }),
      ).toBe(true)
  expect(mooring).not.toBeNull()
  if (!mooring) return
  const berthOffset = (mooring.x - from.x) * cross.x + (mooring.y - from.y) * cross.y
  const preferredSide = shoreSide === 'north' ? -1 : 1
  const signedOffset = berthOffset * preferredSide
  // The largest painted boat reaches 0.75 tiles on its hull side and 3.52
  // tiles on its sail side. Neither silhouette crosses the pier's outer edge.
  expect(signedOffset - 0.75 > 0.39 || signedOffset + 3.52 < -0.39).toBe(true)
  for (const along of [-2.85, -2, -1, 0, 1, 2, 2.85])
    for (const across of [-0.8, 0, 0.8])
      expect(
        waterAt({
          x: mooring.x + normal.x * along + cross.x * across,
          y: mooring.y + normal.y * along + cross.y * across,
        }),
      ).toBe(true)
})

it('does not draw a pier or mooring through dry or withheld terrain', () => {
  expect(ferryPierPlacement({ x: 3.5, y: 6.5 }, 'west', () => false)).toBeNull()
  const pier = ferryPierPlacement({ x: 3.5, y: 6.5 }, 'west', ({ x }) => Math.floor(x) === 2)
  expect(pier?.to.x).toBeGreaterThan(2)
  expect(pier?.mooring).toBeNull()
})
