import { expect, test } from '@playwright/test'

test('selected public Skill images load and decode in the browser', async ({ page }) => {
  const images: unknown = JSON.parse(
    process.env.AV_CHANGED_PUBLIC_IMAGES || '["/media/skills/inspect.webp"]',
  )
  expect(Array.isArray(images)).toBe(true)
  const paths = images as string[]
  for (const path of paths) {
    expect(typeof path).toBe('string')
    expect(path).toMatch(/^\/media\/skills\/.+\.(png|jpe?g|webp|avif)$/i)
    expect(path.split('/')).not.toContain('..')
  }
  await page.goto('/')
  const dimensions = await page.evaluate(
    async (sources) =>
      Promise.all(
        sources.map(async (src) => {
          const image = new Image()
          image.src = src
          await image.decode()
          return { width: image.naturalWidth, height: image.naturalHeight }
        }),
      ),
    paths.length ? paths : ['/media/skills/inspect.webp'],
  )
  expect(dimensions.length).toBeGreaterThan(0)
  for (const image of dimensions) {
    expect(image.width).toBeGreaterThan(0)
    expect(image.height).toBeGreaterThan(0)
  }
})
