import { describe, expect, it } from 'vitest'
import { atlasSectors } from '@/world/atlas'
import { terrainWalkable } from '@/world/terrain'
import type { WorldSectorView } from '@/world/types'
import {
  isMajorMountainRangeSector,
  indexMountainPlacements,
  mountainPlacements,
  denseMountainRidge,
  drawMountainScree,
} from './map-mountains'

describe('authored mountain scenery on authoritative terrain', () => {
  it('forms a substantial Starfall ridge with alpine and rocky peaks, tall spires, hills and open passes', () => {
    const sectors = atlasSectors().map((sector) => ({
      ...sector,
      cells: sector.rows.flatMap((row, y) =>
        [...row].map((terrain, x) => ({
          x,
          y,
          terrain,
          walkable: terrainWalkable(terrain),
          safe: false,
        })),
      ),
    }))
    const ridge = sectors.filter(isMajorMountainRangeSector)
    const features = ridge.flatMap((s) => mountainPlacements(s))
    expect(ridge.length).toBeGreaterThan(8)
    expect(features.filter((feature) => !feature.pass).length).toBeGreaterThan(8)
    expect(
      features.filter((feature) => !feature.pass).every((feature) => feature.heightTiles >= 9),
    ).toBe(true)
    expect(features.filter((feature) => !feature.pass).length).toBeLessThan(ridge.length / 2)
    expect(features.some((feature) => feature.index >= 4 && feature.index <= 7)).toBe(true)
    expect(features.some((feature) => feature.index <= 3)).toBe(true)
    expect(features.some((feature) => feature.pass)).toBe(true)
  })

  it('anchors every mountain on dry rocky ground and every pass on a marked road', () => {
    const sectors = atlasSectors().slice(0, 2500)
    for (const sector of sectors) {
      const view = {
        ...sector,
        cells: sector.rows.flatMap((row, y) =>
          [...row].map((terrain, x) => ({
            x,
            y,
            terrain,
            walkable: terrainWalkable(terrain),
            safe: false,
          })),
        ),
      }
      const placements = mountainPlacements(view)
      expect(mountainPlacements(view)).toEqual(placements)
      for (const feature of placements) {
        const cell = view.cells.find(
          (candidate) => candidate.x === feature.cellX && candidate.y === feature.cellY,
        )
        expect(cell?.terrain).toBe(feature.pass ? '=' : '#')
        expect(cell?.walkable).toBe(true)
        if (!feature.pass)
          expect(
            view.landmarks.every(
              (l) => Math.abs(l.x - feature.cellX) > 3.5 || Math.abs(l.y - feature.cellY) > 4,
            ),
          ).toBe(true)
      }
    }
  })
  it('does not invent secret mountains from uncharted public scenery', () => {
    const sector = {
      id: 'hidden',
      regionId: 'starfall-highlands',
      townId: undefined,
      charted: false,
      warpedTheme: undefined,
      atlasColumn: 46,
      atlasRow: 19,
      landmarks: [],
      cells: [{ x: 3, y: 3, terrain: '#', walkable: false, safe: false }],
    }
    expect(mountainPlacements(sector)).toEqual([])
    expect(mountainPlacements({ ...sector, charted: true }).every((feature) => !feature.pass)).toBe(
      true,
    )
    expect(mountainPlacements({ ...sector, townId: 'aureth-crown', charted: true })).toEqual([])
  })
})

it('groups exposed scree into spaced outcrops outside towns', () => {
  const sector = atlasSectors().find((s) => s.atlasColumn === 48 && s.atlasRow === 7)!
  const view = {
    ...sector,
    cells: sector.rows.flatMap((row, y) =>
      [...row].map((terrain, x) => ({
        x,
        y,
        terrain,
        walkable: terrainWalkable(terrain),
        safe: false,
      })),
    ),
  }
  expect(denseMountainRidge(view)).toBe(true)
  const rock = view.cells.filter((cell) => cell.terrain === '#')
  const scattered = rock.filter((cell) => drawMountainScree(sector.id, cell.x, cell.y))
  expect(scattered.length).toBeGreaterThan(2)
  expect(scattered.length).toBeLessThan(rock.length * 0.22)
  const town = atlasSectors().find((s) => s.id === 'starfall-highlands')!
  expect(
    denseMountainRidge({
      ...town,
      cells: town.rows.flatMap((row, y) =>
        [...row].map((terrain, x) => ({
          x,
          y,
          terrain,
          walkable: terrainWalkable(terrain),
          safe: false,
        })),
      ),
    }),
  ).toBe(false)
})

it('keeps a large formation off neighboring water, missing ground and landmarks in its sightline', () => {
  const source = atlasSectors().find((s) => s.id === 'atlas:46:7')!
  const cells = Array.from({ length: 117 }, (_, i) => {
    const x = i % 13,
      y = Math.floor(i / 13)
    return { x, y, terrain: x === 6 && y === 4 ? '#' : '.', walkable: true, safe: false }
  })
  const sector: WorldSectorView = { ...source, landmarks: [], exits: [], cells }
  expect(indexMountainPlacements([sector])).toHaveLength(1)
  const support = (c: (typeof cells)[number]) => c.x === 4 && c.y === 6
  for (const terrain of ['~', 'w', 'l', '=']) {
    const changed = {
      ...sector,
      cells: cells.map((c) =>
        support(c) ? { ...c, terrain, walkable: terrainWalkable(terrain) } : c,
      ),
    }
    expect(indexMountainPlacements([changed])).toEqual([])
  }
  expect(indexMountainPlacements([{ ...sector, cells: cells.filter((c) => !support(c)) }])).toEqual(
    [],
  )
  const neighbor: WorldSectorView = {
    ...sector,
    id: 'atlas:45:6',
    atlasColumn: 45,
    atlasRow: 6,
    cells: [],
    landmarks: [{ id: 'shrine', kind: 'shrine', name: 'Shrine', x: 12, y: 7 }],
  }
  expect(indexMountainPlacements([sector, neighbor])).toEqual([])
})
