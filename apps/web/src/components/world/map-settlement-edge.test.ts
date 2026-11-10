import { GRID_WIDTH } from '@/world/catalog'
import { ATLAS_COLUMNS } from '@/world/topology'
import type { WorldCell, WorldSectorView } from '@/world/types'
import { describe, expect, it } from 'vitest'
import { buildPublicCoasts } from './map-coast'
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

function builtTown(id: string, cells: WorldCell[], column = 1, buildingX = 3) {
  return {
    ...sector(id, cells, column, id),
    buildings: [{ id: 'house', x: buildingX, y: 3, width: 1, height: 1, artIndex: 0 }],
  }
}

describe('settlement ground edges', () => {
  it('paves dry road entrances close to buildings and leaves adjacent dirt and blocked ground alone', () => {
    const town = builtTown('town', [
      cell(5, 4, true),
      cell(6, 4, false),
      cell(5, 3, false, '.'),
      cell(4, 4, false, '#', false),
    ])
    const edges = buildSettlementEdges([town]).get('town')
    expect(edges?.map(({ x, y, side }) => [x, y, side])).toEqual([[5, 4, 1]])
  })

  it('continues across the wrapped atlas seam only for dry roads leaving a built-up town', () => {
    const town = builtTown(
      'town',
      [cell(GRID_WIDTH - 1, 4, true)],
      ATLAS_COLUMNS - 1,
      GRID_WIDTH - 2,
    )
    const district = sector('district', [cell(0, 4, true)], 0, 'town')
    const wild = sector('wild', [cell(0, 4, false)], 0)
    const shore = sector('shore', [cell(0, 4, false), cell(1, 3, false, '~', false)], 0)

    expect(buildSettlementEdges([town, district]).get('town')).toBeUndefined()
    expect(
      buildSettlementEdges([town, wild])
        .get('town')
        ?.map(({ side }) => side),
    ).toEqual([1])
    expect(buildSettlementEdges([town, shore]).get('town')).toBeUndefined()
  })

  it('keeps stone off inland shores and exposed coastlines even on a town road', () => {
    const town = builtTown('town', [cell(5, 4, true), cell(6, 4, false)])
    const lake = { ...town, cells: [...town.cells, cell(6, 3, false, '~', false)] }
    expect(buildSettlementEdges([lake]).get('town')).toBeUndefined()

    const coastal = builtTown('town', [cell(5, 0, true), cell(6, 0, false)], 1, 5)
    const coasts = buildPublicCoasts({ sectors: [coastal], atlas: [] })
    expect(buildSettlementEdges([coastal], coasts).get('town')).toBeUndefined()
  })

  it('leaves distant town edges, expedition landings and ferry decks unpaved', () => {
    const ground = [cell(9, 3, true, 's'), cell(9, 2, false)]
    const town = builtTown('distant-town', ground)
    const landing = sector('uncharted-landing', ground)
    const ferry = sector('ferry:test', ground)
    const camp = sector('camp', ground, 2)
    expect(buildSettlementEdges([town, landing, ferry, camp]).size).toBe(0)
  })
})
