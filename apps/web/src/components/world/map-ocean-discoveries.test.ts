import { describe, expect, it } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import type { CoastEdge } from './map-coast'
import { oceanFeaturePlacements, OCEAN_GRAND_WATER_APRON } from './map-grand-discoveries'
import { MAP_X, MAP_Y } from './map-projection'
const coast: CoastEdge = { side: 0, from: 0, to: 13, seed: 1, openStart: false, openEnd: false }
function sector(column: number): WorldSectorView {
  return {
    id: `atlas:${column}:20`,
    name: 'Coast',
    coordinate: '',
    regionId: 'hollow-coast',
    east: 0,
    north: 0,
    art: null,
    charted: true,
    atlasColumn: column,
    atlasRow: 20,
    landmarks: [],
    exits: [],
    cells: Array.from({ length: 117 }, (_, i) => ({
      x: i % 13,
      y: Math.floor(i / 13),
      terrain: '.',
      walkable: true,
      safe: false,
    })),
  }
}
const sectors = Array.from({ length: 128 }, (_, i) => sector(i))
const coasts = new Map(sectors.map((s) => [s.id, [coast]]))
describe('public offshore artwork', () => {
  it('uses sparse stable verified coastal sites and all six variants with bounded output', () => {
    const result = oceanFeaturePlacements(sectors, coasts)
    expect(result.length).toBeGreaterThan(1)
    expect(result.length).toBeLessThanOrEqual(12)
    expect(
      result.every((p) => p.sheet === 'ocean-features' && p.worldy === 176 && p.widthTiles <= 6),
    ).toBe(true)
    expect(oceanFeaturePlacements([...sectors].reverse(), coasts)).toEqual(result)
    for (const p of result)
      expect(oceanFeaturePlacements([sectors.find((s) => s.id === p.sectorId)!], coasts)).toEqual([
        p,
      ])
  })
  it('never invents ocean from missing chunks, private or partial borders', () => {
    expect(oceanFeaturePlacements(sectors, new Map())).toEqual([])
    expect(
      oceanFeaturePlacements(
        sectors.map((s) => ({ ...s, charted: false })),
        coasts,
      ),
    ).toEqual([])
    expect(
      oceanFeaturePlacements(
        sectors.map((s) => ({ ...s, warpedTheme: 'ashen' })),
        coasts,
      ),
    ).toEqual([])
    expect(
      oceanFeaturePlacements(
        sectors.map((s) => ({ ...s, cells: s.cells.filter((c) => c.y !== 0) })),
        coasts,
      ),
    ).toEqual([])
    expect(
      oceanFeaturePlacements(sectors, new Map(sectors.map((s) => [s.id, [{ ...coast, to: 4 }]]))),
    ).toEqual([])
    expect(
      oceanFeaturePlacements(
        sectors,
        new Map(sectors.map((s) => [s.id, [{ ...coast, side: 5 as 0 }]])),
      ),
    ).toEqual([])
  })
})

it('places rare native-detail large sea landmarks only after proving their entire open-water footprint', () => {
  const atlas = sectors.map((s) => ({
    id: s.id,
    name: s.name,
    coordinate: s.coordinate,
    regionId: s.regionId,
    column: s.atlasColumn!,
    row: s.atlasRow!,
    charted: true,
  }))
  const result = oceanFeaturePlacements(sectors, coasts, atlas),
    large = result.filter((p) => p.large)
  expect(large.length).toBeGreaterThan(0)
  expect(large.length).toBeLessThanOrEqual(2)
  for (const p of large) {
    expect(p).toMatchObject({
      sheet: 'ocean-grand-islet',
      columns: 1,
      rows: 1,
      widthTiles: 18,
      heightTiles: 12,
    })
    const obstruction = {
      ...atlas[0]!,
      id: 'obstruction',
      column: Math.floor((p.waterFootprint!.left + 12) / 13),
      row: Math.floor((p.waterFootprint!.top + 12) / 9),
    }
    expect(
      oceanFeaturePlacements(sectors, coasts, [...atlas, obstruction]).some(
        (candidate) => candidate.sectorId === p.sectorId && candidate.large,
      ),
    ).toBe(false)
  }
  expect(oceanFeaturePlacements(sectors, coasts, []).some((p) => p.large)).toBe(false)
})

it('proves every normalized water-apron corner and shoreline clearance while allowing airborne arch height', () => {
  const atlas = sectors.map((s) => ({
    id: s.id,
    name: s.name,
    coordinate: s.coordinate,
    regionId: s.regionId,
    column: s.atlasColumn!,
    row: s.atlasRow!,
    charted: true,
  }))
  const p = oceanFeaturePlacements(sectors, coasts, atlas).find((p) => p.large)!,
    f = p.waterFootprint!
  expect(f).toMatchObject({ width: 24, height: 24 })
  const originY = sectors.find((s) => s.id === p.sectorId)!.atlasRow! * 9
  expect(originY - (f.top + f.height)).toBeGreaterThanOrEqual(2)
  for (const x of [OCEAN_GRAND_WATER_APRON.left, OCEAN_GRAND_WATER_APRON.right])
    for (const y of [OCEAN_GRAND_WATER_APRON.top, OCEAN_GRAND_WATER_APRON.bottom]) {
      const sx = (x - p.anchorX) * p.widthTiles,
        sy = (y - p.anchorY) * p.heightTiles
      const wx = p.worldx + (sx / MAP_X + sy / MAP_Y) / 2,
        wy = p.worldy + (sy / MAP_Y - sx / MAP_X) / 2
      expect(wx).toBeGreaterThanOrEqual(f.left)
      expect(wx).toBeLessThanOrEqual(f.left + f.width)
      expect(wy).toBeGreaterThanOrEqual(f.top)
      expect(wy).toBeLessThanOrEqual(f.top + f.height)
    }
  const highPeakWorld =
    p.worldy + (((0 - p.anchorY) * p.heightTiles) / MAP_Y - (p.widthTiles * 0.5) / MAP_X) / 2
  expect(highPeakWorld).toBeLessThan(f.top)
})
