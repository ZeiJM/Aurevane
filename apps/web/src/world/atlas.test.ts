import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasAddress, atlasSectors, ATLAS_COLUMNS, ATLAS_ROWS } from './atlas'
import { CHARTED_SECTORS } from './catalog'
import { terrainWalkable } from './terrain'
import { findWorldRoute, isWalkable, newWorldState, positionKey } from './travel'
import { projectWorld } from '@/server/world/world-service'
import { resolveSector, visibleSectors } from '@/server/world/world-content'

describe('one traversable world atlas', () => {
  it('provides unique sectors at one address with room for a population of 100', () => {
    const sectors = atlasSectors()
    expect(ATLAS_COLUMNS).toBe(128)
    expect(ATLAS_ROWS).toBe(64)
    expect(new Set(sectors.map((s) => s.id)).size).toBe(sectors.length)
    expect(new Set(sectors.map((s) => JSON.stringify(atlasAddress(s)))).size).toBe(sectors.length)
    expect(
      sectors.reduce((n, s) => n + s.rows.join('').split('').filter(terrainWalkable).length, 0),
    ).toBeGreaterThan(15000)
    expect(sectors.every((s) => s.rows.length === 9 && s.rows.every((r) => r.length === 13))).toBe(
      true,
    )
  })
  it('has symmetric crossings only between adjacent, walkable land cells', () => {
    const sectors = atlasSectors(),
      byId = new Map(sectors.map((s) => [s.id, s]))
    for (const sector of sectors)
      for (const road of sector.roads) {
        const to = byId.get(road.to.sectorId)!
        expect(to).toBeDefined()
        expect(isWalkable(sector, road.from)).toBe(true)
        expect(isWalkable(to, road.to)).toBe(true)
        const a = atlasAddress(sector)!,
          b = atlasAddress(to)!
        expect(Math.abs(a.column - b.column) + Math.abs(a.row - b.row)).toBe(1)
        expect(
          to.roads.some(
            (r) =>
              positionKey(r.from) === positionKey(road.to) &&
              positionKey(r.to) === positionKey(road.from),
          ),
        ).toBe(true)
      }
  })
  it('gives towns multiple airy districts with inter-town countryside', () => {
    const sectors = atlasSectors()
    const townIds = [...new Set(sectors.map((s) => s.townId).filter(Boolean))]
    expect(townIds.length).toBe(8)
    const bounds = townIds.map((id) => {
      const districts = sectors.filter((s) => s.townId === id)
      expect(districts.length, `${id} district count`).toBe(9)
      expect(districts.some((s) => s.id === id)).toBe(true)
      const root = districts.find((s) => s.id === id)!,
        original = CHARTED_SECTORS.find((s) => s.id === id)!,
        address = /^S(\d{2})-(\d{2})$/.exec(original.coordinate)!
      expect(atlasAddress(root)).toEqual({
        column: (Number(address[1]) - 1) * 4,
        row: (Number(address[2]) - 1) * 4,
      })
      const columns = districts.map((s) => s.atlasColumn!),
        rows = districts.map((s) => s.atlasRow!)
      expect(new Set(columns).size).toBe(3)
      expect(new Set(rows).size).toBe(3)
      const open = districts
        .flatMap((s) => s.rows.join('').split(''))
        .filter(terrainWalkable).length
      expect(open, `${id} open ground`).toBeGreaterThan(750)
      return {
        id,
        left: Math.min(...columns),
        right: Math.max(...columns),
        top: Math.min(...rows),
        bottom: Math.max(...rows),
      }
    })
    for (let i = 0; i < bounds.length; i++)
      for (const other of bounds.slice(i + 1)) {
        const town = bounds[i]!
        expect(
          town.right + 9 < other.left ||
            other.right + 9 < town.left ||
            town.bottom + 9 < other.top ||
            other.bottom + 9 < town.top,
          `${town.id} and ${other.id} countryside gap`,
        ).toBe(true)
      }
    expect(sectors.filter((s) => !s.townId).length).toBeGreaterThan(100)
    const root = sectors.find((s) => s.id === 'verdant-expanse')!
    expect(root.landmarks.some((l) => l.name === 'Marketplace')).toBe(true)
    expect(root.landmarks.some((l) => l.name === 'Town Square')).toBe(true)
  })
  it('makes scenic countryside destinations real, reachable groves outside towns', () => {
    const sectors = atlasSectors()
    for (const [id, landscape, name] of [
      ['atlas:62:28', 'sakura', 'Cherryblossom Grove'],
      ['atlas:58:27', 'autumn', 'Amberwood Glade'],
      ['atlas:48:22', 'wisteria', 'Wisteria Hollow'],
      ['atlas:69:36', 'willow', 'Willow Cascades'],
      ['atlas:50:34', 'wildflowers', 'Wildflower Meadow'],
    ] as const) {
      const sector = sectors.find((s) => s.id === id)!
      expect(sector, id).toBeDefined()
      expect(sector.townId).toBeUndefined()
      expect(sector.landscape).toBe(landscape)
      expect(sector.name).toBe(name)
      const landmark = sector.landmarks.find((l) => l.name === name)!
      expect(landmark).toBeDefined()
      expect(landmark.sceneryIndex).toBeGreaterThanOrEqual(4)
      expect(isWalkable(sector, landmark)).toBe(true)
      const route = findWorldRoute(
        newWorldState().position,
        { sectorId: id, x: landmark.x, y: landmark.y },
        sectors,
      )
      expect(route?.length, name).toBeGreaterThan(25)
      expect(sectors.filter((s) => s.landscape === landscape).length).toBeGreaterThanOrEqual(5)
      expect(sectors.filter((s) => s.landscape === landscape).every((s) => !s.townId)).toBe(true)
    }
    const sakura = sectors.find((s) => s.id === 'atlas:62:28')!
    expect(
      sakura.rows
        .join('')
        .split('')
        .filter((t) => t === 't').length,
    ).toBeGreaterThan(18)
    const cascade = sectors.find((s) => s.id === 'atlas:69:36')!
    expect(cascade.rows.join('')).toContain('~')
    expect(terrainWalkable('~')).toBe(false)
  })
  it('makes foliage walkable while keeping water, lava and buildings blocked', () => {
    for (const t of ['.', '=', 's', 't']) expect(terrainWalkable(t)).toBe(true)
    for (const t of ['~', 'l', 'b', '#', '?', '']) expect(terrainWalkable(t)).toBe(false)
  })
  it('gives all eight towns distinct streets and keeps their squares clear of dense trees', () => {
    const sectors = atlasSectors()
    const towns = [...new Set(sectors.map((s) => s.townId).filter(Boolean))]
    const streets = towns.map((id) =>
      sectors
        .filter((s) => s.townId === id)
        .map((s) =>
          s.rows
            .map((r) => [...r].map((t) => (t === '=' || t === 's' ? '1' : '0')).join(''))
            .join(''),
        )
        .join(''),
    )
    expect(new Set(streets).size).toBe(8)
    for (const id of towns) {
      const root = sectors.find((s) => s.id === id)!
      expect(
        root.rows
          .join('')
          .split('')
          .filter((t) => t === 't').length,
      ).toBeLessThan(15)
      for (const landmark of root.landmarks) expect(isWalkable(root, landmark)).toBe(true)
    }
  })
  it('connects every ordinary land sector to the starting town', () => {
    const sectors = atlasSectors(),
      byId = new Map(sectors.map((s) => [s.id, s]))
    const visited = new Set(['verdant-expanse']),
      queue = ['verdant-expanse']
    for (let i = 0; i < queue.length; i++)
      for (const road of byId.get(queue[i]!)!.roads) {
        if (!visited.has(road.to.sectorId)) {
          visited.add(road.to.sectorId)
          queue.push(road.to.sectorId)
        }
      }
    expect(visited.size).toBe(sectors.length)
    for (const target of sectors.filter((s) => s.townId === s.id && s.id !== 'verdant-expanse')) {
      const route = findWorldRoute(
        newWorldState().position,
        { sectorId: target.id, x: 5, y: 4 },
        sectors,
      )
      expect(route?.length, `${target.name} actual travel route`).toBeGreaterThan(80)
      expect(route!.length).toBeLessThanOrEqual(1500)
    }
  })
  it('bounds scene projection and retains private frontier and legacy parked positions', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    expect(view.sectors.length).toBeLessThanOrEqual(25)
    expect(view.atlas!.length).toBeGreaterThan(150)
    expect(view.atlas!.length).toBeLessThan(2000)
    expect(JSON.stringify(view).length).toBeLessThan(600000)
    expect(JSON.stringify(view)).not.toContain('Weathered Observatory')
    expect(resolveSector('trail:aureth-crown:crown-road:1')).toBeTruthy()
    expect(resolveSector('survey-01')).toBeTruthy()
  })
})

it('keeps a route back from a middle legacy trail without requiring previously visited neighbours', () => {
  const state = {
    ...newWorldState(),
    position: { sectorId: 'trail:aureth-crown:crown-road:2', x: 6, y: 4 },
  }
  expect(
    findWorldRoute(state.position, { sectorId: 'aureth-crown', x: 6, y: 4 }, visibleSectors(state))
      ?.length,
  ).toBeGreaterThan(0)
})
it('never projects a public atlas chunk over current private wild terrain', () => {
  const state = {
    ...newWorldState(),
    position: { sectorId: 'wild:frostmere:east:1:0', x: 6, y: 4 },
    discoveries: { 'wild:frostmere:east:1:0': [58] },
  }
  const view = projectWorld(state, [], 1000)
  expect(view.sectors.some((s) => s.id === 'wild:frostmere:east:1:0')).toBe(true)
  expect(view.sectors.find((s) => s.id === 'wild:frostmere:east:1:0')).toMatchObject({
    atlasColumn: 65,
    atlasRow: 12,
  })
  expect(atlasSectors().some((s) => s.id === 'atlas:65:12')).toBe(true)
  expect(view.sectors.some((s) => s.id === 'atlas:65:12')).toBe(false)
})
