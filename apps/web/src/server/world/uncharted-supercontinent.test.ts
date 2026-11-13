import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { VOID_REALMS, VOID_REALM_COLUMNS, VOID_REALM_ROWS, voidSectorId } from '@/world/void-realms'
import { terrainWalkable } from '@/world/terrain'
import type { WorldSector } from '@/world/types'
import { resolveVoidSector, voidRealmLanding } from './void-realms'
import {
  resolveWarpedContinentSector,
  warpedContinentSectors,
  warpedContinentSceneIds,
  WARPED_CONTINENT_LANDING,
} from './warped-continent'

function extent(
  resolve: (column: number, row: number) => WorldSector | null,
  start: { column: number; row: number; x: number; y: number },
) {
  const width = 64 * 13,
    height = 48 * 9
  const cells = new Uint8Array(width * height)
  let land = 0
  for (let row = 0; row < 48; row++)
    for (let column = 0; column < 64; column++) {
      const sector = resolve(column, row)
      if (!sector) continue
      expect(sector.charted).toBe(false)
      expect(sector.atlasColumn).toBeUndefined()
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 13; x++)
          if (terrainWalkable(sector.rows[y]![x]!)) {
            cells[(row * 9 + y) * width + column * 13 + x] = 1
            land++
          }
    }
  const index = (start.row * 9 + start.y) * width + start.column * 13 + start.x
  const queue = new Int32Array(width * height)
  queue[0] = index
  let length = 1
  cells[index] = 2
  for (let n = 0; n < length; n++) {
    const cell = queue[n]!,
      x = cell % width,
      y = Math.floor(cell / width)
    for (const next of [
      x > 0 ? cell - 1 : -1,
      x + 1 < width ? cell + 1 : -1,
      y > 0 ? cell - width : -1,
      y + 1 < height ? cell + width : -1,
    ])
      if (next >= 0 && cells[next] === 1) {
        cells[next] = 2
        queue[length++] = next
      }
  }
  // More connected traversable land than all 1870 public atlas sectors' cells,
  // not merely a large rectangle full of ocean or detached islands.
  expect(length).toBeGreaterThan(1870 * 13 * 9)
  expect(length / land).toBeGreaterThan(0.999)
  expect(cells[(36 * 9 + 4) * width + 60 * 13 + 6]).toBe(2)
  return { land, connected: length }
}

describe('real Uncharted supercontinent extent', () => {
  it('extends defining realm geography into the new continental interior', () => {
    const terrain = (realm: (typeof VOID_REALMS)[number]['id'], x: number, y: number) =>
      resolveVoidSector(voidSectorId(realm, Math.floor(x / 13), Math.floor(y / 9)))!.rows[y % 9]![
        x % 13
      ]
    expect(terrain('cinder-choir', 565, 335)).toBe('l')
    expect(terrain('amber-drowned', 640, 175)).toBe('~')
    expect(terrain('hollow-orchard', 567, 174)).toBe('~')
    expect(terrain('starfall-basin', 660, 300)).toBe('#')
    expect(terrain('ivory-veil', 565, 335)).not.toBe('l')
  })
  it('enumerates only local scene addresses without constructing the continent', () => {
    const ids = warpedContinentSceneIds('uncharted-landing')
    expect(ids).toContain('uncharted-landing')
    expect(ids).toContain('uncharted-expanse:0:0')
    expect(ids.length).toBeLessThanOrEqual(25)
    expect(warpedContinentSceneIds('uncharted-expanse:32:24')).toHaveLength(25)
    expect(warpedContinentSceneIds('uncharted-expanse:63:47')).toHaveLength(9)
    expect(warpedContinentSceneIds('mainland')).toEqual([])
  })
  it('preserves all legacy addresses and reaches the continental interior from the ferry landing', () => {
    expect(warpedContinentSectors).toHaveLength(13)
    for (const sector of warpedContinentSectors) {
      expect(resolveWarpedContinentSector(sector.id)).toBe(sector)
      expect(terrainWalkable(sector.rows[4]![6]!)).toBe(true)
    }
    expect(WARPED_CONTINENT_LANDING).toEqual({ sectorId: 'uncharted-landing', x: 6, y: 4 })
    const existing = new Map(
      warpedContinentSectors.map((sector) => [`${sector.east}:${sector.north}`, sector]),
    )
    extent(
      (column, row) =>
        existing.get(`${column}:${row}`) ??
        resolveWarpedContinentSector(`uncharted-expanse:${column}:${row}`),
      { column: 1, row: 1, x: 6, y: 4 },
    )
    for (const id of [
      'uncharted-expanse:64:0',
      'uncharted-expanse:0:48',
      'uncharted-expanse:01:0',
      'uncharted-expanse:1:1',
      'uncharted-expanse:1:2\n',
    ])
      expect(resolveWarpedContinentSector(id)).toBeNull()
  }, 30000)

  for (const realm of VOID_REALMS)
    it(`${realm.name} contains a connected supercontinent beyond its preserved original districts`, () => {
      expect(VOID_REALM_COLUMNS).toBe(64)
      expect(VOID_REALM_ROWS).toBe(48)
      const landing = voidRealmLanding(realm.id)
      const sector = resolveVoidSector(landing.sectorId)!
      extent((column, row) => resolveVoidSector(voidSectorId(realm.id, column, row)), {
        column: sector.east,
        row: sector.north,
        x: landing.x,
        y: landing.y,
      })
    }, 30000)
})
