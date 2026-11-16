import { afterEach, expect, it, vi } from 'vitest'
import { MAP_X, MAP_Y } from './map-projection'
import { createGroundProjectionCache } from './map-ground-projection'

const source = () => ({ width: 100, height: 100 }) as HTMLCanvasElement
function fixture(limit?: number) {
  const transforms: number[][] = []
  const draws: unknown[][] = []
  vi.stubGlobal('document', {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        save() {},
        restore() {},
        setTransform(...values: number[]) {
          transforms.push(values)
        },
        drawImage(...values: unknown[]) {
          draws.push(values)
        },
      }),
    }),
  })
  return { cache: createGroundProjectionCache(limit), transforms, draws }
}
afterEach(() => vi.unstubAllGlobals())

it('reuses the projected bitmap across camera changes without replaying its affine source draw', () => {
  const { cache, transforms, draws } = fixture()
  const ground = source()
  const first = cache.get(ground, 832, 576, 1.5)!
  expect(first).not.toBeNull()
  expect(cache.get(ground, 832, 576, 1.5)).toBe(first)
  expect(transforms).toEqual([
    [1.5 * MAP_X, 1.5 * MAP_Y, -1.5 * MAP_X, 1.5 * MAP_Y, -first.left, -first.top],
  ])
  expect(draws).toEqual([[ground, 0, 0, 832, 576]])
  expect(first.left).toBeLessThanOrEqual(-576 * MAP_X * 1.5 - 1)
  expect(first.top).toBe(-1)
  expect(first.canvas.width + first.left).toBeGreaterThanOrEqual(832 * MAP_X * 1.5 + 1)
  expect(first.canvas.height + first.top).toBeGreaterThanOrEqual((832 + 576) * MAP_Y * 1.5 + 1)
})

it('rebuilds for native density, settled zoom and changed source, and releases on clear', () => {
  const { cache } = fixture()
  const ground = source()
  const first = cache.get(ground, 100, 100, 1)
  expect(cache.get(ground, 100, 100, 2)).not.toBe(first)
  const zoomed = cache.get(ground, 120, 120, 2)
  expect(zoomed).not.toBe(first)
  expect(cache.get(source(), 120, 120, 2)).not.toBe(zoomed)
  cache.clear()
  expect(cache.get(ground, 120, 120, 2)).not.toBe(zoomed)
})

it('evicts old projections within the pixel budget and leaves oversized ground on the direct path', () => {
  const { cache, draws } = fixture(500)
  const ground = source()
  const first = cache.get(ground, 10, 10, 1)
  cache.beginFrame()
  cache.get(source(), 10, 10, 1)
  cache.beginFrame()
  cache.get(source(), 10, 10, 1)
  cache.beginFrame()
  expect(cache.get(ground, 10, 10, 1)).not.toBe(first)
  const count = draws.length
  expect(cache.get(source(), 100, 100, 1)).toBeNull()
  expect(draws).toHaveLength(count)
})

it('retains a warmed visible subset instead of rebuilding every frame when ground exceeds the budget', () => {
  const { cache, draws } = fixture(500)
  const grounds = [source(), source(), source()]
  const first = cache.get(grounds[0]!, 10, 10, 1)
  const second = cache.get(grounds[1]!, 10, 10, 1)
  for (let frame = 0; frame < 80; frame++) {
    cache.beginFrame()
    expect(cache.get(grounds[0]!, 10, 10, 1)).toBe(first)
    expect(cache.get(grounds[1]!, 10, 10, 1)).toBe(second)
    expect(cache.get(grounds[2]!, 10, 10, 1)).toBeNull()
    expect(cache.pixels).toBeLessThanOrEqual(500)
  }
  expect(draws).toHaveLength(2)
})
