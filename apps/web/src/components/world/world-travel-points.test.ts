import { describe, expect, it } from 'vitest'
import type { WorldAtlasCell, WorldView } from '@/world/types'
import { FERRY_MAINLAND_DOCK } from '@/world/ferry'
import { nextWorldTravelPoint, worldTravelPoints } from './world-travel-points'

const sector = (id: string, charted = true, coordinate = 'S01-01'): WorldAtlasCell => ({
  id,
  charted,
  coordinate,
  name: id,
  regionId: 'aureth-crown',
  column: 0,
  row: 0,
})

describe('known World Travel Points', () => {
  it('shares one ordered list, deduplicates sectors and excludes private, missing and unmapped anchors', () => {
    const view: Pick<WorldView, 'atlas' | 'anchors'> = {
      atlas: [
        sector(FERRY_MAINLAND_DOCK.sectorId),
        sector('west'),
        sector('north'),
        sector('hidden', false),
        sector('unmapped', true, 'Beyond the charts'),
        sector('unvisited'),
        { ...sector('town', true, 'S04-01'), townId: 'town', name: 'Public town' },
      ],
      anchors: [
        { id: 'west-a', name: 'West Waystone', sectorId: 'west' },
        { id: 'west-b', name: 'Duplicate Waystone', sectorId: 'west' },
        { id: 'north-a', name: 'North Waystone', sectorId: 'north' },
        { id: 'secret', name: 'Hidden Waystone', sectorId: 'hidden' },
        { id: 'missing', name: 'Missing Waystone', sectorId: 'missing' },
        { id: 'unmapped', name: 'Unmapped Waystone', sectorId: 'unmapped' },
      ],
    }
    expect(worldTravelPoints(view)).toEqual([
      { id: FERRY_MAINLAND_DOCK.sectorId, name: 'Ferry Terminal', coordinate: 'S01-01' },
      { id: 'west', name: 'West Waystone', coordinate: 'S01-01' },
      { id: 'north', name: 'North Waystone', coordinate: 'S01-01' },
      { id: 'town', name: 'Public town', coordinate: 'S04-01' },
    ])
    expect(view.anchors).toHaveLength(6)
  })

  it('cycles forward and wraps from the same selected destination in either control', () => {
    const points = [
      { id: 'mainland', name: 'Mainland', coordinate: 'S01-01' },
      { id: 'west', name: 'West Waystone', coordinate: 'S02-01' },
      { id: 'north', name: 'North Waystone', coordinate: 'S03-01' },
    ]
    for (const [selected, expected] of [
      [null, 'mainland'],
      ['other-sector', 'mainland'],
      ['mainland', 'west'],
      ['west', 'north'],
      ['north', 'mainland'],
    ] as const)
      expect(nextWorldTravelPoint(points, selected)?.id).toBe(expected)
    expect(nextWorldTravelPoint(points.slice(0, 1), 'mainland')?.id).toBe('mainland')
    expect(nextWorldTravelPoint([], null)).toBeNull()
    expect(points.map(({ id }) => id)).toEqual(['mainland', 'west', 'north'])
  })

  it('does not invent a mainland stop when the server has supplied no charted destination', () => {
    expect(worldTravelPoints({ anchors: [] })).toEqual([])
    expect(worldTravelPoints({ atlas: [sector('hidden', false)], anchors: [] })).toEqual([])
  })
})
