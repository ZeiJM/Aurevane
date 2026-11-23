import { afterEach, expect, it, vi } from 'vitest'
import { releaseStaticRaster, snapshotStaticRaster } from './map-static-raster'

afterEach(() => vi.unstubAllGlobals())

it('transfers a finished native-density layer once and releases its mutable backing', () => {
  const source = { width: 474, height: 246 } as HTMLCanvasElement
  const image = { width: 474, height: 246, close: vi.fn() } as unknown as ImageBitmap
  const drawImage = vi.fn()
  const layers: { width: number; height: number }[] = []
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
        return { drawImage }
      }
      transferToImageBitmap() {
        return image
      }
    },
  )
  const raster = snapshotStaticRaster(source)
  expect(raster).toBe(image)
  expect(drawImage).toHaveBeenCalledWith(source, 0, 0)
  expect(layers).toEqual([{ width: 0, height: 0 }])
  expect(source.width * source.height).toBe(0)
  releaseStaticRaster(raster)
  expect(image.close).toHaveBeenCalledTimes(1)
})

it.each(['unsupported', 'context', 'transfer'])(
  'retains the original pixels on %s fallback',
  (failure) => {
    const source = { width: 474, height: 246 } as HTMLCanvasElement
    const layers: { width: number; height: number }[] = []
    if (failure === 'unsupported') vi.stubGlobal('OffscreenCanvas', undefined)
    else
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
            return failure === 'context' ? null : { drawImage() {} }
          }
          transferToImageBitmap() {
            throw new Error('transfer unavailable')
          }
        },
      )
    expect(snapshotStaticRaster(source)).toBe(source)
    expect(source.width).toBe(474)
    expect(source.height).toBe(246)
    expect(layers.every(({ width, height }) => width === 0 && height === 0)).toBe(true)
    releaseStaticRaster(source)
    expect(source.width * source.height).toBe(0)
  },
)
