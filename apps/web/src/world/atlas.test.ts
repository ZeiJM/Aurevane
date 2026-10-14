import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const shorelineCapture = vi.hoisted(() => ({ before: [] as WorldSector[] }))
vi.mock('./road-shorelines', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./road-shorelines')>()
  return {
    ...actual,
    trimRoadShorelines(sectors: readonly WorldSector[]) {
      // world-content builds its compatibility graph during module import.
      // Capture that first untrimmed atlas, then execute the real correction.
      if (!shorelineCapture.before.length)
        shorelineCapture.before = sectors.map((sector) => ({ ...sector, rows: [...sector.rows] }))
      actual.trimRoadShorelines(sectors)
    },
  }
})
import { atlasAddress, atlasSectors, ATLAS_COLUMNS, ATLAS_ROWS } from './atlas'
import { CHARTED_SECTORS } from './catalog'
import { terrainWalkable } from './terrain'
import { findWorldRoute, isSafe, isWalkable, newWorldState, positionKey } from './travel'
import { projectWorld } from '@/server/world/world-service'
import { isKnownCell, resolveSector, visibleSectors } from '@/server/world/world-content'
import { resolveWorldIntent } from '@/server/world/world-service'
import { atlasNeighbor, wrappedColumnDistance } from './topology'
import { trimRoadShorelines } from './road-shorelines'
import type { WorldSector } from './types'

