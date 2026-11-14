import { describe, expect, it } from 'vitest'
import { atlasSectors } from './atlas'
import { mountainFrontierAt, mountainFrontierPass } from './mountain-frontier'
import { terrainWalkable } from './terrain'
import { findWorldRoute } from './travel'

describe('northern mountain frontier', () => {
  it('creates a substantial, continuous mountain spur outside old settlements', () => {
    const sectors = atlasSectors()
    const spur = sectors.filter(
      (s) => s.generated && mountainFrontierAt(s.atlasColumn ?? -1, s.atlasRow ?? -1) && !s.townId,
    )
    expect(spur.length).toBeGreaterThan(16)
    const rocky = spur.reduce(
      (count, sector) =>
        count +
        sector.rows
          .join('')
          .split('')
          .filter((c) => c === '#').length,
      0,
    )
    expect(rocky).toBeGreaterThan(spur.length * 20)
    expect(spur.some((sector) => (sector.atlasRow ?? 64) < 8)).toBe(true)
  })
  it('keeps a lawful cross-shaped pass through every added mountain sector', () => {
    const sectors = atlasSectors()
    const spur = sectors.filter(
      (s) =>
        s.generated &&
        mountainFrontierAt(s.atlasColumn ?? -1, s.atlasRow ?? -1) &&
        (s.atlasRow ?? 64) < 8,
    )
    expect(spur.length).toBeGreaterThan(8)
    for (const s of spur) {
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 13; x++) {
          if (mountainFrontierPass(x, y)) expect(terrainWalkable(s.rows[y]![x]!)).toBe(true)
        }
    }
  })
  it('connects the new frontier to existing Starfall foothills on a legal route', () => {
    const sectors = atlasSectors()
    const start = sectors.find((s) => s.atlasColumn === 48 && s.atlasRow === 9)
    const end = sectors.find((s) => s.atlasColumn === 48 && s.atlasRow === 7)
    expect(start).toBeDefined()
    expect(end).toBeDefined()
    expect(end!.townId).toBeUndefined()
    expect(terrainWalkable(end!.rows[4]![6]!)).toBe(true)
    const route = findWorldRoute(
      { sectorId: start!.id, x: 6, y: 4 },
      { sectorId: end!.id, x: 6, y: 4 },
      sectors,
    )
    expect(route?.length).toBeGreaterThan(9)
    expect(
      route?.every((step) => {
        const sector = sectors.find((s) => s.id === step.position.sectorId)
        return sector && terrainWalkable(sector.rows[step.position.y]![step.position.x]!)
      }),
    ).toBe(true)
  })
})
