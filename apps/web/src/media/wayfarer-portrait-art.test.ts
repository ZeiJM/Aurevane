import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import manifest from '../../public/media/art/wayfarer/provenance.json'
import { getStarterPortraitImageAssetId } from './character'
import { getImageAsset } from './registry'
import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const publicFile = (path: string) => new URL(`../../public${path}`, import.meta.url)

it('fully decodes all 39 distinct HQ Wayfarer portraits at their registered dimensions with traceable source identities', async () => {
  expect(manifest.records.map((row) => row.number)).toEqual(
    Array.from({ length: 39 }, (_, index) => index + 2),
  )
  const pixels = new Set<string>()
  const files = new Set<string>()
  for (const row of manifest.records) {
    const ref = STARTER_CHARACTER_PORTRAITS.find((option) => option.ref === row.portraitRef)!.ref
    const asset = getImageAsset(getStarterPortraitImageAssetId(ref))
    expect(asset.id).toBe(row.assetId)
    expect(asset.src).toBe(row.runtime.path)
    expect(asset.generationRequestId).toBe(manifest.requestId)
    const bytes = readFileSync(publicFile(row.runtime.path))
    expect(sha256(bytes)).toBe(row.runtime.sha256)
    expect(bytes.byteLength).toBe(row.runtime.byteLength)
    const { data, info } = await sharp(bytes)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([1024, 1024])
    expect([asset.width, asset.height]).toEqual([info.width, info.height])
    const pixelHash = sha256(data)
    expect(pixelHash).toBe(row.runtime.decodedPixelSha256)
    expect(pixels.has(pixelHash)).toBe(false)
    expect(files.has(row.runtime.sha256)).toBe(false)
    pixels.add(pixelHash)
    files.add(row.runtime.sha256)
    const colors = new Set<number>()
    for (let offset = 0; offset < data.length && colors.size <= 256; offset += info.channels * 64) {
      colors.add((data[offset]! << 16) | (data[offset + 1]! << 8) | data[offset + 2]!)
    }
    expect(colors.size).toBeGreaterThan(256)
    expect(row.origin).toBe('OpenAI built-in imagegen')
    expect(row.generationRequestId).toMatch(/^exec-[0-9a-f-]+$/)
    expect(row.generatedMaster.dimensions[0]).toBeGreaterThanOrEqual(1024)
    expect(row.generatedMaster.dimensions[0]).toBe(row.generatedMaster.dimensions[1])
    expect(row.generatedMaster.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(row.prompt.length).toBeGreaterThan(100)
    expect(row.inputs[0]!.sha256).toMatch(/^[a-f0-9]{64}$/)
  }
  expect(pixels.size).toBe(39)
}, 30_000)

it('preserves the first Wayfarer and every Adventure portrait byte for byte', async () => {
  expect(manifest.preservedAssets).toHaveLength(25)
  for (const row of manifest.preservedAssets) {
    const ref = STARTER_CHARACTER_PORTRAITS.find((option) => option.ref === row.portraitRef)!.ref
    const asset = getImageAsset(getStarterPortraitImageAssetId(ref))
    const source = asset.src!
    const bytes = source.startsWith('data:image/webp;base64,')
      ? Buffer.from(source.slice('data:image/webp;base64,'.length), 'base64')
      : readFileSync(publicFile(source))
    expect(sha256(bytes)).toBe(row.sha256)
    const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true })
    expect([decoded.info.width, decoded.info.height]).toEqual(row.dimensions)
    expect([asset.width, asset.height]).toEqual(row.dimensions)
  }
})
