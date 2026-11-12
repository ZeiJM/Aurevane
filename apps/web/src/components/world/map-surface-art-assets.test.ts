import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sheets = ['grand-bridges', 'waterfalls', 'lavafalls', 'impact-basins'] as const

describe('packed world surface art', () => {
  it.each(sheets)('removes generated chromatic matte fringe from %s', async (sheet) => {
    const { data } = await sharp(
      fileURLToPath(
        new URL(`../../../public/media/art/world/runtime/${sheet}-v01.webp`, import.meta.url),
      ),
    )
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let visible = 0
    let chromaticFringe = 0
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3]!
      if (alpha === 0) continue
      visible++
      const red = data[index]!
      const green = data[index + 1]!
      const blue = data[index + 2]!
      const brightest = Math.max(red, green, blue)
      const darkest = Math.min(red, green, blue)
      if (alpha <= 32 && brightest > 190 && brightest - darkest > 130) chromaticFringe++
    }
    expect(chromaticFringe / visible).toBeLessThan(0.0005)
  })
})
