import { expect, test } from '@playwright/test'
import { resolvePublicCharacterImageUrl } from '../src/media/public-character-portrait'

test('all replacement Wayfarer public aliases decode as distinct approved painted portraits', async ({
  page,
}) => {
  const sources = Array.from({ length: 39 }, (_, index) =>
    resolvePublicCharacterImageUrl(
      null,
      `portrait.starter.wayfarer-${String(index + 2).padStart(2, '0')}`,
    )!,
  )
  await page.goto('/')
  const images = await page.evaluate(async (sources) => {
    const results = []
    for (const source of sources) {
      const image = new Image()
      image.src = source
      await image.decode()
      const target = await fetch(source)
      if (!target.ok) throw new Error('Portrait alias failed: ' + source)
      const targetUrl = new URL(target.url)
      if (targetUrl.origin !== location.origin)
        throw new Error('Portrait alias left the current origin: ' + source)
      results.push({
        source,
        target: targetUrl.pathname,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    return results
  }, sources)
  expect(images).toHaveLength(39)
  expect(new Set(images.map((image) => image.target)).size).toBe(39)
  for (const image of images) {
    expect(image.target).toMatch(/^\/api\/media\/appearance\/6\/.+\/illustrated-neutral[.]svg$/)
    expect([image.width, image.height]).toEqual([256, 256])
  }
})