describe('one traversable world atlas', () => {
  it('preserves saved walkability and PvP safety at every public atlas cell', () => {
    const sectors = atlasSectors()
    expect(shorelineCapture.before).toHaveLength(sectors.length)
    const previous = new Map(shorelineCapture.before.map((sector) => [sector.id, sector]))
    const changed: string[] = []
    for (const sector of sectors)
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 13; x++) {
          const before = previous.get(sector.id)!
          if (
            isWalkable(before, { x, y }) !== isWalkable(sector, { x, y }) ||
            isSafe(before, { x, y }) !== isSafe(sector, { x, y })
          )
            changed.push(`${sector.id}:${x}:${y}`)
        }
    expect(changed).toEqual([])
  })
  it('keeps the authored Emberreach channel lava through both bridge mouths without changing collision', () => {
    const sector = atlasSectors().find((sector) => sector.id === 'emberreach')!
    const authored = CHARTED_SECTORS.find((sector) => sector.id === 'emberreach')!
    for (let y = 0; y < 9; y++) {
      expect(sector.rows[y]![10]).toBe(y === 4 ? '=' : 'l')
      expect(terrainWalkable(sector.rows[y]![10]!)).toBe(terrainWalkable(authored.rows[y]![10]!))
    }
    expect(sector.landmarks.some((landmark) => landmark.kind === 'bridge')).toBe(true)
  })

  it('ends paved coastal approaches before unavailable ocean chunks', () => {
    const sectors = atlasSectors()
    const byAddress = new Map(
      sectors.map((sector) => [`${sector.atlasColumn}:${sector.atlasRow}`, sector]),
    )
    const stranded: string[] = []
    for (const sector of sectors) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const address = atlasNeighbor(sector.atlasColumn!, sector.atlasRow!, dx, dy)
        if (address && byAddress.has(`${address.column}:${address.row}`)) continue
        for (let offset = 0; offset < (dx ? 9 : 13); offset++) {
          const x = dx ? (dx > 0 ? 12 : 0) : offset
          const y = dy ? (dy > 0 ? 8 : 0) : offset
          if (sector.rows[y]![x] === '=' || sector.rows[y]![x] === 's')
            stranded.push(`${sector.id}:${x}:${y}`)
        }
      }
    }
    expect(stranded).toEqual([])
    const eastCoast = sectors.find(
      (sector) =>
        !byAddress.has(`${(sector.atlasColumn! + 1) % ATLAS_COLUMNS}:${sector.atlasRow}`) &&
        sector.rows[4]!.endsWith('=..'),
    )!
    expect(eastCoast).toBeDefined()
    expect(isWalkable(eastCoast, { x: 12, y: 4 })).toBe(true)
    expect(eastCoast.roads.some((road) => road.from.x === 12 && road.from.y === 4)).toBe(false)
  })
  it('has public connected countryside at both sides of the longitude seam', () => {
    const sectors = atlasSectors()
    const west = sectors.find((s) => s.atlasColumn === 127 && s.atlasRow === 32)
    const east = sectors.find((s) => s.atlasColumn === 0 && s.atlasRow === 32)
    expect(west).toBeDefined()
    expect(east).toBeDefined()
    for (const [from, to, x, targetX] of [
      [west!, east!, 12, 0],
      [east!, west!, 0, 12],
    ] as const) {
      expect(from.charted).toBe(true)
      expect(from.townId).toBeUndefined()
      expect(from.roads).toContainEqual({
        from: { sectorId: from.id, x, y: 4 },
        to: { sectorId: to.id, x: targetX, y: 4 },
        durationMs: 200,
        name: to.name,
      })
    }
    expect(west!.regionId).toBe(east!.regionId)
    const view = projectWorld(
      { ...newWorldState(), position: { sectorId: west!.id, x: 12, y: 4 } },
      [],
      1000,
    )
    expect(view.sectors.some((s) => s.id === east!.id)).toBe(true)
    expect(view.sectors.some((s) => s.atlasColumn === 1 && s.atlasRow === 32)).toBe(true)
    expect(view.sectors.length).toBeLessThanOrEqual(25)
    expect(JSON.stringify(view)).not.toContain('Weathered Observatory')
  })

  it('takes a short authoritative seam route in either direction at the ordinary 200ms pace', () => {
    const sectors = atlasSectors()
    for (const [from, to] of [
      [
        { sectorId: 'atlas:127:32', x: 11, y: 4 },
        { sectorId: 'atlas:0:32', x: 1, y: 4 },
      ],
      [
        { sectorId: 'atlas:0:32', x: 1, y: 4 },
        { sectorId: 'atlas:127:32', x: 11, y: 4 },
      ],
    ] as const) {
      const route = findWorldRoute(from, to, sectors)
      expect(route).toHaveLength(3)
      expect(route!.every((step) => step.durationMs === 200)).toBe(true)
      let state = resolveWorldIntent(
        { ...newWorldState(), position: from },
        { kind: 'walk', destination: to },
        1000,
      )
      expect(state.route.length).toBeLessThanOrEqual(256)
      expect(resolveWorldIntent(state, { kind: 'tick' }, 1199).position).toEqual(from)
      state = resolveWorldIntent(state, { kind: 'tick' }, 1200)
      expect(state.position).toEqual(route![0]!.position)
      state = resolveWorldIntent(state, { kind: 'tick' }, 1600)
      expect(state.position).toEqual(to)
      expect(state.route).toEqual([])
    }
    expect(
      findWorldRoute(
        { sectorId: 'atlas:127:32', x: 12, y: 4 },
        { sectorId: 'atlas:0:0', x: 0, y: 4 },
        sectors,
      ),
    ).toBeNull()
    expect(sectors.some((s) => s.atlasRow! < 0 || s.atlasRow! >= ATLAS_ROWS)).toBe(false)
  })
  it('adds sparse interior lakes to new countryside without blocking its road approaches', () => {
    const newCountryside = atlasSectors().filter(
      (sector) => sector.atlasColumn! < 38 || sector.atlasColumn! > 96,
    )
    const ponds = newCountryside.filter((sector) => sector.rows.some((row) => row.includes('~')))
    expect(ponds.length).toBeGreaterThan(5)
    expect(ponds.length).toBeLessThan(newCountryside.length / 3)
    for (const sector of ponds) {
      expect(sector.rows[4]).not.toContain('~')
      expect(sector.rows[0]).not.toContain('~')
      expect(sector.rows[8]).not.toContain('~')
      expect(sector.rows.every((row) => row[0] !== '~' && row[12] !== '~')).toBe(true)
      if (sector.atlasColumn! % 4 === 0)
        expect(sector.rows.every((row) => row[6] !== '~')).toBe(true)
    }
  })
  it('reaches the dateline from existing towns with bounded saved route windows', () => {
    const state = newWorldState()
    for (const sectorId of ['atlas:127:32', 'atlas:0:32']) {
      const destination = { sectorId, x: 6, y: 4 }
      const route = findWorldRoute(state.position, destination, visibleSectors(state), (p) =>
        isKnownCell(state, p),
      )
      expect(route?.length, sectorId).toBeGreaterThan(400)
      expect(route!.every((step) => step.durationMs === 200)).toBe(true)
      const planned = resolveWorldIntent(state, { kind: 'walk', destination }, 1000)
      expect(planned.route).toHaveLength(256)
      expect(planned.routeDestination).toEqual(destination)
    }
  })
  it.each([
    { from: { sectorId: 'aureth-crown', x: 6, y: 4 }, to: 'frostmere', steps: 300 },
    { from: { sectorId: 'aureth-crown', x: 6, y: 4 }, to: 'umbral-march', steps: 488 },
    { from: { sectorId: 'atlas:47:33', x: 6, y: 4 }, to: 'verdant-expanse', steps: 318 },
  ])(
    'plots connected travel from $from.sectorId to $to despite unrelated frontier discoveries',
    ({ from, to, steps }) => {
      const state = { ...newWorldState(), position: from, discoveries: { 'survey-01': [110] } }
      const sectors = visibleSectors(state),
        destination = { sectorId: to, x: 6, y: 4 }
      const route = findWorldRoute(from, destination, sectors, (position) =>
        isKnownCell(state, position),
      )
      expect(route).toHaveLength(steps)
      expect(route!.every((step) => step.durationMs === 200)).toBe(true)
      const planned = resolveWorldIntent(state, { kind: 'walk', destination }, 1000)
      expect(planned.route).toEqual(route!.slice(0, 256))
      expect(planned.routeDestination).toEqual(destination)
      expect(planned.nextStepAt).toBe(1200)
    },
  )
  it('preserves actual frontier return roads and their authored duration', () => {
    const state = {
      ...newWorldState(),
      position: { sectorId: 'survey-01', x: 6, y: 8 },
      discoveries: { 'survey-01': [110] },
    }
    const route = findWorldRoute(
      state.position,
      { sectorId: 'umbral-march', x: 6, y: 4 },
      visibleSectors(state),
      (position) => isKnownCell(state, position),
    )!
    expect(route).toHaveLength(5)
    expect(route[0]!.durationMs).toBe(1100)
    expect(route[0]!.position).toEqual({ sectorId: 'umbral-march', x: 6, y: 0 })
    expect(route.slice(1).every((step) => step.durationMs === 200)).toBe(true)
  })
  it('plans long charted journeys with the actual server-visible compatibility graph', () => {
    const state = newWorldState()
    const visible = visibleSectors(state)
    for (const id of ['frostmere', 'umbral-march']) {
      const route = findWorldRoute(state.position, { sectorId: id, x: 6, y: 4 }, visible, (p) =>
        isKnownCell(state, p),
      )
      expect(route?.length, `${id} server-visible journey`).toBeGreaterThan(80)
    }
    const planned = resolveWorldIntent(
      state,
      { kind: 'autopath', objectiveId: 'last-survey' },
      1000,
    )
    expect(planned.route.length).toBeGreaterThan(80)
    expect(planned.route.length).toBeLessThanOrEqual(256)
    expect(planned.routeDestination).toEqual({ sectorId: 'umbral-march', x: 6, y: 0 })
    let travelling = planned,
      replenished = 0
    while (travelling.route.length) {
      const now = travelling.nextStepAt! + 39 * 200
      travelling = resolveWorldIntent(travelling, { kind: 'tick' }, now)
      if (travelling.routeDestination && travelling.route.length <= 128) {
        const deadline = travelling.nextStepAt
        travelling = resolveWorldIntent(
          travelling,
          { kind: 'autopath', objectiveId: 'last-survey' },
          now,
        )
        expect(travelling.nextStepAt).toBe(deadline)
        expect(travelling.route.length).toBeLessThanOrEqual(256)
        replenished++
      }
    }
    expect(replenished).toBeGreaterThan(0)
    expect(travelling.position).toEqual({ sectorId: 'umbral-march', x: 6, y: 0 })
    expect(projectWorld(travelling, [], 1000).routeDestination).toBeNull()
    expect(resolveWorldIntent(planned, { kind: 'stop' }, 1000).routeDestination).toBeNull()
  })
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
    const edges = new Set(
      sectors.flatMap((s) => s.roads.map((r) => `${positionKey(r.from)}>${positionKey(r.to)}`)),
    )
    const invalid: unknown[] = []
    for (const sector of sectors)
      for (const road of sector.roads) {
        const to = byId.get(road.to.sectorId)
        if (!to) {
          invalid.push({ road, missing: road.to.sectorId })
          continue
        }
        const a = atlasAddress(sector)!,
          b = atlasAddress(to)!
        if (
          !isWalkable(sector, road.from) ||
          !isWalkable(to, road.to) ||
          wrappedColumnDistance(a.column, b.column) + Math.abs(a.row - b.row) !== 1 ||
          !edges.has(`${positionKey(road.to)}>${positionKey(road.from)}`)
        )
          invalid.push(road)
      }
    // Check every edge in linear time and report actual invalid edges together.
    // Avoid hundreds of thousands of assertion allocations on a small CI runner.
    expect(invalid).toEqual([])
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

