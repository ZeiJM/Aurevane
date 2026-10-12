import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState, revealNearby } from '@/world/travel'
import { FRONTIER_APPROACH, STEP_MS } from '@/world/catalog'
import { wrapAtlasColumn } from '@/world/topology'
import { assertEncounterRange, projectWorld, resolveWorldIntent } from './world-service'
import {
  AURETH_SETTLEMENT,
  CROWN_HINTERLAND_PATROL,
  CROWN_HINTERLAND_PATROL_INTERACTION_ID,
  CROWN_HINTERLAND_PATROL_OBJECTIVE_ID,
  EASTERN_WATCH,
  EASTERN_WATCH_INTERACTION_ID,
  VERDANT_SETTLEMENT,
} from './world-objectives'

describe('world authority and spoiler projection', () => {
  it('fills the public map viewport at minimum zoom without wasting scene slots on distant corners', () => {
    const state = newWorldState(),
      view = projectWorld(state, [], 1000),
      current = view.sectors.find((s) => s.id === state.position.sectorId)!,
      ids = new Set(view.sectors.map((s) => s.id)),
      atlas = new Map(view.atlas!.map((s) => [`${s.column}:${s.row}`, s]))
    const width = 1296,
      height = 944,
      tile = 64 * 0.6,
      cx = current.atlasColumn! * 13 + state.position.x + 0.5,
      cy = current.atlasRow! * 9 + state.position.y + 0.5
    for (const px of [0, width / 4, width / 2, (width * 3) / 4, width])
      for (const py of [0, height / 4, height / 2, (height * 3) / 4, height]) {
        const a = (px - width / 2) / (tile * 0.85),
          b = (py - height / 2) / (tile * 0.44),
          column = wrapAtlasColumn(Math.floor((cx + (a + b) / 2) / 13)),
          row = Math.floor((cy + (b - a) / 2) / 9),
          sector = atlas.get(`${column}:${row}`)
        if (sector?.charted) expect(ids.has(sector.id), `${px},${py} needs ${sector.id}`).toBe(true)
      }
    expect(view.sectors.length).toBeLessThanOrEqual(25)
  })
  it('projects actual public water and town footprints without exposing private terrain', () => {
    const view = projectWorld(newWorldState(), [], 1000),
      local = view.sectors.find((sector) => sector.id === view.position.sectorId)!,
      overview = view.atlas!.find((cell) => cell.id === local.id)!
    expect(overview.townId).toBe(local.townId)
    expect(overview.waterTiles).toHaveLength(117)
    for (const cell of local.cells)
      expect(overview.waterTiles![cell.y * 13 + cell.x]).toBe(
        cell.terrain === '~' || cell.terrain === 'l' ? cell.terrain : '.',
      )
    const dry = view.atlas!.find((cell) => cell.id === 'atlas:58:28')!
    expect(dry.waterTiles).toBeUndefined()
    const privateView = projectWorld(
      revealNearby({ ...newWorldState(), position: { sectorId: 'survey-01', x: 6, y: 8 } }),
      [],
      1000,
    )
    for (const cell of privateView.atlas!.filter((cell) => !cell.charted)) {
      expect(cell.waterTiles).toBeUndefined()
      expect(cell.townId).toBeUndefined()
    }
    expect(JSON.stringify(view).length).toBeLessThan(700000)
  })
  it.each([
    {
      from: { sectorId: 'aureth-crown', x: 12, y: 4 },
      to: { sectorId: 'verdant-expanse', x: 0, y: 4 },
      durationMs: 45000,
    },
    {
      from: { sectorId: 'verdant-expanse', x: 0, y: 4 },
      to: { sectorId: 'aureth-crown', x: 12, y: 4 },
      durationMs: 45000,
    },
    {
      from: { sectorId: 'verdant-expanse', x: 12, y: 4 },
      to: { sectorId: 'hollow-coast', x: 0, y: 4 },
      durationMs: 60000,
    },
    {
      from: { sectorId: 'hollow-coast', x: 0, y: 4 },
      to: { sectorId: 'verdant-expanse', x: 12, y: 4 },
      durationMs: 60000,
    },
    ...[
      ['verdant-expanse', 'emberreach'],
      ['aureth-crown', 'glasswind-desert'],
    ].flatMap(([a, b]) => {
      const from = { sectorId: a!, x: 12, y: 4 },
        to = { sectorId: b!, x: 0, y: 4 }
      return [
        { from, to, durationMs: 70000 },
        { from: to, to: from, durationMs: 70000 },
      ]
    }),
    ...[
      { a: 'emberreach', b: 'umbral-march', durationMs: 85000 },
      { a: 'hollow-coast', b: 'umbral-march', durationMs: 80000 },
      { a: 'aureth-crown', b: 'starfall-highlands', durationMs: 65000 },
      { a: 'starfall-highlands', b: 'frostmere', durationMs: 75000 },
    ].flatMap(({ a, b, durationMs }) => {
      const from = { sectorId: a, x: 12, y: 4 },
        to = { sectorId: b, x: 0, y: 4 }
      return [
        { from, to, durationMs },
        { from: to, to: from, durationMs },
      ]
    }),
  ])(
    'stops a saved direct road from $from.sectorId after its edge is replaced',
    ({ from, to, durationMs }) => {
      const state = {
        ...newWorldState(),
        position: from,
        route: [{ position: to, durationMs }],
        nextStepAt: 1000,
      }
      const next = resolveWorldIntent(state, { kind: 'tick' }, 2000)
      expect(next.position).toEqual(from)
      expect(next.route).toEqual([])
      expect(next.nextStepAt).toBeNull()
    },
  )
  it('stops an old speed or broken later step before consuming a saved route', () => {
    const position = { sectorId: 'crown-road', x: 5, y: 4 }
    for (const route of [
      [{ position: { ...position, x: 6 }, durationMs: 4000 }],
      [{ position: { ...position, x: 6 }, durationMs: 1100 }],
      [
        { position: { ...position, x: 6 }, durationMs: STEP_MS },
        { position: { ...position, x: 8 }, durationMs: STEP_MS },
      ],
    ]) {
      const state = { ...newWorldState(), position, route, nextStepAt: 1000 }
      const next = resolveWorldIntent(state, { kind: 'tick' }, 2000)
      expect(next.position).toEqual(position)
      expect(next.route).toEqual([])
    }
  })
  it('does not send unknown frontier names, cells or exits', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    expect(new Set(view.atlas!.map((s) => s.regionId)).size).toBe(8)
    expect(JSON.stringify(view)).not.toContain('survey-01')
    expect(JSON.stringify(view)).not.toContain('Weathered Observatory')
  })
  it('projects Crown Hinterland as charted wilderness with only authored reciprocal exits', () => {
    const state = {
      ...newWorldState(),
      position: { sectorId: 'crown-hinterland', x: 6, y: 4 },
    }
    const view = projectWorld(state, [], 1000)
    const hinterland = view.sectors.find((sector) => sector.id === 'crown-hinterland')!

    expect(hinterland).toMatchObject({
      name: 'Crown Hinterland',
      coordinate: 'S57-29',
      regionId: 'aureth-crown',
      charted: true,
    })
    expect(
      hinterland.cells.filter((cell) => cell.y === 4).every((cell) => cell.walkable && !cell.safe),
    ).toBe(true)
    expect(hinterland.exits.length).toBeGreaterThan(3)
    expect(hinterland.exits.every((exit) => exit.durationMs === STEP_MS)).toBe(true)
    expect(view.sectors.some((sector) => sector.coordinate === 'S17-08')).toBe(false)
  })

  it('projects the rest of the Crown wilderness cluster as open authored land', () => {
    const expected = [
      {
        id: 'crown-northfields',
        coordinate: 'S53-25',
        exits: ['aureth-crown', 'crown-uplands'],
      },
      {
        id: 'crown-uplands',
        coordinate: 'S57-25',
        exits: ['crown-hinterland', 'crown-northfields'],
      },
    ]

    for (const item of expected) {
      const view = projectWorld(
        { ...newWorldState(), position: { sectorId: item.id, x: 6, y: 4 } },
        [],
        1000,
      )
      const sector = view.sectors.find((candidate) => candidate.id === item.id)!
      expect(sector).toMatchObject({
        id: item.id,
        coordinate: item.coordinate,
        regionId: 'aureth-crown',
        art: null,
        charted: true,
      })
      expect(sector.cells.some((cell) => cell.walkable)).toBe(true)
      expect(sector.cells.some((cell) => cell.safe)).toBe(false)
      expect(sector.exits.length).toBeGreaterThan(2)
      expect(sector.exits.every((exit) => exit.durationMs === STEP_MS)).toBe(true)
    }
  })

  it('exposes Crown Road as its own open territory and keeps nearby encounters local', () => {
    const state = { ...newWorldState(), position: { sectorId: 'crown-road', x: 5, y: 4 } }
    const view = projectWorld(state, [], 1000)
    const road = view.sectors.find((s) => s.id === 'crown-road')!
    expect(road).toBeDefined()
    expect(road.cells.filter((c) => c.y === 4).every((c) => c.walkable && !c.safe)).toBe(true)
    expect(road.exits.length).toBeGreaterThan(2)
    expect(road.exits.every((exit) => exit.durationMs === STEP_MS)).toBe(true)
    expect(() =>
      assertEncounterRange(state, { ...state, position: { ...state.position, x: 6 } }),
    ).not.toThrow()
    expect(() =>
      assertEncounterRange(state, { ...state, position: { ...state.position, x: 7 } }),
    ).toThrow()
    expect(() =>
      assertEncounterRange(state, { ...state, position: { sectorId: 'aureth-crown', x: 5, y: 4 } }),
    ).toThrow()
  })
  it('projects Coastal Road terrain, exits and nearby encounter eligibility', () => {
    const state = { ...newWorldState(), position: { sectorId: 'coastal-road', x: 5, y: 3 } }
    const road = projectWorld(state, [], 1000).sectors.find((s) => s.id === 'coastal-road')!
    expect(road).toBeDefined()
    expect(road.coordinate).toBe('S69-37')
    expect(
      road.cells.filter((cell) => cell.y === 3).every((cell) => cell.walkable && !cell.safe),
    ).toBe(true)
    expect(road.cells.filter((cell) => cell.y >= 5).every((cell) => !cell.walkable)).toBe(true)
    expect(road.exits.length).toBeGreaterThan(2)
    expect(road.exits.every((exit) => exit.durationMs === STEP_MS)).toBe(true)
    expect(road.panorama).toBe('/media/art/world/coastal-road-panorama-v01.webp')
    expect(() =>
      assertEncounterRange(state, { ...state, position: { ...state.position, x: 6 } }),
    ).not.toThrow()
    expect(() =>
      assertEncounterRange(state, { ...state, position: { sectorId: 'hollow-coast', x: 5, y: 3 } }),
    ).toThrow()
  })
  it.each([
    {
      id: 'eastern-march-road',
      coordinate: 'S85-29',
      panoramaVersion: 'v01',
      exits: ['emberreach', 'umbral-march'],
    },
    {
      id: 'old-coast-road',
      coordinate: 'S77-41',
      panoramaVersion: 'v01',
      exits: ['hollow-coast', 'umbral-march'],
    },
    {
      id: 'highland-road',
      coordinate: 'S53-21',
      panoramaVersion: 'v01',
      exits: ['aureth-crown', 'starfall-highlands'],
    },
    {
      id: 'northern-pass',
      coordinate: 'S57-13',
      panoramaVersion: 'v01',
      exits: ['frostmere', 'starfall-highlands'],
    },
    {
      id: 'ember-road',
      coordinate: 'S77-25',
      panoramaVersion: 'v02',
      exits: ['emberreach', 'verdant-expanse'],
    },
    {
      id: 'southern-caravan-road',
      coordinate: 'S53-37',
      panoramaVersion: 'v02',
      exits: ['aureth-crown', 'glasswind-desert'],
    },
  ])('projects $id as distinct open territory', ({ id, coordinate, exits, panoramaVersion }) => {
    const state = { ...newWorldState(), position: { sectorId: id, x: 6, y: 4 } }
    const road = projectWorld(state, [], 1000).sectors.find((sector) => sector.id === id)!
    expect(road).toBeDefined()
    expect(road.coordinate).toBe(coordinate)
    expect(road.art).toBe(`/media/art/world/${id}-v01.webp`)
    expect(road.panorama).toBe(`/media/art/world/${id}-panorama-${panoramaVersion}.webp`)
    expect(
      road.cells.filter((cell) => cell.y === 4).every((cell) => cell.walkable && !cell.safe),
    ).toBe(true)
    expect(road.cells.some((cell) => cell.safe)).toBe(false)
    // Expanded terrain crosses directly into adjacent geographic sectors.
    expect(road.exits.length).toBeGreaterThan(2)
    expect(
      road.exits.every(
        (exit) => exit.durationMs === STEP_MS && !exit.to.sectorId.startsWith('trail:'),
      ),
    ).toBe(true)
    expect(() =>
      assertEncounterRange(state, { ...state, position: { ...state.position, x: 7 } }),
    ).not.toThrow()
    expect(() =>
      assertEncounterRange(state, { ...state, position: { ...state.position, x: 8 } }),
    ).toThrow()
    expect(() =>
      assertEncounterRange(state, { ...state, position: { sectorId: exits[0]!, x: 6, y: 4 } }),
    ).toThrow()
  })
  it('requires a deliberate crossing from the frontier approach', () => {
    expect(() => resolveWorldIntent(newWorldState(), { kind: 'cross' }, 1000)).toThrow()
    const state = resolveWorldIntent(
      { ...newWorldState(), position: FRONTIER_APPROACH },
      { kind: 'cross' },
      1000,
    )
    expect(state.position.sectorId).toBe('survey-01')
    const view = projectWorld(state, [], 1000)
    const survey = view.sectors.find((s) => s.id === 'survey-01')!
    expect(survey.cells.length).toBeLessThan(117)
    expect(survey.landmarks).not.toContainEqual(
      expect.objectContaining({ name: 'Weathered Observatory' }),
    )
  })
  it('refuses auto-path across unsurveyed territory', () => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'survey-01', x: 6, y: 8 },
    })
    expect(() =>
      resolveWorldIntent(
        state,
        { kind: 'walk', destination: { sectorId: 'survey-01', x: 11, y: 1 } },
        1000,
      ),
    ).toThrow()
  })
  it('filters players in remote sectors and unrevealed cells', () => {
    const state = revealNearby({
      ...newWorldState(),
      position: { sectorId: 'survey-01', x: 6, y: 8 },
    })
    const players = [
      {
        characterId: 'a',
        name: 'Hidden',
        level: 1,
        portraitRef: '',
        imageUrl: null,
        position: { sectorId: 'survey-01', x: 11, y: 1 },
        attackable: true,
      },
      {
        characterId: 'b',
        name: 'Remote',
        level: 1,
        portraitRef: '',
        imageUrl: null,
        position: { sectorId: 'aureth-crown', x: 6, y: 4 },
        attackable: true,
      },
    ]
    expect(projectWorld(state, players, 1000).players).toEqual([])
  })
  it('persists discovery and completes an arrival objective once', () => {
    const state = { ...newWorldState(), position: FRONTIER_APPROACH }
    const next = resolveWorldIntent(state, { kind: 'tick' }, 1000)
    expect(next.completedObjectives).toEqual(['last-survey'])
    expect(resolveWorldIntent(next, { kind: 'tick' }, 2000).completedObjectives).toEqual([
      'last-survey',
    ])
  })

  it('requires accept, inspect and return before completing the Eastern Watch objective', () => {
    const remote = newWorldState()
    expect(() =>
      resolveWorldIntent(
        remote,
        { kind: 'interact', interactionId: EASTERN_WATCH_INTERACTION_ID },
        1000,
      ),
    ).toThrow()

    let state = { ...newWorldState(), position: VERDANT_SETTLEMENT }
    let view = projectWorld(state, [], 1000)
    expect(view.objectives.find((objective) => objective.id === 'eastern-watch')).toMatchObject({
      progress: 'available',
      destination: null,
      completed: false,
    })
    expect(view.interactions).toEqual([
      expect.objectContaining({
        id: EASTERN_WATCH_INTERACTION_ID,
        speaker: 'Watch officer',
        actionLabel: 'Accept objective',
      }),
    ])

    state = resolveWorldIntent(
      state,
      { kind: 'interact', interactionId: EASTERN_WATCH_INTERACTION_ID },
      1100,
    )
    view = projectWorld(state, [], 1100)
    expect(view.objectives.find((objective) => objective.id === 'eastern-watch')).toMatchObject({
      progress: 'active',
      destination: EASTERN_WATCH,
      completed: false,
    })

    state = resolveWorldIntent({ ...state, position: EASTERN_WATCH }, { kind: 'tick' }, 1200)
    view = projectWorld(state, [], 1200)
    expect(view.objectives.find((objective) => objective.id === 'eastern-watch')).toMatchObject({
      progress: 'ready',
      destination: VERDANT_SETTLEMENT,
      completed: false,
    })
    expect(view.interactions).toEqual([])

    state = resolveWorldIntent(
      { ...state, position: VERDANT_SETTLEMENT },
      { kind: 'interact', interactionId: EASTERN_WATCH_INTERACTION_ID },
      1300,
    )
    view = projectWorld(state, [], 1300)
    expect(state.completedObjectives).toEqual(['eastern-watch'])
    expect(view.objectives.find((objective) => objective.id === 'eastern-watch')).toMatchObject({
      progress: 'completed',
      destination: null,
      completed: true,
    })
    expect(view.interactions[0]).toMatchObject({
      actionLabel: null,
      progress: 'completed',
    })
    expect(() =>
      resolveWorldIntent(
        state,
        { kind: 'interact', interactionId: EASTERN_WATCH_INTERACTION_ID },
        1400,
      ),
    ).toThrow()
  })

  it('requires accept, patrol and return before completing the Crown Hinterland objective', () => {
    const remote = newWorldState()
    expect(() =>
      resolveWorldIntent(
        remote,
        { kind: 'interact', interactionId: CROWN_HINTERLAND_PATROL_INTERACTION_ID },
        1000,
      ),
    ).toThrow()

    let state = { ...newWorldState(), position: AURETH_SETTLEMENT }
    let view = projectWorld(state, [], 1000)
    expect(
      view.objectives.find((objective) => objective.id === CROWN_HINTERLAND_PATROL_OBJECTIVE_ID),
    ).toMatchObject({
      progress: 'available',
      destination: null,
      completed: false,
    })
    expect(view.interactions).toEqual([
      expect.objectContaining({
        id: CROWN_HINTERLAND_PATROL_INTERACTION_ID,
        speaker: 'Watch officer',
        actionLabel: 'Accept objective',
      }),
    ])

    state = resolveWorldIntent(
      state,
      { kind: 'interact', interactionId: CROWN_HINTERLAND_PATROL_INTERACTION_ID },
      1100,
    )
    view = projectWorld(state, [], 1100)
    expect(
      view.objectives.find((objective) => objective.id === CROWN_HINTERLAND_PATROL_OBJECTIVE_ID),
    ).toMatchObject({
      progress: 'active',
      destination: CROWN_HINTERLAND_PATROL,
      completed: false,
    })

    state = resolveWorldIntent(
      { ...state, position: CROWN_HINTERLAND_PATROL },
      { kind: 'tick' },
      1200,
    )
    view = projectWorld(state, [], 1200)
    expect(state.completedObjectives).toEqual([])
    expect(
      view.objectives.find((objective) => objective.id === CROWN_HINTERLAND_PATROL_OBJECTIVE_ID),
    ).toMatchObject({
      progress: 'ready',
      destination: AURETH_SETTLEMENT,
      completed: false,
    })
    expect(view.interactions).toEqual([])

    state = resolveWorldIntent(
      { ...state, position: AURETH_SETTLEMENT },
      { kind: 'interact', interactionId: CROWN_HINTERLAND_PATROL_INTERACTION_ID },
      1300,
    )
    view = projectWorld(state, [], 1300)
    expect(state.completedObjectives).toEqual([CROWN_HINTERLAND_PATROL_OBJECTIVE_ID])
    expect(
      view.objectives.find((objective) => objective.id === CROWN_HINTERLAND_PATROL_OBJECTIVE_ID),
    ).toMatchObject({
      progress: 'completed',
      destination: null,
      completed: true,
    })
    expect(view.interactions[0]).toMatchObject({
      id: CROWN_HINTERLAND_PATROL_INTERACTION_ID,
      actionLabel: null,
      progress: 'completed',
    })
    expect(() =>
      resolveWorldIntent(
        state,
        { kind: 'interact', interactionId: CROWN_HINTERLAND_PATROL_INTERACTION_ID },
        1400,
      ),
    ).toThrow()
  })
})

