import { describe, expect, it } from 'vitest'
import { atlasSectors } from '@/world/atlas'
import { terrainWalkable } from '@/world/terrain'
import type { WorldSectorView } from '@/world/types'
import { grandDiscoveryPlacements, grandDiscoverySites } from './map-grand-discoveries'
import { projectMapPoint } from './map-projection'

function canonical(): WorldSectorView[] {
  return atlasSectors().map(({ rows, roads, ...sector }) => ({
    ...sector,
    exits: [...roads],
    cells: rows.flatMap((row, y) =>
      [...row].map((terrain, x) => ({
        x,
        y,
        terrain,
        safe: false,
        walkable: terrainWalkable(terrain),
      })),
    ),
  }))
}
function mutateCell(
  sectors: WorldSectorView[],
  x: number,
  y: number,
  change: Record<string, unknown>,
) {
  return sectors.map((s) => ({
    ...s,
    cells: s.cells.map((c) =>
      s.atlasColumn! * 13 + c.x === x && s.atlasRow! * 9 + c.y === y ? { ...c, ...change } : c,
    ),
  }))
}
describe('grand discovery placement', () => {
  it('places all fixed remote discoveries on canonical full footprints at genuinely large scale', () => {
    const sectors = canonical(),
      before = JSON.stringify(sectors)
    const result = grandDiscoveryPlacements(sectors)
    expect(result.map((p) => p.id)).toEqual([
      'remote-fortress',
      'abandoned-town',
      'elemental-valley',
      'remote-colosseum',
    ])
    expect(result.find((p) => p.id === 'remote-colosseum')).toMatchObject({
      widthTiles: 64,
      footprint: { width: 48, height: 36 },
    })
    expect(result.find((p) => p.id === 'elemental-valley')!.footprint.width).toBeGreaterThanOrEqual(
      12,
    )
    expect(JSON.stringify(sectors)).toBe(before)
    expect(grandDiscoveryPlacements([...sectors].reverse())).toEqual(result)
  })
  it('withholds a fixed site until every cell and its open approach are supplied, without relocation', () => {
    const sectors = canonical(),
      site = grandDiscoverySites[0]!
    const relevant = sectors.filter(
      (s) =>
        s.atlasColumn! * 13 < site.left + site.width &&
        s.atlasColumn! * 13 + 13 > site.left &&
        s.atlasRow! * 9 < site.top + site.height + 2 &&
        s.atlasRow! * 9 + 9 > site.top,
    )
    expect(grandDiscoveryPlacements(relevant).map((p) => p.id)).toEqual([site.id])
    const partial = relevant.map((s) => ({
      ...s,
      cells: s.cells.filter(
        (c) => s.atlasColumn! * 13 + c.x !== site.left || s.atlasRow! * 9 + c.y !== site.top,
      ),
    }))
    expect(grandDiscoveryPlacements(partial)).toEqual([])
    expect(grandDiscoveryPlacements(relevant.slice(0, -1))).toEqual([])
    expect(grandDiscoveryPlacements(relevant.map((s) => ({ ...s, charted: false })))).toEqual([])
    expect(
      grandDiscoveryPlacements(
        relevant.map((s) => ({ ...s, warpedTheme: 'haven' }) as WorldSectorView),
      ),
    ).toEqual([])
  })
  it('rejects blocked, wet, safe, occupied footprints and blocked approaches', () => {
    const sectors = canonical(),
      site = grandDiscoverySites[0]!
    for (const change of [
      { terrain: '~', walkable: false },
      { terrain: 'l', walkable: false },
      { terrain: '#', walkable: false },
      { terrain: '?', walkable: true },
      { safe: true },
    ])
      expect(
        grandDiscoveryPlacements(mutateCell(sectors, site.left, site.top, change)).some(
          (p) => p.id === site.id,
        ),
      ).toBe(false)
    expect(
      grandDiscoveryPlacements(
        mutateCell(sectors, site.left + Math.floor(site.width / 2), site.top + site.height, {
          walkable: false,
        }),
      ).some((p) => p.id === site.id),
    ).toBe(false)
    const occupied = sectors.map((s) =>
      s.atlasColumn === Math.floor(site.left / 13) && s.atlasRow === Math.floor(site.top / 9)
        ? {
            ...s,
            buildings: [
              {
                id: 'occupied',
                x: site.left % 13,
                y: site.top % 9,
                width: 1,
                height: 1,
                artIndex: 0,
              },
            ],
          }
        : s,
    )
    expect(grandDiscoveryPlacements(occupied).some((p) => p.id === site.id)).toBe(false)
  })
  it('requires the exact authoritative waterfall pool, and never invents a scenic bridge crossing', () => {
    const sectors = canonical(),
      site = grandDiscoverySites.find((s) => s.id === 'elemental-valley')!
    expect(
      grandDiscoveryPlacements(
        mutateCell(sectors, site.left + 30, site.top, { terrain: '.', walkable: true }),
      ).some((p) => p.id === site.id),
    ).toBe(false)
    expect(
      grandDiscoveryPlacements(sectors).some(
        (p) => p.index === 0 && p.sheet === 'grand-discoveries',
      ),
    ).toBe(false)
  })
  it('uses a canonical public proof for giant partial views while validating every supplied cell', () => {
    const sectors = canonical(),
      site = grandDiscoverySites.find((s) => s.id === 'remote-colosseum')!
    const local = sectors.filter(
      (s) =>
        s.atlasColumn === Math.floor(site.left / 13) && s.atlasRow === Math.floor(site.top / 9),
    )
    expect(grandDiscoveryPlacements(local)).toEqual([])
    expect(grandDiscoveryPlacements(local, [site.id]).map((p) => p.id)).toEqual([site.id])
    expect(
      grandDiscoveryPlacements(
        local.map((s) => ({ ...s, cells: [] })),
        [site.id],
      ),
    ).toEqual([])
    expect(
      grandDiscoveryPlacements(
        local.map((s) => ({ ...s, charted: false })),
        [site.id],
      ),
    ).toEqual([])
    expect(
      grandDiscoveryPlacements(
        mutateCell(local, site.left, site.top, { terrain: '?', walkable: true }),
        [site.id],
      ),
    ).toEqual([])
    expect(grandDiscoveryPlacements([], [site.id])).toEqual([])
  })
  it('aligns the painted arena and valley basin with their real canonical ground centres', () => {
    const placements = grandDiscoveryPlacements(canonical())
    const origin = { x: 0, y: 0 }
    for (const [id, cx, cy, targetX, targetY] of [
      ['remote-colosseum', 0.5, 0.52, 584, 334],
      ['elemental-valley', 0.5, 0.75, 929, 158],
    ] as const) {
      const p = placements.find((p) => p.id === id)!
      const anchor = projectMapPoint({ x: p.worldx, y: p.worldy }, origin, origin, 1, 0, 0)
      const desired = projectMapPoint({ x: targetX, y: targetY }, origin, origin, 1, 0, 0)
      expect(anchor.x + (cx - p.anchorX) * p.widthTiles).toBeCloseTo(desired.x, 8)
      expect(anchor.y + (cy - p.anchorY) * p.heightTiles).toBeCloseTo(desired.y, 8)
    }
  })
})
