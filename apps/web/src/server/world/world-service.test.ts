import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { newWorldState, revealNearby } from '@/world/travel'
import { FRONTIER_APPROACH, STEP_MS } from '@/world/catalog'
import { assertEncounterRange, projectWorld, resolveWorldIntent } from './world-service'
import { EASTERN_WATCH, EASTERN_WATCH_INTERACTION_ID, VERDANT_SETTLEMENT } from './world-objectives'
import { FIRST_FIELD_OBSERVATION_ID } from './world-archive'

describe('world authority and spoiler projection', () => {
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
  it('stops a saved four-second road route or broken later step before moving', () => {
    const position = { sectorId: 'crown-road', x: 5, y: 4 }
    for (const route of [
      [{ position: { ...position, x: 6 }, durationMs: 4000 }],
      [
        { position: { ...position, x: 6 }, durationMs: STEP_MS },
        { position: { ...position, x: 8 }, durationMs: STEP_MS },
      ],
    ]) {
      const state = { ...newWorldState(), position, route, nextStepAt: 1000 }
      const next = resolveWorldIntent(state, { kind: 'tick' }, 2000)
      expect(next.position).toEqual(position)
      expect(next.route).toEqual([])
      expect(next.nextStepAt).toBeNull()
    }
  })
  it('does not send unknown frontier names, cells or exits', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    expect(new Set(view.sectors.map((s) => s.regionId)).size).toBe(8)
    expect(JSON.stringify(view)).not.toContain('survey-01')
    expect(JSON.stringify(view)).not.toContain('Weathered Observatory')
  })
  it('exposes Crown Road as its own open territory and keeps nearby encounters local', () => {
    const state = { ...newWorldState(), position: { sectorId: 'crown-road', x: 5, y: 4 } }
    const view = projectWorld(state, [], 1000)
    const road = view.sectors.find((s) => s.id === 'crown-road')!
    expect(road).toBeDefined()
    expect(road.cells.filter((c) => c.y === 4).every((c) => c.walkable && !c.safe)).toBe(true)
    expect(road.exits.map((e) => e.to.sectorId).sort()).toEqual(['aureth-crown', 'verdant-expanse'])
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
    expect(road.coordinate).toBe('S18-10')
    expect(
      road.cells.filter((cell) => cell.y === 3).every((cell) => cell.walkable && !cell.safe),
    ).toBe(true)
    expect(road.cells.filter((cell) => cell.y >= 5).every((cell) => !cell.walkable)).toBe(true)
    expect(road.exits.map((exit) => exit.to.sectorId).sort()).toEqual([
      'hollow-coast',
      'verdant-expanse',
    ])
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
      coordinate: 'S22-08',
      panoramaVersion: 'v01',
      exits: ['emberreach', 'umbral-march'],
    },
    {
      id: 'old-coast-road',
      coordinate: 'S20-11',
      panoramaVersion: 'v01',
      exits: ['hollow-coast', 'umbral-march'],
    },
    {
      id: 'highland-road',
      coordinate: 'S14-06',
      panoramaVersion: 'v01',
      exits: ['aureth-crown', 'starfall-highlands'],
    },
    {
      id: 'northern-pass',
      coordinate: 'S15-04',
      panoramaVersion: 'v01',
      exits: ['frostmere', 'starfall-highlands'],
    },
    {
      id: 'ember-road',
      coordinate: 'S20-07',
      panoramaVersion: 'v02',
      exits: ['emberreach', 'verdant-expanse'],
    },
    {
      id: 'southern-caravan-road',
      coordinate: 'S14-10',
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
    expect(road.exits.map((exit) => exit.to.sectorId).sort()).toEqual(exits)
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
  it('reveals a frontier Field Observation in the Archive only after it is recorded', () => {
    const state = newWorldState()
    const hidden = projectWorld(state, [], 1000)
    expect(hidden.archive).toEqual([])
    expect(JSON.stringify(hidden)).not.toContain('Weathered Observatory')

    const recorded = {
      ...state,
      completedObjectives: [...state.completedObjectives, FIRST_FIELD_OBSERVATION_ID],
    }
    expect(projectWorld(recorded, [], 1000).archive).toEqual([
      expect.objectContaining({
        id: 'field-observation-first-observation',
        kind: 'field-observation',
        title: 'Weathered Observatory',
        provenance: 'Direct field observation',
      }),
    ])
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
