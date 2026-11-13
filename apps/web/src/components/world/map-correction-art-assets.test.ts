import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
const sheets = [
  'grand-discoveries',
  'natural-lakes',
  'ocean-features',
  'elemental-waterfall-valley',
  'remote-colosseum',
  'town-grand-architecture',
  'town-ordinary-architecture',
  'crown-wall-kit',
  'ocean-grand-islet',
  'valley-fire-detail',
  'valley-ice-detail',
  'valley-cascade-detail',
] as const
const base = new URL('../../../public/media/art/world/', import.meta.url)
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
describe('corrective discovery art derivatives', () => {
  it.each(sheets)(
    'retains source identity and bounded full-alpha %s atlas without chromatic matte',
    async (sheet) => {
      const manifest = JSON.parse(
        await readFile(new URL(`runtime/${sheet}-v01.manifest.json`, base), 'utf8'),
      )
      const source = await readFile(new URL(manifest.source.path, base)),
        runtime = await readFile(new URL(manifest.runtime.path, base))
      expect(sha256(source)).toBe(manifest.source.sha256)
      expect(sha256(runtime)).toBe(manifest.runtime.sha256)
      const { data, info } = await sharp(runtime)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      expect([info.width, info.height]).toEqual([manifest.runtime.width, manifest.runtime.height])
      expect(runtime.length).toBeLessThan(1_000_000)
      expect(manifest.sprites).toHaveLength(manifest.runtime.columns * manifest.runtime.rows)
      if (
        sheet === 'elemental-waterfall-valley' ||
        sheet === 'remote-colosseum' ||
        sheet === 'ocean-grand-islet'
      )
        expect(info.width).toBe(1536)
      let visible = 0,
        chromaticFringe = 0
      for (let p = 0; p < data.length; p += 4) {
        const alpha = data[p + 3]!,
          brightest = Math.max(data[p]!, data[p + 1]!, data[p + 2]!),
          darkest = Math.min(data[p]!, data[p + 1]!, data[p + 2]!)
        if (alpha === 0) continue
        visible++
        if (alpha <= 32 && brightest > 190 && brightest - darkest > 130) chromaticFringe++
      }
      expect(chromaticFringe / visible).toBeLessThan(0.0005)
      // Transparent safety margins prevent clipped heads/halo or atlas-neighbor bleed.
      for (const sprite of manifest.sprites) {
        if (manifest.runtime.preserveFrame) {
          expect(sprite.runtimeBounds).toEqual({
            left: 0,
            top: 0,
            width: info.width,
            height: info.height,
          })
          continue
        }
        expect(sprite.runtimeBounds.left).toBeGreaterThanOrEqual(16)
        expect(sprite.runtimeBounds.top).toBeGreaterThanOrEqual(16)
        expect(sprite.runtimeBounds.left + sprite.runtimeBounds.width).toBeLessThanOrEqual(
          manifest.runtime.cellWidth - 16,
        )
        expect(sprite.runtimeBounds.top + sprite.runtimeBounds.height).toBe(
          manifest.runtime.cellHeight - 24,
        )
      }
    },
  )
  it('selects the Owner reverted original elemental figures while retaining rejected masters', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('runtime/elemental-waterfall-valley-v01.manifest.json', base), 'utf8'),
    )
    expect(manifest.source.path).toBe('sources/elemental-waterfall-valley-owner-selected-v01.png')
    expect((await sharp(fileURLToPath(new URL(manifest.source.path, base))).metadata()).width).toBe(
      1536,
    )
  })
})

it('packs complete grand discoveries without detached neighboring-cell fragments', async () => {
  const { data, info } = await sharp(new URL('runtime/grand-discoveries-v01.webp', base).pathname)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let cell = 0; cell < 4; cell++) {
    const seen = new Uint8Array(512 * 512),
      areas: number[] = []
    for (let i = 0; i < seen.length; i++) {
      const alpha = (p: number) =>
        data[
          ((Math.floor(cell / 2) * 512 + Math.floor(p / 512)) * info.width +
            (cell % 2) * 512 +
            (p % 512)) *
            4 +
            3
        ]!
      if (seen[i] || alpha(i) <= 64) continue
      const queue = [i]
      seen[i] = 1
      for (let at = 0; at < queue.length; at++) {
        const p = queue[at]!,
          x = p % 512,
          y = Math.floor(p / 512)
        for (const n of [
          x > 0 ? p - 1 : -1,
          x < 511 ? p + 1 : -1,
          y > 0 ? p - 512 : -1,
          y < 511 ? p + 512 : -1,
        ])
          if (n >= 0 && !seen[n] && alpha(n) > 64) {
            seen[n] = 1
            queue.push(n)
          }
      }
      areas.push(queue.length)
    }
    areas.sort((a, b) => b - a)
    expect(areas.filter((area) => area > 100)).toHaveLength(1)
  }
})

it('keeps opaque Crown masonry free of a broad translucent background halo', async () => {
  const { data, info } = await sharp(new URL('runtime/crown-wall-kit-v01.webp', base).pathname)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let orphan = 0,
    visible = 0
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3]!
      if (alpha > 32) visible++
      if (alpha <= 32 || alpha >= 240) continue
      let nearOpaque = false
      for (let dy = -3; dy <= 3 && !nearOpaque; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const px = x + dx,
            py = y + dy
          if (
            px >= 0 &&
            py >= 0 &&
            px < info.width &&
            py < info.height &&
            data[(py * info.width + px) * 4 + 3]! >= 240
          ) {
            nearOpaque = true
            break
          }
        }
      if (!nearOpaque) orphan++
    }
  expect(orphan / visible).toBeLessThan(0.001)
})
