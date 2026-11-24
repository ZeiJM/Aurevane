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
  expect(waterAt(mooring)).toBe(true)
})

it('does not draw a pier or mooring through dry or withheld terrain', () => {
  expect(ferryPierPlacement({ x: 3.5, y: 6.5 }, 'west', () => false)).toBeNull()
  const pier = ferryPierPlacement({ x: 3.5, y: 6.5 }, 'west', ({ x }) => Math.floor(x) === 2)
  expect(pier?.to.x).toBeGreaterThan(2)
})
