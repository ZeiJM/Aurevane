import { describe, expect, it } from 'vitest'
import { WORLD_REGIONS, CHARTED_SECTORS, START_POSITION } from './catalog'
import {
  advanceWorldRoute,
  canAutoPath,
  cellCenter,
  findWorldRoute,
  newWorldState,
  remainingTravelMs,
  worldSyncDelayMs,
} from './travel'

describe('world travel', () => {
  it('schedules active sync from the authoritative next-step deadline', () => {
    expect(
      worldSyncDelayMs({
        routeLength: 3,
        movementBlocked: false,
        nextStepAt: 5000,
        serverNow: 1000,
      }),
    ).toBe(4000)
    expect(
      worldSyncDelayMs({
        routeLength: 3,
        movementBlocked: false,
        nextStepAt: 2100,
        serverNow: 1000,
      }),
    ).toBe(1200)
    expect(
      worldSyncDelayMs({
        routeLength: 3,
        movementBlocked: false,
        nextStepAt: 1000,
        serverNow: 1200,
      }),
    ).toBe(1200)
    expect(
      worldSyncDelayMs({
        routeLength: 3,
        movementBlocked: false,
        nextStepAt: null,
        serverNow: 1200,
      }),
    ).toBe(1200)
    expect(
      worldSyncDelayMs({
        routeLength: 0,
        movementBlocked: false,
        nextStepAt: null,
        serverNow: 1200,
      }),
    ).toBe(10000)
    expect(
      worldSyncDelayMs({
        routeLength: 3,
        movementBlocked: true,
        nextStepAt: 5000,
        serverNow: 1000,
      }),
    ).toBe(10000)
  })
  it('keeps all eight canonical regions distinct', () => {
    expect(WORLD_REGIONS.map((r) => r.name)).toEqual([
      'Aureth Crown',
      'Verdant Expanse',
      'Emberreach',
      'Frostmere',
      'Glasswind Desert',
      'Hollow Coast',
      'Starfall Highlands',
      'Umbral March',
    ])
    expect(new Set(WORLD_REGIONS.map((r) => r.art)).size).toBe(8)
  })
  it('routes over the bridge instead of through water', () => {
    const route = findWorldRoute(
      { sectorId: 'verdant-expanse', x: 9, y: 3 },
      { sectorId: 'verdant-expanse', x: 11, y: 3 },
      CHARTED_SECTORS,
    )
    expect(route?.map((s) => s.position)).toContainEqual({
      sectorId: 'verdant-expanse',
      x: 10,
      y: 4,
    })
    expect(route?.some((s) => s.position.x === 10 && s.position.y !== 4)).toBe(false)
  })
  it('rejects blocked, out of range and unknown destinations', () => {
    for (const to of [
      { ...START_POSITION, x: 10, y: 2 },
      { ...START_POSITION, x: 13 },
      { ...START_POSITION, sectorId: 'unknown' },
    ])
      expect(findWorldRoute(START_POSITION, to, CHARTED_SECTORS)).toBeNull()
  })
  it('crosses a regional road with elapsed travel time', () => {
    const route = findWorldRoute(
      START_POSITION,
      { sectorId: 'aureth-crown', x: 6, y: 4 },
      CHARTED_SECTORS,
    )!
    expect(route.length).toBeGreaterThan(1)
    expect(route.reduce((ms, s) => ms + s.durationMs, 0)).toBeGreaterThan(45000)
    expect(route.at(-1)?.position).toEqual({ sectorId: 'aureth-crown', x: 6, y: 4 })
  })
  it('walks through Crown Road in both directions without skipping encounterable squares', () => {
    for (const [from, to] of [
      [
        { sectorId: 'aureth-crown', x: 12, y: 4 },
        { sectorId: 'verdant-expanse', x: 0, y: 4 },
      ],
      [
        { sectorId: 'verdant-expanse', x: 0, y: 4 },
        { sectorId: 'aureth-crown', x: 12, y: 4 },
      ],
    ]) {
      const route = findWorldRoute(from!, to!, CHARTED_SECTORS)!
      const road = route.filter((s) => s.position.sectorId === 'crown-road')
      expect(road).toHaveLength(13)
      expect(new Set(road.map((s) => s.position.x)).size).toBe(13)
      expect(road.every((s) => s.position.y === 4)).toBe(true)
      expect(road.slice(1).every((s) => s.durationMs === 4000)).toBe(true)
      expect(route.at(-1)?.position).toEqual(to)
    }
  })
  it('keeps the Crown Road river blocked except at its bridge', () => {
    expect(
      findWorldRoute(
        { sectorId: 'crown-road', x: 6, y: 3 },
        { sectorId: 'crown-road', x: 9, y: 3 },
        CHARTED_SECTORS,
      ),
    ).toBeNull()
    const across = findWorldRoute(
      { sectorId: 'crown-road', x: 6, y: 3 },
      { sectorId: 'crown-road', x: 10, y: 3 },
      CHARTED_SECTORS,
    )!
    expect(across.map((step) => step.position)).toEqual([
      { sectorId: 'crown-road', x: 6, y: 4 },
      { sectorId: 'crown-road', x: 7, y: 4 },
      { sectorId: 'crown-road', x: 8, y: 4 },
      { sectorId: 'crown-road', x: 9, y: 4 },
      { sectorId: 'crown-road', x: 10, y: 4 },
      { sectorId: 'crown-road', x: 10, y: 3 },
    ])
    expect(
      findWorldRoute(
        { sectorId: 'crown-road', x: 7, y: 4 },
        { sectorId: 'crown-road', x: 10, y: 4 },
        CHARTED_SECTORS,
      )?.map((s) => s.position.x),
    ).toEqual([8, 9, 10])
  })
  it('walks Coastal Road in both directions along the painted path', () => {
    for (const [from, to] of [
      [
        { sectorId: 'verdant-expanse', x: 12, y: 4 },
        { sectorId: 'hollow-coast', x: 0, y: 4 },
      ],
      [
        { sectorId: 'hollow-coast', x: 0, y: 4 },
        { sectorId: 'verdant-expanse', x: 12, y: 4 },
      ],
    ]) {
      const route = findWorldRoute(from!, to!, CHARTED_SECTORS)!
      const road = route.filter((s) => s.position.sectorId === 'coastal-road')
      expect(road).toHaveLength(13)
      expect(new Set(road.map((s) => s.position.x)).size).toBe(13)
      expect(road.every((s) => s.position.y === 3)).toBe(true)
      expect(road.slice(1).every((s) => s.durationMs === 4000)).toBe(true)
      expect(route.at(-1)?.position).toEqual(to)
    }
  })
  it('keeps the coastal sea blocked while allowing the shore verge', () => {
    const from = { sectorId: 'coastal-road', x: 5, y: 3 }
    expect(findWorldRoute(from, { ...from, y: 4 }, CHARTED_SECTORS)?.at(-1)?.position).toEqual({
      ...from,
      y: 4,
    })
    for (let y = 5; y < 9; y++)
      for (let x = 0; x < 13; x++)
        expect(findWorldRoute(from, { ...from, x, y }, CHARTED_SECTORS)).toBeNull()
  })
  it('joins Crown Road and Coastal Road into one continuous regional journey', () => {
    const route = findWorldRoute(
      { sectorId: 'aureth-crown', x: 12, y: 4 },
      { sectorId: 'hollow-coast', x: 0, y: 4 },
      CHARTED_SECTORS,
    )!
    for (const sectorId of ['crown-road', 'coastal-road'])
      expect(route.filter((step) => step.position.sectorId === sectorId)).toHaveLength(13)
    expect(route.every((step) => step.durationMs <= 4000)).toBe(true)
  })
  describe.each([
    { id: 'eastern-march-road', from: 'emberreach', to: 'umbral-march', walkableVerge: false },
    { id: 'old-coast-road', from: 'hollow-coast', to: 'umbral-march', walkableVerge: false },
    { id: 'highland-road', from: 'aureth-crown', to: 'starfall-highlands' },
    { id: 'northern-pass', from: 'starfall-highlands', to: 'frostmere' },
    { id: 'ember-road', from: 'verdant-expanse', to: 'emberreach' },
    { id: 'southern-caravan-road', from: 'aureth-crown', to: 'glasswind-desert' },
  ])('$id', ({ id, from, to, walkableVerge = true }) => {
    it.each([false, true])('traverses every encounterable square (reverse: %s)', (reverse) => {
      const endpoints = [
        { sectorId: from, x: 12, y: 4 },
        { sectorId: to, x: 0, y: 4 },
      ]
      if (reverse) endpoints.reverse()
      const route = findWorldRoute(endpoints[0]!, endpoints[1]!, CHARTED_SECTORS)!
      const road = route.filter((step) => step.position.sectorId === id)
      expect(road).toHaveLength(13)
      expect(road.map((step) => step.position.x)).toEqual(
        Array.from({ length: 13 }, (_, x) => (reverse ? 12 - x : x)),
      )
      expect(road.every((step) => step.position.y === 4)).toBe(true)
      expect(road.slice(1).every((step) => step.durationMs === 4000)).toBe(true)
      expect(route.every((step) => step.durationMs <= 4000)).toBe(true)
      expect(route.at(-1)?.position).toEqual(endpoints[1])
    })
    it('permits only terrain squares clear of painted obstacles', () => {
      const from = { sectorId: id, x: 6, y: 4 }
      if (walkableVerge)
        expect(findWorldRoute(from, { ...from, y: 3 }, CHARTED_SECTORS)?.at(-1)?.position).toEqual({
          ...from,
          y: 3,
        })
      // These two woodland roads have narrow decorative verges; adjacent cell centres
      // already fall inside the painted boulders and trees, including E6/N3.
      const blockedRows = walkableVerge ? [0, 1, 7, 8] : [0, 1, 2, 3, 5, 6, 7, 8]
      for (const y of blockedRows)
        for (let x = 0; x < 13; x++)
          expect(findWorldRoute(from, { ...from, x, y }, CHARTED_SECTORS)).toBeNull()
    })
  })
  it('connects the desert to volcanic country through encounterable roads', () => {
    const route = findWorldRoute(
      { sectorId: 'glasswind-desert', x: 0, y: 4 },
      { sectorId: 'emberreach', x: 0, y: 4 },
      CHARTED_SECTORS,
    )!
    for (const id of ['southern-caravan-road', 'crown-road', 'ember-road'])
      expect(route.filter((step) => step.position.sectorId === id)).toHaveLength(13)
    expect(route.every((step) => step.durationMs <= 4000)).toBe(true)
  })
  it('connects every canonical region through bounded square-by-square journeys', () => {
    for (const from of WORLD_REGIONS)
      for (const to of WORLD_REGIONS) {
        if (from.id === to.id) continue
        const destination = { sectorId: to.id, x: 5, y: 4 }
        const route = findWorldRoute(
          { sectorId: from.id, x: 5, y: 4 },
          destination,
          CHARTED_SECTORS,
        )
        expect(route, `${from.id} to ${to.id}`).not.toBeNull()
        expect(route!.at(-1)?.position).toEqual(destination)
        expect(route!.every((step) => step.durationMs <= 4000)).toBe(true)
      }
  })
  it('advances only one due step even after a long disconnect', () => {
    const state = {
      ...newWorldState(),
      route: findWorldRoute(START_POSITION, { ...START_POSITION, x: 9 }, CHARTED_SECTORS)!,
      nextStepAt: 1000,
    }
    expect(advanceWorldRoute(state, 999).position).toEqual(START_POSITION)
    const next = advanceWorldRoute(state, 999999)
    expect(next.position.x).toBe(START_POSITION.x + 1)
    expect(next.route.length).toBe(state.route.length - 1)
    expect(next.nextStepAt).toBeGreaterThan(999999)
  })
  it('counts the remaining partial step once and never forecasts catch-up movement', () => {
    const state = {
      route: [
        { position: { sectorId: 'crown-road', x: 1, y: 4 }, durationMs: 4000 },
        { position: { sectorId: 'crown-road', x: 2, y: 4 }, durationMs: 4000 },
        { position: { sectorId: 'verdant-expanse', x: 0, y: 4 }, durationMs: 1100 },
      ],
      nextStepAt: 5000,
    }
    expect(remainingTravelMs(state, 3000)).toBe(7100)
    expect(remainingTravelMs(state, 6000)).toBe(5100)
    expect(remainingTravelMs({ route: [], nextStepAt: null }, 6000)).toBe(0)
  })
  it('keeps event restrictions scoped to that objective', () => {
    expect(canAutoPath({ kind: 'event', autoPath: false, guidance: 'exact' })).toBe(false)
    expect(canAutoPath({ kind: 'quest', autoPath: true, guidance: 'exact' })).toBe(true)
    expect(canAutoPath({ kind: 'quest', autoPath: true, guidance: 'clue' })).toBe(false)
  })
  it('centres tokens in square cells independently of rendering scale', () => {
    expect(cellCenter({ x: 0, y: 0 })).toEqual({ x: 0.5 / 13, y: 0.5 / 9 })
    expect(cellCenter({ x: 12, y: 8 })).toEqual({ x: 12.5 / 13, y: 8.5 / 9 })
  })
})
