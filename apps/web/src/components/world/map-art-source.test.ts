import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import animeAssets from './map-anime-assets.json'
import { worldMapArtSource } from './map-art-source'

const art = new URL('../../../public/media/art/world/runtime/', import.meta.url)

describe('repainted World art', () => {
  it.each(animeAssets)('keeps the dimensions and sprite masks of %s', async (name) => {
    const original = await readFile(new URL(name, art))
    const repaint = await readFile(new URL(`anime/${name}`, art))
    const [originalImage, repaintedImage] = await Promise.all([
      sharp(original).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true }),
      sharp(repaint).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true }),
    ])
    expect(repaint.equals(original)).toBe(false)
    expect(repaintedImage.info.width).toBe(originalImage.info.width)
    expect(repaintedImage.info.height).toBe(originalImage.info.height)
    expect(repaintedImage.data.equals(originalImage.data)).toBe(true)
    expect(worldMapArtSource(name)).toBe(`/media/art/world/runtime/anime/${name}`)
  })

  it('keeps the normal runtime URL for assets outside the repaint', () => {
    expect(worldMapArtSource('ferryman-portrait-v02.webp')).toBe(
      '/media/art/world/runtime/ferryman-portrait-v02.webp',
    )
  })
})
