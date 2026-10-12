import { expect, it } from 'vitest'
import { globeFallbackPixels } from './globe-fallback'
it('rotates the same mapped terrain on a sphere and leaves corners transparent', () => {
  const texture = { width: 64, height: 32, pixels: new Uint8Array(64 * 32 * 4) }
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) texture.pixels.set([x * 3, y * 6, 90, 255], (y * 64 + x) * 4)
  const first = globeFallbackPixels(texture, { longitude: 0, latitude: 0 }, 0.94, 64, 32, 80)
  const rotated = globeFallbackPixels(texture, { longitude: 45, latitude: 20 }, 0.94, 64, 32, 80)
  expect(first[3]).toBe(0)
  expect(first[(40 * 80 + 40) * 4 + 3]).toBe(255)
  expect([...rotated]).not.toEqual([...first])
})