it('stops an event route when its live objective is withdrawn, leaving quest policy intact', () => {
  const state = {
    ...newWorldState(),
    routeObjectiveId: 'event-disabled',
    route: [{ position: { sectorId: 'verdant-expanse', x: 6, y: 4 }, durationMs: 1100 }],
    nextStepAt: 0,
  }
  const next = resolveWorldIntent(state, { kind: 'tick' }, 2000, [])
  expect(next.position).toEqual(state.position)
  expect(next.route).toEqual([])
})

describe('offline characters in the shared world', () => {
  it('keeps offline characters at their saved spot in the starting town and never attackable', () => {
    const state = newWorldState()
    const view = projectWorld(
      state,
      [
        {
          characterId: 'sleeper',
          name: 'Sleeper',
          level: 4,
          portraitRef: 'p',
          imageUrl: null,
          position: state.position,
          online: false,
          attackable: false,
        },
      ],
      1000,
    )
    expect(view.players).toHaveLength(1)
    expect(view.players[0]).toMatchObject({ name: 'Sleeper', online: false, attackable: false })
  })
})

describe('endless generated wilds', () => {
  const walkTo = (
    state: ReturnType<typeof newWorldState>,
    destination: { sectorId: string; x: number; y: number },
    t0: number,
  ) => {
    let now = t0
    let next = resolveWorldIntent(state, { kind: 'walk', destination }, now)
    for (let i = 0; i < 400 && next.route.length; i++) {
      now = next.nextStepAt!
      next = resolveWorldIntent(next, { kind: 'tick' }, now)
    }
    return { state: next, now }
  }
  it('lets a character leave a region through its open edge and keep exploring outward', () => {
    const start = { ...newWorldState(), position: { sectorId: 'verdant-expanse', x: 6, y: 1 } }
    const first = walkTo(start, { sectorId: 'wild:verdant-expanse:north:1:0', x: 6, y: 8 }, 1000)
    expect(first.state.position).toEqual({ sectorId: 'wild:verdant-expanse:north:1:0', x: 6, y: 8 })
    const view = projectWorld(first.state, [], first.now)
    const wild = view.sectors.find((s) => s.id === 'wild:verdant-expanse:north:1:0')!
    expect(wild.regionId).toBe('verdant-expanse')
    expect(wild.cells).toHaveLength(117)
    expect(wild.exits.some((e) => e.to.sectorId === 'verdant-expanse')).toBe(true)
    const farther = walkTo(
      first.state,
      { sectorId: 'wild:verdant-expanse:north:2:0', x: 6, y: 8 },
      first.now,
    )
    expect(farther.state.position.sectorId).toBe('wild:verdant-expanse:north:2:0')
    expect(farther.state.discoveries['wild:verdant-expanse:north:1:0']).toHaveLength(117)
    // Unvisited generated ground stays unknown.
    expect(() =>
      resolveWorldIntent(
        first.state,
        { kind: 'walk', destination: { sectorId: 'wild:verdant-expanse:north:4:0', x: 6, y: 4 } },
        first.now,
      ),
    ).toThrow()
  })
})

