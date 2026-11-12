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

it('veils a continental hemisphere-sized silhouette across the date line without private geometry', async () => {
  const texture = globeVeilTexture()
  let area = 0
  const span = new Set<number>()
  for (let y = 0; y < texture.height; y++)
    for (let x = 0; x < texture.width; x++)
      if (texture.pixels[(y * texture.width + x) * 4 + 3]! > 128) {
        area += Math.cos(((90 - ((y + 0.5) / texture.height) * 180) * Math.PI) / 180)
        span.add(x)
      }
  const sphereArea = (texture.width * texture.height * 2) / Math.PI
  expect(area / sphereArea).toBeGreaterThan(0.16)
  expect(span.size).toBeGreaterThan(texture.width / 3)
  expect(span.has(0)).toBe(true)
  expect(span.has(texture.width - 1)).toBe(true)
  const { readFileSync } = await import('node:fs')
  const source = readFileSync(new URL('./globe-veil.ts', import.meta.url), 'utf8')
  expect(source).not.toMatch(/server\/|void-realms|warped-continent|sectorId|discoveries/)
})

it('shows earthy dry land and pale obscuring cloud banks rather than one blank purple surface', () => {
  const texture = globeVeilTexture()
  let core = 0,
    ground = 0,
    clouds = 0
  const brightness: number[] = []
  for (let i = 0; i < texture.pixels.length; i += 4)
    if (texture.pixels[i + 3]! > 220) {
      const r = texture.pixels[i]!,
        g = texture.pixels[i + 1]!,
        b = texture.pixels[i + 2]!
      core++
      if (r > g * 1.07 && g > b * 1.03) ground++
      if (Math.min(r, g, b) > 125 && Math.max(r, g, b) - Math.min(r, g, b) < 32) clouds++
      brightness.push((r + g + b) / 3)
    }
  brightness.sort((a, b) => a - b)
  expect(ground / core).toBeGreaterThan(0.15)
  expect(clouds / core).toBeGreaterThan(0.1)
  expect(
    brightness[Math.floor(brightness.length * 0.95)]! -
      brightness[Math.floor(brightness.length * 0.05)]!,
  ).toBeGreaterThan(45)
})
