import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { atlasAddress, atlasSectors, ATLAS_COLUMNS, ATLAS_ROWS } from './atlas'
import { terrainWalkable } from './terrain'
import { findWorldRoute, isWalkable, newWorldState, positionKey } from './travel'
import { projectWorld } from '@/server/world/world-service'
import { resolveSector, visibleSectors } from '@/server/world/world-content'

describe('one traversable world atlas', () => {
  it('provides unique sectors at one address with room for a population of 100', () => {
    const sectors = atlasSectors()
    expect(ATLAS_COLUMNS).toBe(64)
    expect(ATLAS_ROWS).toBe(32)
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
    const districts = sectors.filter((s) => s.townId === 'verdant-expanse')
    expect(districts.length).toBe(9)
    const open = districts.flatMap((s) => s.rows.join('').split('')).filter(terrainWalkable).length
    expect(open).toBeGreaterThan(750)
    expect(sectors.filter((s) => !s.townId).length).toBeGreaterThan(100)
    const root = sectors.find((s) => s.id === 'verdant-expanse')!
    expect(root.landmarks.some((l) => l.name === 'Marketplace')).toBe(true)
    expect(root.landmarks.some((l) => l.name === 'Town Square')).toBe(true)
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
    const target = sectors.find((s) => s.id === 'frostmere')!
    const route = findWorldRoute(
      newWorldState().position,
      { sectorId: target.id, x: 5, y: 4 },
      sectors,
    )
    expect(route?.length).toBeGreaterThan(80)
  })
  it('bounds scene projection and retains private frontier and legacy parked positions', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    expect(view.sectors.length).toBeLessThanOrEqual(25)
    expect(view.atlas!.length).toBeGreaterThan(150)
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
  expect(view.sectors.some((s) => s.id === 'atlas:33:6')).toBe(false)
})
