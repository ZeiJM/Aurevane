import { expect, it } from 'vitest'
import { globeFallbackPixels } from './globe-fallback'
import { globeVeilTexture, UNCHARTED_VEIL_FOCUS } from './globe-veil'

it('uses the same bounded decorative mask throughout globe rotation, without painting over charted ground', () => {
  const ocean = { pixels: new Uint8Array([0, 0, 0, 0]), width: 1, height: 1 }
  const charted = { pixels: new Uint8Array([130, 140, 100, 255]), width: 1, height: 1 }
  const mainland = { longitude: 0, latitude: 0 }
  const pixelAtCenter = (texture: typeof ocean, position: typeof mainland) => [
    ...globeFallbackPixels(texture, position, 0.94, 1, 1, 81).slice(13_120, 13_124),
  ]
  const unknown = pixelAtCenter(ocean, UNCHARTED_VEIL_FOCUS)
  const clear = pixelAtCenter(ocean, mainland)
  expect(unknown[0]).toBeGreaterThan(clear[0]! + 20)
  expect(pixelAtCenter(charted, UNCHARTED_VEIL_FOCUS)).toEqual(pixelAtCenter(charted, mainland))
  const texture = globeVeilTexture()
  expect(globeVeilTexture()).toBe(texture)
  expect(texture.pixels[3]).toBe(0)
})
