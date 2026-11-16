import { afterEach, expect, it, vi } from 'vitest'
import { createWeatherVeilCache, paintWeatherVeil } from './map-weather'

function fixture(failContext = false, failTransfer = false) {
  const gradients: { at: number[]; stops: [number, string][] }[] = []
  const images: { width: number; height: number; close: ReturnType<typeof vi.fn> }[] = []
  const layers: { width: number; height: number }[] = []
  const fillRect = vi.fn()
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {
        layers.push(this)
      }
      getContext() {
        if (failContext) return null
        return {
          fillStyle: '',
          fillRect,
          setTransform: vi.fn(),
          createRadialGradient(...at: number[]) {
            const gradient = { at, stops: [] as [number, string][] }
            gradients.push(gradient)
            return {
              addColorStop: (at: number, colour: string) => gradient.stops.push([at, colour]),
            }
          },
        }
      }
      transferToImageBitmap() {
        if (failTransfer) throw new Error('No backing resource')
        const image = { width: this.width, height: this.height, close: vi.fn() }
        images.push(image)
        return image
      }
    },
  )
  const direct = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  }
  const context = direct as unknown as CanvasRenderingContext2D
  return { gradients, images, layers, direct, context }
}
afterEach(() => vi.unstubAllGlobals())

it('reuses one native-density immutable fog bank at the failed 903x752 route size', () => {
  const f = fixture(),
    cache = createWeatherVeilCache()
  paintWeatherVeil(f.context, 903, 752, 'fog', -100, 1, cache, 1)
  const gradientCount = f.gradients.length
  const first = f.direct.drawImage.mock.calls.map((call) => call.slice(1, 5))
  expect(f.images).toHaveLength(1)
  expect(f.gradients.length).toBeGreaterThanOrEqual(4)
  expect(f.direct.createRadialGradient).not.toHaveBeenCalled()
  expect(first).toHaveLength(1)
  expect(cache.pixels).toBeLessThanOrEqual(4_000_000)
  for (let frame = 1; frame <= 80; frame++) {
    cache.beginFrame()
    paintWeatherVeil(f.context, 903, 752, 'fog', -100 + frame, 1, cache, 1)
    expect(cache.builds).toBe(0)
  }
  expect(f.images).toHaveLength(1)
  expect(f.gradients).toHaveLength(gradientCount)
  expect(f.direct.drawImage.mock.calls.every(([image]) => image === f.images[0])).toBe(true)
  expect(f.direct.drawImage.mock.calls.slice(1, 2).map((call) => call.slice(1, 5))).not.toEqual(
    first,
  )
  cache.clear()
  expect(f.images[0]!.close).toHaveBeenCalledOnce()
  expect(cache.pixels).toBe(0)
})

it.each(['fog', 'overcast', 'storm'] as const)(
  'preserves %s bank rectangles, colour stops and count',
  (weather) => {
    const f = fixture(),
      cache = createWeatherVeilCache()
    for (const quality of [0.5, 1, 2])
      for (const wind of [-2000, -100, 0, 2000]) {
        f.direct.drawImage.mockClear()
        f.gradients.length = 0
        cache.clear()
        paintWeatherVeil(f.context, 800, 600, weather, wind, quality, cache, 1.5)
        const count = Math.max(2, Math.min(5, Math.ceil((weather === 'fog' ? 4 : 3) * quality)))
        expect(f.direct.drawImage).toHaveBeenCalledOnce()
        expect(f.direct.drawImage.mock.calls[0]!.slice(1)).toEqual([
          97, 1, 1200, 900, 0, 0, 800, 600,
        ])
        for (let i = 0; i < count; i++) {
          const radius = 800 * (0.34 + (i % 3) * 0.13),
            span = 800 + 2 * radius
          const phase = wind * (weather === 'fog' ? 0.17 : 0.38) + (i * 800) / 2.4
          const x = (((phase % span) + span) % span) - radius,
            y = 600 * (0.14 + (i % 4) * 0.24)
          expect(f.gradients.map((gradient) => gradient.at)).toContainEqual([x, y, 0, x, y, radius])
        }
        expect(f.gradients.at(-1)!.stops).toEqual([
          [
            0,
            weather === 'fog'
              ? 'rgba(194,214,213,.46)'
              : weather === 'storm'
                ? 'rgba(26,36,56,.28)'
                : 'rgba(38,46,62,.27)',
          ],
          [0.46, weather === 'fog' ? 'rgba(171,197,198,.25)' : 'rgba(40,48,60,.13)'],
          [1, 'rgba(20,34,42,0)'],
        ])
      }
    cache.clear()
  },
)

