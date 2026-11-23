import { expect, it, vi } from 'vitest'
import { buildTrailGround, naturalTrailWear, paintNaturalTrail, trailPorts } from './map-trail'
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

it('keeps the wilderness trail narrow and low contrast against living ground', () => {
  const widths: number[] = [],
    alphas: number[] = []
  const ctx = new Proxy(
    {
      globalAlpha: 1,
      lineWidth: 0,
      stroke() {
        widths.push(this.lineWidth)
        alphas.push(this.globalAlpha)
      },
    },
    { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
  ) as unknown as CanvasRenderingContext2D
  const c = cell(4, 4),
    terrain = new Map([
      ['4:4', c],
      ['4:3', cell(4, 3)],
      ['4:5', cell(4, 5)],
    ])
  paintNaturalTrail(ctx, c, 64, terrain, '#97866b', 'remote', false)
  expect(Math.max(...widths)).toBeLessThanOrEqual(64 * 0.48)
  expect(Math.max(...alphas)).toBeLessThanOrEqual(0.17)
})

it('leaves most remote road marks absent while retaining actual settlement and landmark approaches', () => {
  const remote = {
    id: 'remote',
    charted: true,
    atlasColumn: 40,
    atlasRow: 30,
    landmarks: [],
  } as unknown as WorldSectorView
  const marks = Array.from({ length: 117 }, (_, i) =>
    naturalTrailWear(remote, cell(i % 13, Math.floor(i / 13))),
  )
  expect(marks.filter((wear) => wear === 0).length).toBeGreaterThan(58)
  expect(marks.some((wear) => wear > 0)).toBe(true)
  expect(naturalTrailWear({ ...remote, townId: 'town' }, cell(6, 4))).toBe(1)
  expect(
    naturalTrailWear(
      { ...remote, landmarks: [{ id: 'bridge', name: 'bridge', kind: 'bridge', x: 6, y: 4 }] },
      cell(6, 5),
    ),
  ).toBe(1)
  expect(naturalTrailWear(remote, cell(6, 4))).toBe(
    naturalTrailWear({ ...remote, atlasColumn: 168 }, cell(6, 4)),
  )
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
