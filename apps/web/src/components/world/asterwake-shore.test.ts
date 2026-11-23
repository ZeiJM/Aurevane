import { expect, it } from 'vitest'
import { GRID_HEIGHT, GRID_WIDTH } from '@/world/catalog'
import type { WorldAtlasCell } from '@/world/types'
import { asterwakeShore } from './asterwake-shore'

function island(column: number, waterTiles?: string): WorldAtlasCell {
  return {
    id: `atlas:${column}:10`,
    name: 'Asterwake',
    coordinate: '',
    regionId: 'asterwake',
    column,
    row: 10,
    charted: true,
    waterTiles,
  }
}

it('joins the visual shoreline across the longitude seam and preserves water and dry tile centers', () => {
  const rows = [
    ...Array<string>(4).fill('~'.repeat(GRID_WIDTH)),
    ...Array<string>(GRID_HEIGHT - 4).fill('.'.repeat(GRID_WIDTH)),
  ]
  const west = island(127, rows.join(''))
  const east = island(0, rows.join(''))
  const charted = (column: number, row: number) =>
    [west, east].find((sector) => sector.column === column && sector.row === row)
  const sampleWest = asterwakeShore(127, 10, charted)!
  const sampleEast = asterwakeShore(0, 10, charted)!

  expect(sampleWest(GRID_WIDTH - 0.5, 3.5)).toBe(0)
  expect(sampleEast(0.5, 4.5)).toBe(1)
  const waterline = sampleEast(0, 4)
  expect(waterline).toBeGreaterThan(0.45)
  expect(waterline).toBeLessThan(0.55)
  expect(sampleWest(GRID_WIDTH, 4)).toBe(waterline)
})

it('treats an uncharted neighbor as ocean even when it carries dry tile data', () => {
  const cells = [island(5), { ...island(6), charted: false }]
  const sample = asterwakeShore(5, 10, (column, row) =>
    cells.find((sector) => sector.column === column && sector.row === row),
  )!

  expect(sample(GRID_WIDTH - 0.5, 4.5)).toBe(1)
  expect(sample(GRID_WIDTH, 4.5)).toBeLessThan(0.55)
})
