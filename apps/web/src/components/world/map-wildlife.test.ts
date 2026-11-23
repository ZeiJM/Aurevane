import { afterEach, describe, expect, it, vi } from 'vitest'
import { wildlifePose, type Wildlife } from './map-ambient'
import { createWildlifePartCache, drawWildlife } from './map-wildlife'

const fox: Wildlife = {
  seed: 0,
  index: 4,
  flying: false,
  path: [
    { x: 0.5, y: 0.5 },
    { x: 1.5, y: 0.5 },
  ],
}
const sheet = { width: 1536, height: 1024 } as HTMLImageElement

function paint(
  animal: Wildlife,
  now: number,
  animate = true,
  cache?: ReturnType<typeof createWildlifePartCache>,
) {
  type Draw = { image: CanvasImageSource; matrix: number[]; crop: number[] }
  const draws: Draw[] = [],
    shadows: number[][] = [],
    stack: number[][] = []
  let clipped = 0
  let matrix = [1, 0, 0, 1, 0, 0]
  const transform = (b: number[]) => {
    const a = matrix
    matrix = [
      a[0]! * b[0]! + a[2]! * b[1]!,
      a[1]! * b[0]! + a[3]! * b[1]!,
      a[0]! * b[2]! + a[2]! * b[3]!,
      a[1]! * b[2]! + a[3]! * b[3]!,
      a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
      a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
    ]
  }
  const ctx = {
    save: () => stack.push([...matrix]),
    restore: () => {
      matrix = stack.pop()!
    },
    translate: (x: number, y: number) => transform([1, 0, 0, 1, x, y]),
    scale: (x: number, y: number) => transform([x, 0, 0, y, 0, 0]),
    transform: (...values: number[]) => transform(values),
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clip() {
      clipped++
    },
    fill() {},
    ellipse: (...values: number[]) => shadows.push(values),
    drawImage: (image: CanvasImageSource, ...crop: number[]) =>
      draws.push({ image, matrix: [...matrix], crop }),
  } as unknown as CanvasRenderingContext2D
  drawWildlife(ctx, sheet, animal, wildlifePose(animal, now, animate), 100, 150, 64, cache)
  return { draws, shadows, matrix, clipped }
}

describe('original wildlife articulation', () => {
  it('changes ground-leg painting while the body and contact shadow remain grounded', () => {
    const first = paint(fox, 550),
      next = paint(fox, 900)
    expect(first.draws).toHaveLength(5)
    expect(first.draws.slice(0, 4)).not.toEqual(next.draws.slice(0, 4))
    expect(first.draws[4]).toEqual(next.draws[4])
    expect(first.shadows).toEqual(next.shadows)
    const footHeights = [414, 418, 410, 424]
    const feet = first.draws.slice(0, 4).map(({ matrix: m }, i) => m[3]! * footHeights[i]! + m[5]!)
    expect(feet.some((y) => Math.abs(y - 150) < 0.01)).toBe(true)
    expect(feet.some((y) => y < 149)).toBe(true)
    expect(first.matrix).toEqual([1, 0, 0, 1, 0, 0])
  })

  it('leaves idle and motion-disabled animals completely still', () => {
    expect(paint(fox, 2500)).toEqual(paint(fox, 3100))
    expect(paint(fox, 0, false)).toEqual(paint(fox, 16000, false))
  })

  it('uses one cropped bird, articulating its wings independently of its body', () => {
    const bird = { ...fox, flying: true, index: 7 }
    const first = paint(bird, 400),
      next = paint(bird, 510)
    expect(first.draws).toHaveLength(3)
    for (const draw of first.draws) {
      expect(draw.crop[0]).toBe(1152)
      expect(draw.crop[1]).toBe(672)
      expect(draw.crop[2]).toBe(185)
      expect(draw.crop[3]).toBe(210)
    }
    expect(first.draws[0]!.matrix[2]).not.toEqual(next.draws[0]!.matrix[2])
    expect(first.draws[2]!.matrix.slice(0, 4)).toEqual(next.draws[2]!.matrix.slice(0, 4))
    expect(paint(bird, 0, false)).toEqual(paint(bird, 16000, false))
  })

  it('raises and crouches a rabbit above its unchanged contact shadow', () => {
    const rabbit = { ...fox, index: 6 }
    const first = paint(rabbit, 550),
      next = paint(rabbit, 900)
    expect(first.draws).toHaveLength(5)
    expect(first.draws[4]).not.toEqual(next.draws[4])
    expect(first.shadows[0]!.slice(0, 2)).toEqual(next.shadows[0]!.slice(0, 2))
  })
})

function cachedParts(limit?: number) {
  const layers: { width: number; height: number }[] = []
  const clips = vi.fn(),
    draws = vi.fn(),
    transforms = vi.fn()
  vi.stubGlobal('document', {
    createElement: () => {
      const layer = {
        width: 0,
        height: 0,
        getContext: () => ({
          save() {},
          restore() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          closePath() {},
          clip: clips,
          drawImage: draws,
          setTransform: transforms,
        }),
      }
      layers.push(layer)
      return layer
    },
  })
  return { cache: createWildlifePartCache(limit), layers, clips, draws, transforms }
}
afterEach(() => vi.unstubAllGlobals())