describe('starting a walk', () => {
  it('paces every authoritative step while the client can preview the start immediately', () => {
    const start = newWorldState()
    const next = resolveWorldIntent(
      start,
      {
        kind: 'walk',
        destination: {
          sectorId: start.position.sectorId,
          x: start.position.x + 3,
          y: start.position.y,
        },
      },
      10_000,
    )
    // The immediate visual preview does not move authoritative position early.
    expect(next.position).toEqual(start.position)
    expect(next.route).toHaveLength(3)
    expect(next.nextStepAt).toBe(10_000 + STEP_MS)
    // Shortly before +2*STEP_MS only the first full interval has completed.
    const tick = resolveWorldIntent(next, { kind: 'tick' }, 10_000 + STEP_MS * 2 - 1)
    expect(tick.position.x).toBe(start.position.x + 1)
    expect(tick.nextStepAt).toBe(10_000 + STEP_MS * 2)
  })
})

describe('replanning mid-walk', () => {
  const sec = 'aureth-crown'
  it('plans from the tile already reached and keeps the step under way', () => {
    const start = newWorldState()
    const first = resolveWorldIntent(
      start,
      {
        kind: 'walk',
        destination: { sectorId: sec, x: start.position.x + 3, y: start.position.y },
      },
      10_000,
    )
    expect(first.route.length).toBeGreaterThan(2)
    const due = first.nextStepAt!
    // Two steps are due on the authored clock but no tick has been processed yet.
    const now = due + STEP_MS + 10
    const second = resolveWorldIntent(
      first,
      { kind: 'walk', destination: { sectorId: sec, x: start.position.x, y: start.position.y } },
      now,
    )
    expect(second.position).toEqual(first.route[1]!.position)
    expect(second.nextStepAt).toBeLessThanOrEqual(now + STEP_MS)
    expect(second.nextStepAt).toBeGreaterThan(now)
  })
})

describe('review regressions for authoritative walking', () => {
  it('cannot gain speed by repeatedly plotting adjacent one-step destinations', () => {
    let state = newWorldState()
    for (let i = 0; i < 4; i++)
      state = resolveWorldIntent(
        state,
        { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 6 + i, y: 4 } },
        1000 + i * 10,
      )
    expect(resolveWorldIntent(state, { kind: 'tick' }, 1040).position).toEqual(
      newWorldState().position,
    )
    expect(resolveWorldIntent(state, { kind: 'tick' }, 1200).position.x).toBe(6)
  })
  it('cancels an obsolete saved route before a walk can advance into a new building', () => {
    const state = {
      ...newWorldState(),
      position: { sectorId: 'verdant-expanse', x: 12, y: 3 },
      route: [{ position: { sectorId: 'verdant-expanse', x: 12, y: 2 }, durationMs: 200 }],
      nextStepAt: 1000,
    }
    const replanned = resolveWorldIntent(
      state,
      { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 12, y: 4 } },
      1100,
    )
    expect(replanned.position).toEqual(state.position)
    expect(replanned.route.every((s) => !(s.position.x === 12 && s.position.y === 2))).toBe(true)
  })
})
