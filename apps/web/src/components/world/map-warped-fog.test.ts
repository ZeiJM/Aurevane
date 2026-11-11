import { expect, it, vi } from 'vitest'
import type { WorldSectorView } from '@/world/types'
import { buildWarpedFogField, paintWarpedFogEdge } from './map-warped-fog'

it('feathers only unknown borders, even across two contiguous private districts', () => {
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
  const unexplored = buildWarpedFogField([first])
  expect(unexplored.get('first')?.cells.get('12:4')).toBe(0b1111)
  const explored = buildWarpedFogField([first, second])
  expect(explored.get('first')?.cells.get('12:4')).toBe(0b1101)
  expect(explored.get('second')?.cells.get('0:4')).toBe(0b0111)
  expect(explored.get('first')?.key).not.toBe(unexplored.get('first')?.key)
  expect(buildWarpedFogField([{ ...first, warpedTheme: undefined }]).size).toBe(0)
})

it('varies private fringe depth along each exposed edge while leaving legal exit centers clear', () => {
  const gradients: number[][] = []
  const fills: number[][] = []
  const context = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: (...points: number[]) => {
      gradients.push(points)
      return { addColorStop: vi.fn() }
    },
    fillRect: (...bounds: number[]) => fills.push(bounds),
  }
  const cell = { x: 3, y: 4, terrain: '=', walkable: true, safe: false }
  paintWarpedFogEdge(context as unknown as CanvasRenderingContext2D, cell, 1, 0b1111)
  expect(gradients.length).toBeGreaterThan(4)
  for (let side = 0; side < 4; side++) {
    const depths = gradients
      .filter(([x, y, ex, ey]) =>
        side === 0
          ? y === 4 && ey! > y
          : side === 1
            ? x === 4 && ex! < x
            : side === 2
              ? y === 5 && ey! < y
              : x === 3 && ex! > x,
      )
      .map(([x, y, ex, ey]) => Math.hypot(ex! - x!, ey! - y!))
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(0.08)
    expect(depths.every((depth) => depth > 0.18 && depth < 0.46)).toBe(true)
  }
  for (const [x, y, width, height] of fills) {
    expect(x! >= 3 && y! >= 4 && x! + width! <= 4 + 1e-12 && y! + height! <= 5 + 1e-12).toBe(true)
    expect(x! <= 3.5 && x! + width! >= 3.5 && y! <= 4.5 && y! + height! >= 4.5).toBe(false)
  }
})

it('paints only supplied private fringe sides with deterministic cached contours', () => {
  const sample = (mask: number) => {
    const gradients: number[][] = []
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      createLinearGradient: (...points: number[]) => {
        gradients.push(points)
        return { addColorStop: vi.fn() }
      },
      fillRect: vi.fn(),
    }
    paintWarpedFogEdge(
      context as unknown as CanvasRenderingContext2D,
      { x: 3, y: 4, terrain: 'o', walkable: false, safe: false },
      48,
      mask,
    )
    return gradients
  }
  expect(sample(0)).toEqual([])
  expect(sample(0b0010)).toEqual(sample(0b0010))
  expect(sample(0b0010).every(([x, , endX]) => x === 4 * 48 && endX! < x!)).toBe(true)
  expect(sample(0b0010).length).toBeLessThanOrEqual(16)
})

it('softens only exposed corners with curved in-cell wisps and keeps exits clear', () => {
  const vertices: number[][] = [],
    curves: number[][] = []
  const ctx = {
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    moveTo: (...v: number[]) => vertices.push(v),
    lineTo: (...v: number[]) => vertices.push(v),
    quadraticCurveTo: (...v: number[]) => curves.push(v),
  }
  const cell = { x: 3, y: 4, terrain: '=', walkable: true, safe: false }
  paintWarpedFogEdge(ctx as unknown as CanvasRenderingContext2D, cell, 1, 0b1001)
  expect(curves.length).toBe(1)
  for (const [x, y] of [
    ...vertices,
    ...curves.flatMap((v) => [
      [v[0]!, v[1]!],
      [v[2]!, v[3]!],
    ]),
  ]) {
    expect(x).toBeGreaterThanOrEqual(3)
    expect(x).toBeLessThan(3.5)
    expect(y).toBeGreaterThanOrEqual(4)
    expect(y).toBeLessThan(4.5)
  }
  curves.length = 0
  paintWarpedFogEdge(ctx as unknown as CanvasRenderingContext2D, cell, 1, 0b0001)
  expect(curves).toHaveLength(0)
})
