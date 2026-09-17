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

test('Manual index is a searchable dark guide directory on desktop', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Manual directory composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/manual')

  const directory = page.getByTestId('manual-index-directory')
  const search = page.getByRole('searchbox', { name: 'Search the Manual' })
  const rows = page.getByTestId('manual-guide-row')

  await expect(directory).toBeVisible()
  await expect(directory).toHaveAttribute('data-manual-index-surface', 'ink')
  await expect(page.getByRole('heading', { level: 1, name: 'Manual' })).toBeVisible()
  await expect(search).toBeVisible()
  await expect(rows).toHaveCount(10)

  await search.fill('Battle Hall')
  await expect(rows).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Battle Hall & Action Economy/ })).toBeVisible()

  await search.clear()
  await expect(rows).toHaveCount(10)
  await settle(page)

  const metrics = await page.evaluate(() => {
    const directoryElement = document.querySelector<HTMLElement>(
      '[data-testid="manual-index-directory"]',
    )!
    const directoryBox = directoryElement.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      directoryLeft: directoryBox.left,
      directoryRight: directoryBox.right,
      directoryOverflowY: getComputedStyle(directoryElement).overflowY,
    }
  })

  expect
    .soft(metrics.overflow, 'desktop Manual index has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect.soft(metrics.directoryLeft, 'directory keeps left breathing room').toBeGreaterThan(8)
  expect.soft(metrics.directoryRight, 'directory keeps right breathing room').toBeLessThan(1358)
  expect(['auto', 'scroll']).not.toContain(metrics.directoryOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'manual-index-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('Manual index stays a natural single-column guide on mobile', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Manual directory composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/manual')

  const directory = page.getByTestId('manual-index-directory')
  const search = page.getByRole('searchbox', { name: 'Search the Manual' })
  const rows = page.getByTestId('manual-guide-row')

  await expect(directory).toBeVisible()
  await expect(search).toBeVisible()
  await expect(rows).toHaveCount(10)

  await search.fill('Glossary')
  await expect(rows).toHaveCount(1)
  await expect(page.getByRole('link', { name: /Glossary/ })).toBeVisible()
  await search.clear()
  await expect(rows).toHaveCount(10)

  await rows.last().scrollIntoViewIfNeeded()
  await expect(rows.last()).toBeInViewport({ ratio: 0.8 })
  await settle(page)

  const metrics = await page.evaluate(() => {
    const directoryElement = document.querySelector<HTMLElement>(
      '[data-testid="manual-index-directory"]',
    )!
    const directoryBox = directoryElement.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      pageScroll: document.documentElement.scrollHeight - innerHeight,
      directoryWidth: directoryBox.width,
      directoryOverflowY: getComputedStyle(directoryElement).overflowY,
    }
  })

  expect
    .soft(metrics.overflow, 'phone Manual index has no horizontal overflow')
    .toBeLessThanOrEqual(1)
  expect.soft(metrics.pageScroll, 'phone Manual index scrolls as a page').toBeGreaterThan(0)
  expect
    .soft(metrics.directoryWidth, 'directory respects phone viewport width')
    .toBeLessThanOrEqual(390)
  expect(['auto', 'scroll']).not.toContain(metrics.directoryOverflowY)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await settle(page)
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'manual-index-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
