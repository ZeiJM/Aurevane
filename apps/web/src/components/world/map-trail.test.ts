import { expect, it, vi } from 'vitest'
import { buildTrailGround, paintNaturalTrail, trailPorts } from './map-trail'
import type { WorldCell, WorldSectorView } from '@/world/types'
const cell = (x: number, y: number, terrain = '='): WorldCell => ({
  x,
  y,
  terrain,
  walkable: terrain !== '~',
  safe: false,
})
it('keeps road connections at shared cell midpoints in every direction and junction', () => {
  const center = cell(4, 4)
  const cells = [center, cell(4, 3), cell(5, 4), cell(4, 5), cell(3, 4)]
  const terrain = new Map(cells.map((c) => [`${c.x}:${c.y}`, c]))
  expect(trailPorts(center, terrain)).toEqual([
    [0.5, 0],
    [1, 0.5],
    [0.5, 1],
    [0, 0.5],
  ])
  expect(trailPorts(cell(5, 4), terrain)).toContainEqual([0, 0.5])
  expect(trailPorts(cell(4, 5), terrain)).toContainEqual([0.5, 0])
  expect(
    trailPorts(
      center,
      new Map([
        ['4:4', center],
        ['5:4', cell(5, 4, '~')],
      ]),
    ),
  ).toEqual([])
})
it('paints soft worn strokes without replacing a whole ground square and never paints water', () => {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  const c = cell(4, 4),
    terrain = new Map([
      ['4:4', c],
      ['4:3', cell(4, 3)],
      ['4:5', cell(4, 5)],
    ])
  expect(paintNaturalTrail(ctx, c, 64, terrain, '#97866b', 'public', false)).toBe(2)
  expect(ctx.quadraticCurveTo).toHaveBeenCalled()
  expect(ctx.stroke).toHaveBeenCalledTimes(3)
  expect(ctx.fillRect).not.toHaveBeenCalled()
  vi.mocked(ctx.stroke).mockClear()
  expect(paintNaturalTrail(ctx, cell(4, 4, '~'), 64, terrain, '#97866b', 'public', false)).toBe(0)
  expect(ctx.stroke).not.toHaveBeenCalled()
})

it('joins a loaded public neighbor through the wrapped longitude edge without inventing unknown roads', () => {
  const a = {
    id: 'a',
    charted: true,
    atlasColumn: 127,
    atlasRow: 10,
    cells: [cell(12, 4)],
  } as WorldSectorView
  const b = {
    id: 'b',
    charted: true,
    atlasColumn: 0,
    atlasRow: 10,
    cells: [cell(0, 4)],
  } as WorldSectorView
  expect(trailPorts(a.cells[0]!, buildTrailGround(a, [a, b]))).toContainEqual([1, 0.5])
  expect(trailPorts(b.cells[0]!, buildTrailGround(b, [a, b]))).toContainEqual([0, 0.5])
  expect(trailPorts(a.cells[0]!, buildTrailGround(a, [a]))).toEqual([])
  expect(trailPorts(a.cells[0]!, buildTrailGround(a, [a, { ...b, charted: false }]))).toEqual([])
})