it('invalidates immutable resources on weather, density and viewport changes', () => {
  const f = fixture(),
    cache = createWeatherVeilCache()
  for (const [width, weather, density] of [
    [800, 'fog', 1],
    [800, 'storm', 1],
    [800, 'storm', 1.5],
    [820, 'storm', 1.5],
  ] as const)
    paintWeatherVeil(f.context, width, 600, weather, 0, 1, cache, density)
  expect(f.images).toHaveLength(4)
  expect(f.images.slice(0, -1).every((image) => image.close.mock.calls.length === 1)).toBe(true)
  cache.clear()
  expect(f.images.at(-1)!.close).toHaveBeenCalledOnce()
})

it.each(['oversize', 'tiny', 'context', 'transfer', 'unavailable'])(
  'uses the original direct gradients without allocation churn for %s resources',
  (reason) => {
    const f = fixture(reason === 'context', reason === 'transfer'),
      cache = createWeatherVeilCache()
    if (reason === 'unavailable') vi.stubGlobal('OffscreenCanvas', undefined)
    for (let frame = 0; frame < 80; frame++)
      paintWeatherVeil(
        f.context,
        reason === 'oversize' ? 8000 : reason === 'tiny' ? 20 : 800,
        600,
        'fog',
        frame,
        1,
        cache,
        1,
      )
    expect(f.direct.createRadialGradient).toHaveBeenCalledTimes(320)
    expect(f.direct.drawImage).not.toHaveBeenCalled()
    expect(f.layers.length).toBeLessThanOrEqual(
      reason === 'oversize' || reason === 'tiny' || reason === 'unavailable' ? 0 : 1,
    )
    expect(cache.pixels).toBe(0)
  },
)

it('leaves direct paused/reduced painting and clear/rain skies outside the cache', () => {
  const f = fixture(),
    cache = createWeatherVeilCache()
  paintWeatherVeil(f.context, 800, 600, 'fog', 0)
  expect(f.direct.createRadialGradient).toHaveBeenCalledTimes(4)
  for (const weather of ['clear', 'rain', 'wind'] as const)
    paintWeatherVeil(f.context, 800, 600, weather, 0, 1, cache, 1)
  expect(f.layers).toHaveLength(0)
})

it('rebuilds once at the padded drift boundary and closes the previous bitmap', () => {
  const f = fixture(),
    cache = createWeatherVeilCache()
  paintWeatherVeil(f.context, 903, 752, 'fog', 0, 1, cache, 1)
  cache.beginFrame()
  paintWeatherVeil(f.context, 903, 752, 'fog', 64 / 0.17, 1, cache, 1)
  expect(f.images).toHaveLength(1)
  expect(cache.builds).toBe(0)
  paintWeatherVeil(f.context, 903, 752, 'fog', 65 / 0.17, 1, cache, 1)
  expect(f.images).toHaveLength(2)
  expect(f.images[0]!.close).toHaveBeenCalledOnce()
  cache.clear()
})
it('preserves per-bank compositing outside the normal opaque source-over context', () => {
  const f = fixture(),
    cache = createWeatherVeilCache()
  f.direct.globalAlpha = 0.5
  paintWeatherVeil(f.context, 800, 600, 'fog', 0, 1, cache, 1)
  expect(f.direct.createRadialGradient).toHaveBeenCalledTimes(4)
  expect(f.layers).toHaveLength(0)
})
