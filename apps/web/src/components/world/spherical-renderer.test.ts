import { afterEach, expect, it, vi } from 'vitest'
const capture = vi.hoisted(() => ({
  detail: vi.fn(),
  images: [] as { onload: null | (() => void); onerror: null | (() => void); src: string }[],
}))
vi.mock('./globe-atlas', () => ({
  readGlobePainting: () => ({ pixels: new Uint8Array([100, 100, 100, 255]), width: 1, height: 1 }),
  globeAtlasDetailPixels: capture.detail,
}))
import { createSphericalRenderer } from './spherical-renderer'
afterEach(() => vi.unstubAllGlobals())

it('waits for the material image before building and uploading the latest public surface', () => {
  capture.images.length = 0
  capture.detail.mockReset()
  const texture = { pixels: new Uint8Array(4), width: 1, height: 1 }
  capture.detail.mockReturnValue({ ...texture, ocean: texture })
  vi.stubGlobal(
    'Image',
    class {
      onload: null | (() => void) = null
      onerror: null | (() => void) = null
      src = ''
      constructor() {
        capture.images.push(this)
      }
    },
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('window', { devicePixelRatio: 1 })
  const methods = new Map<string, unknown>()
  const gl = new Proxy(
    {},
    {
      get: (_, key: string) => {
        if (/^[A-Z_0-9]+$/.test(key)) return key
        if (!methods.has(key))
          methods.set(
            key,
            vi.fn(() =>
              key === 'getShaderParameter' || key === 'getProgramParameter'
                ? true
                : key === 'getAttribLocation'
                  ? 0
                  : {},
            ),
          )
        return methods.get(key)
      },
    },
  )
  const canvas = {
    getContext: () => gl,
    clientWidth: 400,
    clientHeight: 400,
    width: 0,
    height: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as HTMLCanvasElement
  const renderer = createSphericalRenderer(canvas, '/materials.webp', vi.fn(), {
    columns: 128,
    rows: 64,
  })!
  const first = {
    id: 'first',
    name: 'First',
    coordinate: '',
    regionId: 'verdant-expanse',
    column: 4,
    row: 4,
    charted: true,
  }
  const latest = { ...first, id: 'latest', waterTiles: '~'.repeat(117) }
  renderer.updateAtlas([first])
  renderer.updateAtlas([latest])
  expect(capture.detail).not.toHaveBeenCalled()
  capture.images[0]!.onload!()
  expect(capture.detail).toHaveBeenCalledTimes(1)
  expect(capture.detail.mock.calls[0]![0]).toEqual([latest])
  renderer.dispose()
  expect(capture.images[0]!.onload).toBeNull()
})
