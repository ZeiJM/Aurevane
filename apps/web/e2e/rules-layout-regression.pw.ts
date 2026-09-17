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

test('Rules uses the dark desktop codex composition with real sections', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Rules composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/rules')

  const rules = page.getByTestId('rules-page')
  const nav = page.getByTestId('rules-section-nav')
  const content = page.getByTestId('rules-content')
  const sections = page.getByTestId('rules-section')

  await expect(rules).toBeVisible()
  await expect(rules).toHaveAttribute('data-rules-surface', 'ink')
  await expect(page.getByRole('heading', { level: 1, name: 'Rules' })).toBeVisible()
  await expect(page.getByText('1.0', { exact: true })).toBeVisible()
  await expect(page.getByText('Phase 1 public foundation', { exact: true })).toBeVisible()
  await expect(nav).toBeVisible()
  await expect(sections).toHaveCount(5)
  await expectDecodedImage(page, 'rules-hero-media')

  const navBox = await nav.boundingBox()
  const contentBox = await content.boundingBox()
  expect(navBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(navBox!.x + navBox!.width).toBeLessThan(contentBox!.x)

  const metrics = await page.evaluate(() => {
    const navElement = document.querySelector<HTMLElement>('[data-testid="rules-section-nav"]')!
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      navOverflowY: getComputedStyle(navElement).overflowY,
    }
  })
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(['auto', 'scroll']).not.toContain(metrics.navOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'rules-desktop-1366x768.png'),
    })
  }

  await nav.getByRole('link', { name: 'Current Rule Scope', exact: true }).click()
  await expect(page).toHaveURL(/#current-scope$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Current Rule Scope' })).toBeVisible()
})

test('Rules stacks navigation above the real rule document on mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Rules composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/rules')

  const rules = page.getByTestId('rules-page')
  const nav = page.getByTestId('rules-section-nav')
  const content = page.getByTestId('rules-content')
  const sections = page.getByTestId('rules-section')

  await expect(rules).toBeVisible()
  await expect(nav).toBeVisible()
  await expect(sections).toHaveCount(5)
  await expectDecodedImage(page, 'rules-hero-media')

  const navBox = await nav.boundingBox()
  const contentBox = await content.boundingBox()
  expect(navBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(navBox!.y + navBox!.height).toBeLessThan(contentBox!.y)

  await nav.getByRole('link', { name: 'Current Rule Scope', exact: true }).click()
  await expect(page).toHaveURL(/#current-scope$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Current Rule Scope' })).toBeVisible()

  const metrics = await page.evaluate(() => {
    const rulesElement = document.querySelector<HTMLElement>('[data-testid="rules-page"]')!
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      rulesOverflowY: getComputedStyle(rulesElement).overflowY,
    }
  })
  expect(metrics.overflow).toBeLessThanOrEqual(1)
  expect(metrics.pageScroll).toBeGreaterThan(0)
  expect(['auto', 'scroll']).not.toContain(metrics.rulesOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'rules-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
