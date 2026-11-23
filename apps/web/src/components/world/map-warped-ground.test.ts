import { expect, it } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import { buildWarpedTerrainEdges } from './map-warped-ground'

it('indexes exposed terrain edges across contiguous private districts', () => {
  const first: WorldSectorView = {
    id: 'first',
    name: 'First',
    coordinate: 'Private',
    regionId: 'umbral-march',
    art: null,
    east: 0,
    north: 0,
    sceneColumn: 0,
    sceneRow: 0,
    warpedTheme: 'ashen',
    charted: false,
    cells: [{ x: 12, y: 4, terrain: '.', walkable: true, safe: false }],
    landmarks: [],
    exits: [],
  }
  const second: WorldSectorView = {
    ...first,
    id: 'second',
    sceneColumn: 1,
    cells: [{ ...first.cells[0]!, x: 0 }],
  }
  const unexplored = buildWarpedTerrainEdges([first])
  expect(unexplored.get('first')?.cells.get('12:4')).toBe(0b1111)
  const explored = buildWarpedTerrainEdges([first, second])
  expect(explored.get('first')?.cells.get('12:4')).toBe(0b1101)
  expect(explored.get('second')?.cells.get('0:4')).toBe(0b0111)
  expect(explored.get('first')?.key).not.toBe(unexplored.get('first')?.key)
  expect(buildWarpedTerrainEdges([{ ...first, warpedTheme: undefined }]).size).toBe(0)
})
