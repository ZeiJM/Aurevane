import { expect, it, vi } from 'vitest'
import { createWorldLightingCache, paintWorldLighting, worldLightProfile } from './map-daylight'
it('rises into bright noon then fades toward moonlit night around 19:00', () => {
  const dawn = worldLightProfile(420, 'clear')
  const noon = worldLightProfile(720, 'clear')
  const dusk = worldLightProfile(1070, 'clear')
  const night = worldLightProfile(1200, 'clear')
  expect(noon.peakBrightness).toBeGreaterThan(dawn.peakBrightness)
  expect(noon.peakBrightness).toBeGreaterThan(dusk.peakBrightness)
  expect(night.moonlight).toBeGreaterThan(0.8)
  expect(night.nightAlpha).toBeGreaterThan(dusk.nightAlpha)
  expect(worldLightProfile(0, 'clear').nightAlpha).toBeGreaterThan(0.3)
})
it('stacks weather darkness on day and night without shifting the shared clock', () => {
  const clear = worldLightProfile(720, 'clear')
  const overcast = worldLightProfile(720, 'overcast')
  const storm = worldLightProfile(720, 'storm')
  expect(clear.cloudAlpha).toBe(0)
  expect(overcast.cloudAlpha).toBeGreaterThan(0.2)
  expect(storm.cloudAlpha).toBeGreaterThan(overcast.cloudAlpha)
  expect(clear.minute).toBe(overcast.minute)
  expect(worldLightProfile(1440, 'clear')).toEqual(worldLightProfile(0, 'clear'))
})

it('composites steady night lighting once and keeps changing light on the live paint path', () => {
  const gradient = { addColorStop: vi.fn() }
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  }
  const stage = {
    ...context,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
  } as unknown as CanvasRenderingContext2D
  const first = { close: vi.fn() }
  const second = { close: vi.fn() }
  const transfer = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second)
  const create = vi.fn()
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {
        create(width, height)
      }
      getContext() {
        return context
      }
      transferToImageBitmap() {
        return transfer()
      }
    },
  )
  const cache = createWorldLightingCache()
  try {
    paintWorldLighting(stage, 1152, 720, 0, 'overcast', cache)
    paintWorldLighting(stage, 1152, 720, 1, 'overcast', cache)
    expect(create).toHaveBeenCalledExactlyOnceWith(384, 240)
    expect(context.fillRect).toHaveBeenCalledTimes(3)
    expect(stage.fillRect).not.toHaveBeenCalled()
    expect(stage.drawImage).toHaveBeenNthCalledWith(2, first, 0, 0, 1152, 720)

    // Twilight is still present when daylight has already reached its peak.
    paintWorldLighting(stage, 1152, 720, 565, 'overcast', cache)
    expect(stage.fillRect).toHaveBeenCalledTimes(3)
    expect(stage.drawImage).toHaveBeenCalledTimes(2)
    paintWorldLighting(stage, 1152, 720, 720, 'overcast', cache)
    expect(stage.drawImage).toHaveBeenLastCalledWith(second, 0, 0, 1152, 720)
    expect(first.close).toHaveBeenCalledTimes(1)
    cache.clear()
    expect(second.close).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
  }
})
