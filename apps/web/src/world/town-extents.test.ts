import { mainlandSectorNumber } from '@/world/sector-index'
import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasSectors } from './atlas'
import { newWorldState, isSafe } from './travel'
import { projectWorld } from '@/server/world/world-service'
import { worldRenderTerrain } from '@/components/world/map-render-terrain'
import { settlementComposition } from '@/components/world/map-settlement-composition'
import { globeTowns } from '@/components/world/globe-atlas'
import { masterTeleportGeometry } from '@/server/master/player-teleport'
import { resolveSector } from '@/server/world/world-content'
import { GRAND_DISCOVERY_SITES } from './discovery-sites'
import { sceneryDressing, naturalDressing } from '@/components/world/map-dressing'

const expected = {
  'aureth-crown': 14,
  'verdant-expanse': 12,
  emberreach: 10,
  frostmere: 9,
  'glasswind-desert': 11,
  'hollow-coast': 13,
  'starfall-highlands': 10,
  'umbral-march': 12,
}

it('renders distinct connected settlement extents while retaining all nine-district safe cores', () => {
  const shapes: string[] = []
  for (const [townId, count] of Object.entries(expected)) {
    const state = { ...newWorldState(), position: { sectorId: townId, x: 6, y: 4 } }
    const saved = structuredClone(state)
    const view = projectWorld(state, [], 1000, undefined, undefined, { width: 1920, height: 1080 })
    const town = globeTowns(view.atlas!).find((town) => town.sector.id === townId)!
    expect(town.districts, townId).toHaveLength(count)
    expect(town.districts.filter((sector) => sector.townId === townId)).toHaveLength(9)
    const addresses = new Set(town.districts.map((sector) => `${sector.column}:${sector.row}`))
    const visited = new Set<string>()
    const queue = [[town.sector.column, town.sector.row]]
    for (const [x, y] of queue) {
      const key = `${x}:${y}`
      if (!addresses.has(key) || visited.has(key)) continue
      visited.add(key)
      queue.push([x! + 1, y!], [x! - 1, y!], [x!, y! + 1], [x!, y! - 1])
    }
    expect(visited.size).toBe(count)
    shapes.push(
      town.districts
        .map((sector) => [sector.column - town.sector.column, sector.row - town.sector.row])
        .sort()
        .join('|'),
    )
    const painted = worldRenderTerrain(view)
    for (const entry of town.districts.filter((entry) => !entry.townId)) {
      const canonical = resolveSector(entry.id)!
      const sector = painted.find((sector) => sector.id === entry.id)!
      expect(sector.settlementOutskirtsOf).toBe(townId)
      expect(sector.townId).toBeUndefined()
      for (const cell of sector.cells) expect(cell.safe).toBe(isSafe(canonical, cell))
      expect(sector.cells.some((cell) => cell.walkable && !cell.safe)).toBe(true)
      const props = settlementComposition(sector)
      const reserved = [...sceneryDressing(sector), ...naturalDressing(sector)]
      expect(props.length, entry.id).toBeGreaterThan(0)
      expect(props.length).toBeLessThanOrEqual(
        sector.landmarks.some((site) => site.kind === 'hamlet') ? 2 : 1,
      )
      for (const prop of props) {
        expect(sector.cells.find((cell) => cell.x === prop.x && cell.y === prop.y)).toMatchObject({
          terrain: '.',
          walkable: true,
        })
        expect(
          reserved.every((other) => Math.abs(other.x - prop.x) + Math.abs(other.y - prop.y) >= 3),
        ).toBe(true)
        expect(
          sector.landmarks.every(
            (site) => Math.abs(site.x - prop.x) + Math.abs(site.y - prop.y) >= 2,
          ),
        ).toBe(true)
      }
      const geometry = masterTeleportGeometry(
        {
          map: 'mainland',
          sectorNumber: mainlandSectorNumber(entry.column, entry.row)!,
          x: 6,
          y: 4,
        },
        resolveSector,
      )[0]!
      expect(geometry.rows).toBe(canonical.rows)
      expect(geometry.safeCells).toEqual(
        canonical.rows.flatMap((row, y) =>
          [...row].flatMap((_, x) => (isSafe(canonical, { x, y }) ? [y * 13 + x] : [])),
        ),
      )
    }
    expect(state).toEqual(saved)
  }
  expect(new Set(shapes).size).toBe(8)
  const colosseum = GRAND_DISCOVERY_SITES.find((site) => site.id === 'remote-colosseum')!
  expect(Math.max(...Object.values(expected)) * 117).toBeLessThan(
    colosseum.width * colosseum.height,
  )
})

it('carries outskirts through distant scenery and invalidates retained composition when metadata changes', () => {
  const district = atlasSectors().find((sector) => sector.settlementOutskirtsOf === 'aureth-crown')!
  const origin = atlasSectors().find(
    (sector) =>
      sector.atlasColumn === district.atlasColumn! + 3 && sector.atlasRow === district.atlasRow,
  )!
  const state = { ...newWorldState(), position: { sectorId: origin.id, x: 6, y: 4 } }
  const view = projectWorld(state, [], 1000, undefined, undefined, { width: 1920, height: 1080 })
  expect(view.sectors.some((sector) => sector.id === district.id)).toBe(false)
  expect(view.scenery!.some(([id]) => id === district.id)).toBe(true)
  const painted = worldRenderTerrain(view)
  expect(painted.find((sector) => sector.id === district.id)?.settlementOutskirtsOf).toBe(
    'aureth-crown',
  )
  const old = {
    ...view,
    atlas: view.atlas!.map((cell) => ({ ...cell, settlementOutskirtsOf: undefined })),
  }
  const before = worldRenderTerrain(old)
  const changed = worldRenderTerrain(view, before)
  expect(changed.find((sector) => sector.id === district.id)).not.toBe(
    before.find((sector) => sector.id === district.id),
  )
  expect(changed.find((sector) => sector.id === district.id)?.cells).toEqual(
    before.find((sector) => sector.id === district.id)?.cells,
  )
})

it('withholds public settlement metadata from private projections', () => {
  const view = projectWorld(
    { ...newWorldState(), position: { sectorId: 'uncharted-landing', x: 6, y: 4 } },
    [],
    1000,
  )
  expect(view.sectors.every((sector) => !sector.settlementOutskirtsOf)).toBe(true)
  expect(
    view.atlas!.filter((cell) => !cell.charted).every((cell) => !cell.settlementOutskirtsOf),
  ).toBe(true)
  expect(atlasSectors().filter((sector) => sector.settlementOutskirtsOf)).toHaveLength(19)
})
