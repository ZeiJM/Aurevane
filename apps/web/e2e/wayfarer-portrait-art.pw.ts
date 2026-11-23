import { expect, test } from '@playwright/test'
import { resolvePublicCharacterImageUrl } from '../src/media/public-character-portrait'

test('all replacement Wayfarer public aliases decode as distinct 1024px portraits', async ({
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
      results.push({ source, width: image.naturalWidth, height: image.naturalHeight })
    }
    return results
  }, sources)
  expect(images).toHaveLength(39)
  expect(new Set(images.map((image) => image.source)).size).toBe(39)
  for (const image of images) {
    expect(image.source).toContain('?v=wayfarer-v02')
    expect([image.width, image.height]).toEqual([1024, 1024])
  }
})
