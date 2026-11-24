import { afterEach, expect, it, vi } from 'vitest'
import { createMapPortraitCrops } from './map-portrait-crops'

afterEach(() => vi.unstubAllGlobals())

it('retains a centered native-density crop and keeps its gray presentation separate', () => {
  vi.stubGlobal('OffscreenCanvas', undefined)
  const drawImage = vi.fn()
  const contexts: { filter: string; drawImage: typeof drawImage }[] = []
  vi.stubGlobal('document', {
    createElement() {
      const context = { filter: 'none', drawImage }
      contexts.push(context)
      return { width: 0, height: 0, getContext: () => context }
    },
  })
  const picture = {
    src: '/portrait.webp',
    naturalWidth: 400,
    naturalHeight: 240,
  } as HTMLImageElement
  const cache = createMapPortraitCrops()
  const original = cache.get(picture, 17.5, 2, false)
  expect(drawImage).toHaveBeenCalledExactlyOnceWith(picture, 80, 0, 240, 240, 0, 0, 35, 35)
  expect(cache.get(picture, 17.5, 2, false)).toBe(original)
  expect(cache.get(picture, 17.5, 2, true)).not.toBe(original)
  expect(contexts.map(({ filter }) => filter)).toEqual(['none', 'grayscale(1)'])
  expect(cache.get(picture, 17.5, 3, false)).toMatchObject({ width: 53, height: 53 })
  cache.clear()
  expect(original).toMatchObject({ width: 0, height: 0 })
})
