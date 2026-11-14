import { describe, expect, it } from 'vitest'
import { atlasSectors } from './atlas'
import { GRAND_DISCOVERY_SITES } from './discovery-sites'
import { grandDiscoveryBarrier, structuralTerrainAt } from './discovery-collision'
import { terrainWalkable } from './terrain'

describe('world-size discovery collision', () => {
  it('closes true arena walls while leaving its outer approach and central floor legal', () => {
    const arena = GRAND_DISCOVERY_SITES.find((s) => s.id === 'remote-colosseum')!
    const walls = []
    for (let y = 0; y < arena.height; y++)
      for (let x = 0; x < arena.width; x++)
        if (grandDiscoveryBarrier(arena.id, x, y)) walls.push([x, y])
    expect(walls.length).toBeGreaterThan(80)
    expect(
      grandDiscoveryBarrier(arena.id, Math.floor(arena.width / 2), Math.floor(arena.height * 0.85)),
    ).toBe(false)
    expect(
      grandDiscoveryBarrier(arena.id, Math.floor(arena.width / 2), Math.floor(arena.height * 0.52)),
    ).toBe(false)
  })
  it('keeps the waterfall central arrival approach while cliffs are nonwalkable', () => {
    const site = GRAND_DISCOVERY_SITES.find((s) => s.id === 'elemental-valley')!
    expect(grandDiscoveryBarrier(site.id, 0, 8)).toBe(true)
    expect(grandDiscoveryBarrier(site.id, site.width - 1, 8)).toBe(true)
    expect(grandDiscoveryBarrier(site.id, Math.floor(site.width / 2), site.height - 1)).toBe(false)
    expect(grandDiscoveryBarrier(site.id, Math.floor(site.width / 2), 2)).toBe(false)
  })
  it('blocks crossing roads and shallow pools where the wall is solid without changing deep water/lava', () => {
    const site = GRAND_DISCOVERY_SITES.find((s) => s.id === 'remote-colosseum')!
    const x = site.left + Math.floor(site.width * 0.92),
      y = site.top + Math.floor(site.height * 0.5)
    for (const t of ['.', 't', '=', 'w'])
      expect(structuralTerrainAt(x, y, t)).toBe('#')
    for (const t of ['s', '~', 'l', '#', 'b'])
      expect(structuralTerrainAt(x, y, t)).toBe(t)
  })
  it('prohibits traversing every solid colosseum wall, including historic road intersections', () => {
    const site = GRAND_DISCOVERY_SITES.find((s) => s.id === 'remote-colosseum')!
    const sectorByAddress = new Map(
      atlasSectors().map((sector) => [sector.atlasColumn + ':' + sector.atlasRow, sector]),
    )
    let blocked = 0
    for (let y = 0; y < site.height; y++)
      for (let x = 0; x < site.width; x++) {
        if (!grandDiscoveryBarrier(site.id, x, y)) continue
        const globalX = site.left + x
        const globalY = site.top + y
        const sector = sectorByAddress.get(
          Math.floor(globalX / 13) + ':' + Math.floor(globalY / 9),
        )
        if (!sector) continue
        const terrain = sector.rows[globalY % 9]?.[globalX % 13] ?? '#'
        expect(terrainWalkable(terrain)).toBe(false)
        blocked++
      }
    expect(blocked).toBeGreaterThan(80)
  })
  it('is reflected in server-authoritative atlas terrain, not only sprite placement', () => {
    const sectors = atlasSectors()
    const lookup = new Map(sectors.map((s) => [s.atlasColumn + ':' + s.atlasRow, s]))
    const at = (x: number, y: number) => {
      const s = lookup.get(Math.floor(x / 13) + ':' + Math.floor(y / 9))
      return s?.rows[y % 9]?.[x % 13]
    }
    const colosseum = GRAND_DISCOVERY_SITES.find((s) => s.id === 'remote-colosseum')!
    let walls = 0,
      legalGates = 0
    for (let dy = 0; dy < colosseum.height; dy++)
      for (let dx = 0; dx < colosseum.width; dx++) {
        const t = at(colosseum.left + dx, colosseum.top + dy)
        if (t === '#' && grandDiscoveryBarrier(colosseum.id, dx, dy)) walls++
        if (
          !grandDiscoveryBarrier(colosseum.id, dx, dy) &&
          terrainWalkable(t ?? '') &&
          Math.abs(dx - 24) < 3
        )
          legalGates++
      }
    expect(walls).toBeGreaterThan(25)
    expect(legalGates).toBeGreaterThan(9)
  })
})
