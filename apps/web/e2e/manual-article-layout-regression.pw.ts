import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

async function expectDecodedImage(page: Page, testId: string) {
  const image = page.getByTestId(testId).locator('img')
  await expect(image).toBeVisible()
  await expect
    .poll(() =>
      image.evaluate((node) => {
        const element = node as HTMLImageElement
        return element.complete && element.naturalWidth > 0
      }),
    )
    .toBe(true)
}

test('standard Manual article uses the dark desktop reading frame', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Manual article composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/manual/character-creation')

  const article = page.getByTestId('manual-article')
  const toc = page.getByTestId('manual-article-toc')
  const body = page.getByTestId('manual-article-body')

  await expect(article).toBeVisible()
  await expect(article).toHaveAttribute('data-manual-article-surface', 'ink')
  await expect(page.getByRole('navigation', { name: 'Manual breadcrumb' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Character Creation' })).toBeVisible()
  await expect(toc).toBeVisible()
  await expectDecodedImage(page, 'manual-article-hero-media')

  const tocBox = await toc.boundingBox()
  const bodyBox = await body.boundingBox()
  expect(tocBox).not.toBeNull()
  expect(bodyBox).not.toBeNull()
  expect(tocBox!.x + tocBox!.width).toBeLessThan(bodyBox!.x)

  await toc.getByRole('link', { name: 'Identity choices', exact: true }).click()
  await expect(page).toHaveURL(/#identity$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Identity choices' })).toBeVisible()

  const metrics = await page.evaluate(() => {
    const tocElement = document.querySelector<HTMLElement>('[data-testid="manual-article-toc"]')!
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      tocOverflowY: getComputedStyle(tocElement).overflowY,
    }
  })
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(['auto', 'scroll']).not.toContain(metrics.tocOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'manual-article-desktop-1366x768.png'),
    })
  }
})

test('standard Manual article preserves anchors on mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Manual article composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/manual/wayfarers-practice#guardrails')

  const article = page.getByTestId('manual-article')
  const toc = page.getByTestId('manual-article-toc')
  const body = page.getByTestId('manual-article-body')

  await expect(article).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 2, name: 'What Passive Training cannot do' }),
  ).toBeVisible()
  await expectDecodedImage(page, 'manual-article-hero-media')

  await page.evaluate(() => window.scrollTo(0, 0))
  await settle(page)
  const tocBox = await toc.boundingBox()
  const bodyBox = await body.boundingBox()
  expect(tocBox).not.toBeNull()
  expect(bodyBox).not.toBeNull()
  expect(tocBox!.y + tocBox!.height).toBeLessThan(bodyBox!.y)

  const metrics = await page.evaluate(() => {
    const articleElement = document.querySelector<HTMLElement>('[data-testid="manual-article"]')!
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      articleOverflowY: getComputedStyle(articleElement).overflowY,
    }
  })
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.pageScroll).toBeGreaterThan(0)
  expect(['auto', 'scroll']).not.toContain(metrics.articleOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'manual-article-mobile-390x844.png'),
    })
  }
})

test('Atlas keeps real content in the Manual article frame', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Atlas composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/manual/disciplines-mastery')

  const article = page.getByTestId('manual-atlas-article')
  const toc = page.getByTestId('manual-atlas-toc')
  const content = page.getByTestId('manual-atlas-content')

  await expect(article).toBeVisible()
  await expect(article).toHaveAttribute('data-manual-article-surface', 'ink')
  await expect(page.getByRole('heading', { level: 1, name: 'The Discipline Atlas' })).toBeVisible()
  await expect(page.getByText('36 planned traditions')).toBeVisible()
  await expect(page.getByText('Phase-4 testing rule')).toBeVisible()
  await expectDecodedImage(page, 'manual-atlas-hero-media')

  const tocBox = await toc.boundingBox()
  const contentBox = await content.boundingBox()
  expect(tocBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(tocBox!.x + tocBox!.width).toBeLessThan(contentBox!.x)

  await toc.getByRole('link', { name: 'Mastery', exact: true }).click()
  await expect(page).toHaveURL(/#mastery$/)
  await expect(
    page.getByRole('heading', { level: 2, name: /Experience is necessary/ }),
  ).toBeVisible()

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - innerWidth,
    pageScroll: document.documentElement.scrollHeight - innerHeight,
  }))
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.pageScroll).toBeGreaterThan(0)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'manual-atlas-desktop-1366x768.png'),
    })
  }
})

test('Atlas stacks its contents rail on mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Atlas composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/manual/disciplines-mastery')

  const toc = page.getByTestId('manual-atlas-toc')
  const content = page.getByTestId('manual-atlas-content')

  await expect(page.getByTestId('manual-atlas-article')).toBeVisible()
  await expectDecodedImage(page, 'manual-atlas-hero-media')

  const tocBox = await toc.boundingBox()
  const contentBox = await content.boundingBox()
  expect(tocBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(tocBox!.y + tocBox!.height).toBeLessThan(contentBox!.y)

  const metrics = await page.evaluate(() => {
    const articleElement = document.querySelector<HTMLElement>('[data-testid="manual-atlas-article"]')!
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      articleOverflowY: getComputedStyle(articleElement).overflowY,
    }
  })
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.pageScroll).toBeGreaterThan(0)
  expect(['auto', 'scroll']).not.toContain(metrics.articleOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'manual-atlas-mobile-390x844.png'),
    })
  }
})

test('unknown Manual article slugs still return the not-found surface', async ({ page }) => {
  const response = await page.goto('/manual/not-a-real-guide')
  expect(response?.status()).toBe(404)
})
