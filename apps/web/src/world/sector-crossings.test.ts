import { describe, expect, it } from 'vitest'
import type { WorldSector } from './types'
import { findWorldRoute } from './travel'
import {
  buildAuthoredSectorCrossing,
  parseSectorCoordinate,
  sectorNeighborDirection,
} from './sector-crossings'

function sector(
  id: string,
  coordinate: string,
  rows: readonly string[] = [
    '.............',
    '.............',
    '.............',
    '.............',
    '=============',
    '.............',
    '.............',
    '.............',
    '.............',
  ],
): Pick<WorldSector, 'id' | 'coordinate' | 'rows'> {
  return { id, coordinate, rows }
}

describe('authored adjacent-sector crossings', () => {
  it('parses only valid 32 by 16 atlas coordinates', () => {
    expect(parseSectorCoordinate('S01-01')).toEqual({ east: 1, north: 1 })
    expect(parseSectorCoordinate('S32-16')).toEqual({ east: 32, north: 16 })
    for (const invalid of ['S00-01', 'S33-01', 'S01-00', 'S01-17', 'Survey I', ''])
      expect(parseSectorCoordinate(invalid)).toBeNull()
  })

  it('resolves orthogonal neighbors including the globe longitude seam', () => {
    expect(sectorNeighborDirection('S16-08', 'S17-08')).toBe('east')
    expect(sectorNeighborDirection('S17-08', 'S16-08')).toBe('west')
    expect(sectorNeighborDirection('S17-08', 'S17-07')).toBe('north')
    expect(sectorNeighborDirection('S17-08', 'S17-09')).toBe('south')
    expect(sectorNeighborDirection('S32-08', 'S01-08')).toBe('east')
    expect(sectorNeighborDirection('S01-08', 'S32-08')).toBe('west')
    expect(sectorNeighborDirection('S16-08', 'S17-09')).toBeNull()
    expect(sectorNeighborDirection('S16-08', 'S18-08')).toBeNull()
  })

  it('builds a reciprocal east-west crossing only through explicit authored edge gates', () => {
    const [eastbound, westbound] = buildAuthoredSectorCrossing({
      from: sector('crown-hinterland-west', 'S16-08'),
      to: sector('crown-hinterland-east', 'S17-08'),
      fromOffset: 4,
      toOffset: 3,
      name: 'Hinterland crossing',
      durationMs: 1800,
    })

    expect(eastbound).toEqual({
      from: { sectorId: 'crown-hinterland-west', x: 12, y: 4 },
      to: { sectorId: 'crown-hinterland-east', x: 0, y: 3 },
      name: 'Hinterland crossing',
      durationMs: 1800,
    })
    expect(westbound).toEqual({
      from: eastbound.to,
      to: eastbound.from,
      name: eastbound.name,
      durationMs: eastbound.durationMs,
    })
  })

  it('feeds authored adjacent-sector gates directly into the existing routefinder', () => {
    const westBase = sector('west', 'S16-08')
    const eastBase = sector('east', 'S17-08')
    const crossing = buildAuthoredSectorCrossing({
      from: westBase,
      to: eastBase,
      fromOffset: 4,
      toOffset: 3,
      name: 'Wilderness boundary',
      durationMs: 1800,
    })
    const sectors: WorldSector[] = [
      {
        ...westBase,
        name: 'West',
        regionId: 'aureth-crown',
        art: null,
        east: 0,
        north: 8,
        charted: true,
        landmarks: [],
        roads: crossing.filter((road) => road.from.sectorId === 'west'),
      },
      {
        ...eastBase,
        name: 'East',
        regionId: 'aureth-crown',
        art: null,
        east: 13,
        north: 8,
        charted: true,
        landmarks: [],
        roads: crossing.filter((road) => road.from.sectorId === 'east'),
      },
    ]

    const route = findWorldRoute(
      { sectorId: 'west', x: 11, y: 4 },
      { sectorId: 'east', x: 1, y: 3 },
      sectors,
    )!

    expect(route.map((step) => step.position)).toEqual([
      { sectorId: 'west', x: 12, y: 4 },
      { sectorId: 'east', x: 0, y: 3 },
      { sectorId: 'east', x: 1, y: 3 },
    ])
    expect(route[1]).toMatchObject({ durationMs: 1800, road: 'Wilderness boundary' })
  })

  it('builds north-south crossings on the correct local-map edges', () => {
    const [northbound] = buildAuthoredSectorCrossing({
      from: sector('lower', 'S17-08'),
      to: sector('upper', 'S17-07'),
      fromOffset: 6,
      toOffset: 5,
      name: 'Highland boundary',
      durationMs: 2200,
    })

    expect(northbound.from).toEqual({ sectorId: 'lower', x: 6, y: 0 })
    expect(northbound.to).toEqual({ sectorId: 'upper', x: 5, y: 8 })
  })

  it('refuses implicit or unsafe crossings', () => {
    expect(() =>
      buildAuthoredSectorCrossing({
        from: sector('a', 'S16-08'),
        to: sector('b', 'S18-08'),
        fromOffset: 4,
        toOffset: 4,
        name: 'Too far',
        durationMs: 1800,
      }),
    ).toThrow(/orthogonally adjacent/)

    expect(() =>
      buildAuthoredSectorCrossing({
        from: sector('a', 'S16-08', [
          '.............',
          '.............',
          '.............',
          '.............',
          '............#',
          '.............',
          '.............',
          '.............',
          '.............',
        ]),
        to: sector('b', 'S17-08'),
        fromOffset: 4,
        toOffset: 4,
        name: 'Blocked',
        durationMs: 1800,
      }),
    ).toThrow(/blocked terrain in a/)

    expect(() =>
      buildAuthoredSectorCrossing({
        from: sector('a', 'S16-08'),
        to: sector('b', 'S17-08'),
        fromOffset: 9,
        toOffset: 4,
        name: 'Bad edge',
        durationMs: 1800,
      }),
    ).toThrow(/outside a's vertical edge/)

    expect(() =>
      buildAuthoredSectorCrossing({
        from: sector('a', 'S16-08'),
        to: sector('b', 'S17-08'),
        fromOffset: 4,
        toOffset: 4,
        name: '',
        durationMs: 1800,
      }),
    ).toThrow(/player-facing route name/)

    expect(() =>
      buildAuthoredSectorCrossing({
        from: sector('a', 'S16-08'),
        to: sector('b', 'S17-08'),
        fromOffset: 4,
        toOffset: 4,
        name: 'Zero time',
        durationMs: 0,
      }),
    ).toThrow(/duration must be positive/)
  })
})
