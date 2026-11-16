import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import mountainManifest from '../../../public/media/art/world/runtime/mountains-v01.manifest.json'

const runtime = createRequire(import.meta.url)
const sharp = runtime(runtime.resolve('sharp', { paths: [runtime.resolve('next')] }))
const art = new URL('../../../public/media/art/world/runtime/', import.meta.url)

describe('mountain atlas fidelity and loading budget', () => {
  it('supplies three geographic styles, hills, monumental spires and legal road-pass art', () => {
    expect(mountainManifest.columns).toBe(4)
    expect(mountainManifest.rows).toBe(3)
    expect(mountainManifest.styles).toHaveLength(3)
    expect(mountainManifest.cellsPerStyle).toEqual([
      'clustered foothills',
      'major spire',
      'rounded hills',
      'open traversable pass',
    ])
  })
  it.each([
    ['mountains-v01.webp', 1536, 1152],
    ['mountains-hd-v01.webp', 3072, 2304],
  ] as const)(
    '%s is real alpha-backed artwork, rather than a missing or giant placeholder',
    async (name, width, height) => {
      const bytes = await readFile(new URL(name, art))
      const info = await sharp(bytes).metadata()
      expect(info.format).toBe('webp')
      expect(info.width).toBe(width)
      expect(info.height).toBe(height)
      expect(info.hasAlpha).toBe(true)
      expect(bytes.length).toBeLessThan(500_000)
      expect(bytes.length).toBeGreaterThan(30_000)
    },
  )
  it.each(['mountains-v01.webp', 'mountains-hd-v01.webp'])(
    '%s keeps every complete sprite isolated from neighbouring atlas cells',
    async (name) => {
      const { data, info } = await sharp(await readFile(new URL(name, art)))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      const cell = info.width / 4
      for (let row = 0; row < 3; row++)
        for (let column = 0; column < 4; column++) {
          let opaque = 0
          for (let y = 0; y < cell; y++)
            for (let x = 0; x < cell; x++) {
              const alpha = data[((row * cell + y) * info.width + column * cell + x) * 4 + 3]
              if (x === 0 || y === 0 || x === cell - 1 || y === cell - 1) expect(alpha).toBe(0)
              if (alpha > 0) opaque++
            }
          expect(opaque).toBeGreaterThan(0)
        }
    },
  )
})
