import { describe, expect, it } from 'vitest'
import { atlasSectors } from '@/world/atlas'
import { isMajorMountainRangeSector, mountainPlacements } from './map-mountains'

describe('authored mountain scenery on authoritative terrain', () => {
  it('forms a substantial Starfall ridge with alpine and rocky peaks, tall spires, hills and open passes', () => {
    const sectors = atlasSectors().map((sector) => ({
      ...sector,
      cells: sector.rows.flatMap((row, y) =>
        [...row].map((terrain, x) => ({
          x,
          y,
          terrain,
          walkable: ['.', '=', 's', 't', 'w'].includes(terrain),
          safe: false,
        })),
      ),
    }))
    const ridge = sectors.filter(isMajorMountainRangeSector)
    const features = ridge.flatMap(mountainPlacements)
    expect(ridge.length).toBeGreaterThan(8)
    expect(features.filter((feature) => !feature.pass).length).toBeGreaterThan(8)
    expect(features.some((feature) => feature.heightTiles >= 6)).toBe(true)
    expect(features.some((feature) => feature.index >= 4 && feature.index <= 7)).toBe(true)
    expect(features.some((feature) => feature.index <= 3)).toBe(true)
    expect(features.some((feature) => feature.pass)).toBe(true)
  })

  it('anchors every mountain on an existing blocked rock and every pass on a walkable road', () => {
    const sectors = atlasSectors().slice(0, 2500)
    for (const sector of sectors) {
      const view = {
        ...sector,
        cells: sector.rows.flatMap((row, y) =>
          [...row].map((terrain, x) => ({
            x,
            y,
            terrain,
            walkable: ['.', '=', 's', 't', 'w'].includes(terrain),
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
        expect(cell?.walkable).toBe(feature.pass)
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