describe('conservative pavement shoreline trimming', () => {
  function roadSector() {
    return {
      id: 'shore',
      atlasColumn: 20,
      atlasRow: 20,
      rows: Array.from({ length: 9 }, (_, y) => (y === 4 ? '=============' : '.............')),
      landmarks: [],
    } as unknown as WorldSector
  }
  it.each(['~', 'l'])(
    'stops an internal %s dead end without changing any walkable cell',
    (liquid) => {
      const sector = roadSector()
      sector.rows = sector.rows.map((row, y) =>
        y === 4 ? row.slice(0, 7) + liquid + row.slice(8) : row,
      )
      const before = sector.rows.join('').split('').map(terrainWalkable)
      trimRoadShorelines([sector])
      expect(sector.rows[4]!.slice(4, 11)).toBe(`=..${liquid}..=`)
      expect(sector.rows.join('').split('').map(terrainWalkable)).toEqual(before)
    },
  )
  it('retains standalone settlement protection where ordinary ground would allow PvP', () => {
    const sector = roadSector()
    sector.rows = sector.rows.map((row, y) => (y === 4 ? row.slice(0, 12) + 's' : row))
    expect(isSafe(sector, { x: 12, y: 4 })).toBe(true)
    trimRoadShorelines([sector])
    expect(isSafe(sector, { x: 12, y: 4 })).toBe(true)
    expect(sector.rows[4]![12]).toBe('s')
  })

  it('preserves a real river bridge and its two dry banks', () => {
    const sector = roadSector()
    sector.rows = sector.rows.map((row, y) =>
      y === 4 ? row : row.slice(0, 6) + '~' + row.slice(7),
    )
    sector.landmarks = [{ id: 'bridge', name: 'Bridge', kind: 'bridge', x: 6, y: 4 }]
    trimRoadShorelines([sector])
    expect(sector.rows[4]!.slice(5, 8)).toBe('===')
    expect(sector.rows[3]![6]).toBe('~')
    expect(sector.rows[5]![6]).toBe('~')
    expect(sector.landmarks).toEqual([{ id: 'bridge', name: 'Bridge', kind: 'bridge', x: 6, y: 4 }])
  })

  it('does not mistake a paved neck without a walkable far bank for a bridge', () => {
    const sector = roadSector()
    sector.landmarks = [{ id: 'unusable-bridge', name: 'Bridge', kind: 'bridge', x: 6, y: 4 }]
    sector.rows = sector.rows.map((row, y) =>
      y === 4 ? '=======#=====' : row.slice(0, 6) + '~' + row.slice(7),
    )
    trimRoadShorelines([sector])
    expect(sector.rows[4]![6]).toBe('.')
    expect(sector.rows[4]![7]).toBe('#')
    expect(sector.landmarks).toHaveLength(1)
  })

  it('retains authored approach tiles at nearby POIs', () => {
    const sector = roadSector()
    sector.landmarks = [{ id: 'waystone', name: 'Waystone', kind: 'waystone', x: 1, y: 4 }]
    trimRoadShorelines([sector])
    expect(sector.rows[4]![0]).toBe('.')
    expect(sector.rows[4]![1]).toBe('=')
    expect(isWalkable(sector, sector.landmarks[0]!)).toBe(true)
  })
})