it.each([4, 5, 6, 7])(
  'reuses masked index %s art while preserving every articulated transform',
  (index) => {
    const animal = { ...fox, index, flying: index === 7 }
    const { cache, layers, clips, draws } = cachedParts()
    const before = paint(animal, 550, true, cache)
    const parts = index === 7 ? 3 : 5
    expect(before.clipped).toBe(0)
    expect(clips).toHaveBeenCalledTimes(parts)
    expect(draws).toHaveBeenCalledTimes(parts)
    expect(layers).toHaveLength(parts)
    expect(cache.pixels).toBeLessThanOrEqual(512_000)
    expect(before.draws.map(({ matrix }) => matrix)).toEqual(
      paint(animal, 550).draws.map(({ matrix }) => matrix),
    )
    const next = paint(animal, 900, true, cache)
    expect(next.clipped).toBe(0)
    expect(cache.builds).toBe(parts)
    expect(layers).toHaveLength(parts)
    expect(clips).toHaveBeenCalledTimes(parts)
    expect(draws).toHaveBeenCalledTimes(parts)
    expect(next.draws.map(({ image }) => image)).toEqual(before.draws.map(({ image }) => image))
    expect(next.draws.map(({ matrix }) => matrix)).toEqual(
      paint(animal, 900).draws.map(({ matrix }) => matrix),
    )
    expect(next.shadows).toEqual(paint(animal, 900).shadows)
  },
)

it('retains a native-pixel filter gutter and invalidates changed source dimensions/identity', () => {
  const { cache, transforms } = cachedParts()
  const mask = [10, 20, 30, 20, 30, 40, 10, 40]
  const image = { width: 1536, height: 1024 } as HTMLImageElement
  const first = cache.get(image, 4, mask, false)!
  expect([first.left, first.top, first.width, first.height]).toEqual([9, 19, 22, 22])
  expect(transforms).toHaveBeenLastCalledWith(1, 0, 0, 1, -9, -19)
  expect(cache.get(image, 4, mask, false)).toBe(first)
  image.width *= 2
  image.height *= 2
  const larger = cache.get(image, 4, mask, false)!
  expect(larger).not.toBe(first)
  expect([larger.canvas.width, larger.canvas.height]).toEqual([42, 42])
  expect(transforms).toHaveBeenLastCalledWith(2, 0, 0, 2, -19, -39)
  image.src = '/new-nature.webp'
  const replaced = cache.get(image, 4, mask, false)!
  expect(replaced).not.toBe(larger)
  expect(cache.get({ ...image } as HTMLImageElement, 4, mask, false)).not.toBe(replaced)
  cache.clear()
  expect(cache.pixels).toBe(0)
  expect(cache.builds).toBe(0)
})

it('keeps a warmed subset without allocation/eviction churn when masks exceed its bound', () => {
  const { cache, layers } = cachedParts(20)
  const mask = [0, 0, 2, 0, 2, 2, 0, 2]
  const first = cache.get(sheet, 4, mask, false)!
  expect(first).not.toBeNull()
  for (let frame = 0; frame < 80; frame++) {
    expect(cache.get(sheet, 4, mask, false)).toBe(first)
    expect(cache.get(sheet, 5, [...mask], false)).toBeNull()
    expect(cache.get(sheet, 7, mask, true)).toBeNull()
  }
  expect(cache.pixels).toBe(16)
  expect(layers).toHaveLength(1)
})

it('fits all eighteen real wildlife masks together without rebuilding across poses', () => {
  const { cache, layers, clips } = cachedParts()
  for (const index of [4, 5, 6, 7]) paint({ ...fox, index, flying: index === 7 }, 550, true, cache)
  expect(cache.builds).toBe(18)
  expect(layers).toHaveLength(18)
  expect(cache.pixels).toBeLessThanOrEqual(512_000)
  cache.beginFrame()
  for (const index of [4, 5, 6, 7]) paint({ ...fox, index, flying: index === 7 }, 900, true, cache)
  expect(cache.builds).toBe(0)
  expect(clips).toHaveBeenCalledTimes(18)
  expect(layers).toHaveLength(18)
})

it('uses the direct fallback without repeated allocations when an offscreen context is unavailable', () => {
  const create = vi.fn(() => ({ width: 0, height: 0, getContext: () => null }))
  vi.stubGlobal('document', { createElement: create })
  const cache = createWildlifePartCache()
  expect(paint(fox, 550, true, cache)).toEqual(paint(fox, 550))
  expect(paint(fox, 900, true, cache)).toEqual(paint(fox, 900))
  expect(create).toHaveBeenCalledTimes(1)
  cache.clear()
  paint(fox, 550, true, cache)
  expect(create).toHaveBeenCalledTimes(2)
})
