import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { globeAtlasDetailPixels } from './globe-atlas'
import { globeVeilTexture } from './globe-veil'

it('decodes the packed ground-only plates and binds runtime bytes to both generated masters', async () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL(
        '../../../public/media/art/world/runtime/globe-materials-v02.provenance.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ) as { files: { path: string; sha256: string; width: number; height: number; bytes: number }[] }
  for (const file of manifest.files) {
    const bytes = readFileSync(new URL(`../../../../../${file.path}`, import.meta.url))
    const metadata = await sharp(bytes).metadata()
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
    expect(metadata.width).toBe(file.width)
    expect(metadata.height).toBe(file.height)
    expect(bytes.length).toBe(file.bytes)
  }
  const file = manifest.files.at(-1)!
  expect([file.width, file.height]).toEqual([2048, 2048])
  const bytes = await sharp(readFileSync(new URL(`../../../../../${file.path}`, import.meta.url)))
    .ensureAlpha()
    .raw()
    .toBuffer()
  const painting = { pixels: bytes, width: file.width, height: file.height }
  const atlas = Array.from({ length: 64 }, (_, n) => ({
    id: n === 36 ? 'frostmere' : `land-${n}`,
    name: 'Snow',
    coordinate: '',
    regionId: 'frostmere',
    column: n % 8,
    row: Math.floor(n / 8),
    charted: true,
  }))
  const image = globeAtlasDetailPixels(atlas, 8, 8, painting)
  const levels: number[] = []
  for (let y = 24; y < 104; y++)
    for (let x = 24; x < 104; x++) levels.push(image.pixels[(y * image.width + x) * 4]!)
  levels.sort((a, b) => a - b)
  expect(
    levels[Math.floor(levels.length * 0.95)]! - levels[Math.floor(levels.length * 0.05)]!,
  ).toBeGreaterThan(45)
  const veil = globeVeilTexture(painting)
  expect(image.veil).toBe(veil)
  expect(veil.pixels.some((value, index) => index % 4 === 3 && value === 0)).toBe(true)
})

it('derives a fading shallow-water shelf only from the supplied public coast', () => {
  const cell = {
    id: 'coast',
    name: 'Coast',
    coordinate: '',
    regionId: 'verdant-expanse',
    column: 2,
    row: 2,
    charted: true,
  }
  const image = globeAtlasDetailPixels([cell], 8, 8)
  const alpha = (x: number, y: number) => image.ocean.pixels[(y * image.width + x) * 4 + 3]!
  expect(alpha(50, 40)).toBeGreaterThan(alpha(64, 40))
  expect(alpha(95, 40)).toBe(0)
  expect(image.pixels[(40 * image.width + 64) * 4 + 3]).toBe(0)
  expect(
    globeAtlasDetailPixels([{ ...cell, charted: false }], 8, 8).ocean.pixels.every(
      (value) => value === 0,
    ),
  ).toBe(true)
})
