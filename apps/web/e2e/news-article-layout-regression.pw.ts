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

async function loadScenicHero(page: Page) {
  const hero = page.getByTestId('news-article-hero')
  const image = hero.locator('img')
  await hero.scrollIntoViewIfNeeded()
  await expect(image).toBeVisible()
  await image.evaluate((element: HTMLImageElement) => element.decode())
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
}

test('News article matches the desktop editorial layout', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop News article composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/news/__layout-preview')

  const article = page.getByTestId('news-article')
  const hero = page.getByTestId('news-article-hero')
  const metadata = article.locator('header').locator('dl')
  const back = article.getByRole('link', { name: 'All News', exact: true })
  const manual = article.getByRole('link', { name: 'Manual' })
  const rules = article.getByRole('link', { name: 'Rules' })

  await expect(article).toBeVisible()
  await expect(article).toHaveAttribute('data-news-article-surface', 'ink')
  await expect(hero).toBeVisible()
  await expect(hero).not.toContainText('Same world. Brighter tomorrows.')
  await expect(
    page.getByRole('heading', { level: 1, name: 'News Article Layout Preview' }),
  ).toBeVisible()
  await expect(article.locator('header').getByText('Layout preview', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Published', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Last updated', { exact: true })).toBeVisible()
  await expect(metadata.getByText('Sep 16, 2026', { exact: true })).toHaveCount(2)
  await expect(back).toBeVisible()
  await expect(manual).toBeVisible()
  await expect(rules).toBeVisible()
  await loadScenicHero(page)
  await settle(page)

  const metrics = await page.evaluate(() => {
    const articleElement = document.querySelector<HTMLElement>('[data-testid="news-article"]')!
    const heroElement = document.querySelector<HTMLElement>('[data-testid="news-article-hero"]')!
    const bodyElement = document.querySelector<HTMLElement>('[data-testid="news-article-body"]')!
    const articleBox = articleElement.getBoundingClientRect()
    const heroBox = heroElement.getBoundingClientRect()
    const bodyBox = bodyElement.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      articleLeft: articleBox.left,
      articleRight: articleBox.right,
      heroBottom: heroBox.bottom,
      bodyTop: bodyBox.top,
      bodyWidth: bodyBox.width,
      bodyOverflowY: getComputedStyle(bodyElement).overflowY,
    }
  })

  expect
    .soft(metrics.overflow, 'desktop News article has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect
    .soft(metrics.articleLeft, 'article keeps breathing room at the left edge')
    .toBeGreaterThan(8)
  expect
    .soft(metrics.articleRight, 'article keeps breathing room at the right edge')
    .toBeLessThan(1358)
  expect
    .soft(metrics.bodyTop, 'reading body follows the scenic editorial hero')
    .toBeGreaterThan(metrics.heroBottom - 1)
  expect
    .soft(metrics.bodyWidth, 'desktop prose stays comfortably readable')
    .toBeLessThanOrEqual(960)
  expect(['auto', 'scroll']).not.toContain(metrics.bodyOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'news-article-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('News article scrolls naturally on mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone News article composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/news/__layout-preview')

  const article = page.getByTestId('news-article')
  const body = page.getByTestId('news-article-body')
  const manual = article.getByRole('link', { name: 'Manual' })
  const rules = article.getByRole('link', { name: 'Rules' })

  await expect(article).toBeVisible()
  await loadScenicHero(page)
  await body.scrollIntoViewIfNeeded()
  await expect(body).toBeVisible()
  await manual.scrollIntoViewIfNeeded()
  await expect(manual).toBeInViewport({ ratio: 0.95 })
  await expect(rules).toBeVisible()
  await settle(page)

  const metrics = await page.evaluate(() => {
    const articleElement = document.querySelector<HTMLElement>('[data-testid="news-article"]')!
    const bodyElement = document.querySelector<HTMLElement>('[data-testid="news-article-body"]')!
    const articleBox = articleElement.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      articleWidth: articleBox.width,
      bodyOverflowY: getComputedStyle(bodyElement).overflowY,
    }
  })

  expect
    .soft(metrics.overflow, 'phone News article has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect
    .soft(metrics.pageScroll, 'phone News article scrolls naturally as a page')
    .toBeGreaterThan(0)
  expect
    .soft(metrics.articleWidth, 'article respects phone viewport width')
    .toBeLessThanOrEqual(390)
  expect(['auto', 'scroll']).not.toContain(metrics.bodyOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'news-article-mobile-390x844.png'),
      fullPage: true,
    })
  }
})

test('unpublished News slugs still return the not-found surface', async ({ page }) => {
  const response = await page.goto('/news/definitely-not-published')
  expect(response?.status()).toBe(404)
})
