import { expect, it, vi } from 'vitest'
import type { WorldCell } from '@/world/types'
import { paintSnowRoadShoulders } from './map-snow-road'

it('drifts snow inward from known walkable verges without covering water or missing neighbors', () => {
  const road: WorldCell = { x: 1, y: 1, terrain: '=', walkable: true, safe: false }
  const terrain = new Map<string, WorldCell>([
    ['1:0', { ...road, y: 0, terrain: '.', walkable: false }],
    ['0:1', { ...road, x: 0, terrain: '~', walkable: false }],
    ['2:1', { ...road, x: 2, terrain: '.' }],
  ])
  const gradient = vi.fn(() => ({ addColorStop: vi.fn() }))
  const context = {
    createLinearGradient: gradient,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D

  paintSnowRoadShoulders(context, road, 10, terrain, 'winter', 0.5)

  expect(gradient).toHaveBeenCalledExactlyOnceWith(20, 10, 15, 10)
  expect(context.fill).toHaveBeenCalledTimes(1)
})

it('does not put a snow seam between two cosmetic paved yard cells', () => {
  const road: WorldCell = { x: 1, y: 1, terrain: '.', walkable: true, safe: true }
  const terrain = new Map([['2:1', { ...road, x: 2 }]])
  const context = {
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  paintSnowRoadShoulders(context, road, 10, terrain, 'winter', 0.34, new Set(['1:1', '2:1']))
  expect(context.fill).not.toHaveBeenCalled()
})
