import { GRID_WIDTH } from '@/world/catalog'
import { ATLAS_COLUMNS } from '@/world/topology'
import type { WorldCell, WorldSectorView } from '@/world/types'
import { describe, expect, it } from 'vitest'
import { buildSettlementEdges } from './map-settlement-edge'

function cell(x: number, y: number, safe: boolean, terrain = '=', walkable = true): WorldCell {
  return { x, y, safe, terrain, walkable }
}

function sector(id: string, cells: WorldCell[], column?: number, townId?: string): WorldSectorView {
  return {
    id,
    name: id,
    regionId: 'frostmere',
    coordinate: id,
    charted: column !== undefined,
    atlasColumn: column,
    atlasRow: column === undefined ? undefined : 2,
    townId,
    east: 0,
    north: 0,
    art: null,
    cells,
    landmarks: [],
    exits: [],
  }
}

describe('settlement ground edges', () => {
  it('marks the exit of the protected footprint and leaves water, blocked and unknown cells alone', () => {
    const town = sector(
      'town',
      [
        cell(5, 4, true),
        cell(6, 4, false),
        cell(5, 3, false, '~', false),
        cell(4, 4, false, '#', false),
      ],
      1,
      'town',
    )

    expect(buildSettlementEdges([town]).get('town')).toEqual([{ x: 5, y: 4, side: 1, road: true }])
  })

  it('continues across the atlas seam only when the neighbouring ground exits the settlement', () => {
    const town = sector('town', [cell(GRID_WIDTH - 1, 4, true, '.')], ATLAS_COLUMNS - 1, 'town')
    const district = sector('district', [cell(0, 4, true)], 0, 'town')
    const wild = sector('wild', [cell(0, 4, false, '.')], 0)

    expect(buildSettlementEdges([town, district]).get('town')).toBeUndefined()
    expect(buildSettlementEdges([town, wild]).get('town')).toEqual([
      { x: GRID_WIDTH - 1, y: 4, side: 1, road: false },
    ])
  })

  it('marks protected landing ground and leaves ferry decks and unprotected camps alone', () => {
    const ground = [cell(4, 3, true, 's'), cell(4, 2, false, '.')]
    const landing = sector('uncharted-landing', ground)
    const ferry = sector('ferry:test', ground)
    const camp = sector('camp', [cell(4, 3, false, '.'), cell(4, 2, false, '.')], 1)

    const edges = buildSettlementEdges([landing, ferry, camp])
    expect(edges.get(landing.id)).toEqual([{ x: 4, y: 3, side: 0, road: false }])
    expect(edges.has(ferry.id)).toBe(false)
    expect(edges.has(camp.id)).toBe(false)
  })
})
