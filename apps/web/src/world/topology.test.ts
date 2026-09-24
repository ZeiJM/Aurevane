import { describe, expect, it } from 'vitest'
import { CHARTED_SECTORS } from './catalog'
import type { WorldSector } from './types'
import { assertWorldTopology, validateWorldTopology } from './topology'

const rows = [
  '.............',
  '.............',
  '.............',
  '.............',
  '=============',
  '.............',
  '.............',
  '.............',
  '.............',
] as const

function authoredSector(
  id: string,
  coordinate: string,
  overrides: Partial<WorldSector> = {},
): WorldSector {
  return {
    id,
    name: id,
    coordinate,
    regionId: 'aureth-crown',
    art: null,
    east: 0,
    north: 0,
    rows,
    charted: true,
    landmarks: [],
    roads: [],
    ...overrides,
  }
}

describe('authored world topology validation', () => {
  it('accepts the current charted world catalog', () => {
    expect(validateWorldTopology(CHARTED_SECTORS)).toEqual([])
    expect(() => assertWorldTopology(CHARTED_SECTORS)).not.toThrow()
  })

  it('rejects duplicate ids and globe coordinates', () => {
    const issues = validateWorldTopology([
      authoredSector('west', 'S16-08'),
      authoredSector('west', 'S17-08'),
      authoredSector('east', 'S16-08'),
    ])

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['DUPLICATE_SECTOR_ID', 'DUPLICATE_SECTOR_COORDINATE']),
    )
  })

  it('rejects invalid coordinates, malformed local maps and blocked landmarks', () => {
    const issues = validateWorldTopology([
      authoredSector('invalid', 'S99-99'),
      authoredSector('ragged', 'S17-08', {
        rows: ['...', '..'],
      }),
      authoredSector('blocked-landmark', 'S18-08', {
        rows: ['#............', ...rows.slice(1)],
        landmarks: [
          {
            id: 'blocked-landmark',
            name: 'Blocked landmark',
            kind: 'frontier',
            x: 0,
            y: 0,
          },
        ],
      }),
    ])

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'INVALID_SECTOR_COORDINATE',
        'INVALID_SECTOR_ROWS',
        'INVALID_LANDMARK',
      ]),
    )
  })

  it('rejects dangling, blocked, unnamed, nonpositive and one-way roads', () => {
    const west = authoredSector('west', 'S16-08')
    const east = authoredSector('east', 'S17-08', {
      rows: ['#............', ...rows.slice(1)],
    })

    west.roads = [
      {
        from: { sectorId: 'west', x: 12, y: 4 },
        to: { sectorId: 'east', x: 0, y: 0 },
        name: '',
        durationMs: 0,
      },
      {
        from: { sectorId: 'other', x: 12, y: 4 },
        to: { sectorId: 'missing', x: 0, y: 4 },
        name: 'Broken source',
        durationMs: 1000,
      },
      {
        from: { sectorId: 'west', x: 12, y: 3 },
        to: { sectorId: 'missing', x: 0, y: 3 },
        name: 'Missing target',
        durationMs: 1000,
      },
    ]

    const issues = validateWorldTopology([west, east])
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'INVALID_ROAD_SOURCE',
        'UNKNOWN_ROAD_TARGET',
        'BLOCKED_ROAD_ENDPOINT',
        'INVALID_ROAD_DURATION',
        'INVALID_ROAD_NAME',
        'MISSING_RECIPROCAL_ROAD',
      ]),
    )
  })

  it('accepts an exact reciprocal authored crossing', () => {
    const west = authoredSector('west', 'S16-08')
    const east = authoredSector('east', 'S17-08')
    const eastbound = {
      from: { sectorId: 'west', x: 12, y: 4 },
      to: { sectorId: 'east', x: 0, y: 3 },
      name: 'Hinterland crossing',
      durationMs: 1800,
    }
    west.roads = [eastbound]
    east.roads = [
      {
        from: eastbound.to,
        to: eastbound.from,
        name: eastbound.name,
        durationMs: eastbound.durationMs,
      },
    ]

    expect(validateWorldTopology([west, east])).toEqual([])
  })
})
