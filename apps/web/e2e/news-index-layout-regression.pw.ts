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

test('News index uses the approved dark archive composition on desktop', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop News composition only')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/news')

  const board = page.getByTestId('news-index-board')
  const emptyState = page.getByTestId('news-empty-state')
  const manual = emptyState.getByRole('link', { name: 'Open the Manual' })
  const rules = emptyState.getByRole('link', { name: 'Read the Rules' })

  await expect(board).toBeVisible()
  await expect(board).toHaveAttribute('data-news-surface', 'ink')
  await expect(emptyState).toContainText('No public posts yet')
  await expect(emptyState).toContainText('No synthetic archive')
  await expect(manual).toBeVisible()
  await expect(rules).toBeVisible()
  await settle(page)

  const metrics = await page.evaluate(() => {
    const boardElement = document.querySelector<HTMLElement>('[data-testid="news-index-board"]')!
    const emptyElement = document.querySelector<HTMLElement>('[data-testid="news-empty-state"]')!
    const boardBox = boardElement.getBoundingClientRect()
    const emptyBox = emptyElement.getBoundingClientRect()
    return {
      viewportWidth: innerWidth,
      overflow: document.documentElement.scrollWidth - innerWidth,
      boardWidth: boardBox.width,
      boardHeight: boardBox.height,
      boardTop: boardBox.top,
      boardBottom: boardBox.bottom,
      emptyTop: emptyBox.top,
      emptyBottom: emptyBox.bottom,
    }
  })

  expect.soft(metrics.overflow, 'desktop News has no horizontal overflow').toBeLessThanOrEqual(1)
  expect
    .soft(metrics.boardWidth, 'News archive board occupies the primary canvas')
    .toBeGreaterThanOrEqual(metrics.viewportWidth * 0.9)
  expect
    .soft(metrics.boardHeight, 'News archive board has deliberate full-page presence')
    .toBeGreaterThanOrEqual(520)
  expect
    .soft(metrics.emptyTop, 'empty state sits below the scenic News header')
    .toBeGreaterThan(metrics.boardTop + 140)
  expect
    .soft(metrics.emptyBottom, 'empty state remains inside the archive board')
    .toBeLessThan(metrics.boardBottom - 24)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'news-index-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('News index keeps the empty-state actions reachable on mobile without an internal scroll trap', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone News composition only')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/news')

  const board = page.getByTestId('news-index-board')
  const emptyState = page.getByTestId('news-empty-state')
  const manual = emptyState.getByRole('link', { name: 'Open the Manual' })
  const rules = emptyState.getByRole('link', { name: 'Read the Rules' })

  await expect(board).toBeVisible()
  await expect(board).toHaveAttribute('data-news-surface', 'ink')
  await emptyState.scrollIntoViewIfNeeded()
  await expect(emptyState).toBeVisible()
  await expect(manual).toBeVisible()
  await expect(rules).toBeVisible()
  await settle(page)

  const metrics = await page.evaluate(() => {
    const boardElement = document.querySelector<HTMLElement>('[data-testid="news-index-board"]')!
    const links = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="news-empty-state"] a'),
    )
    const manualBox = links[0]!.getBoundingClientRect()
    const rulesBox = links[1]!.getBoundingClientRect()
    return {
      overflow: document.documentElement.scrollWidth - innerWidth,
      boardOverflowY: getComputedStyle(boardElement).overflowY,
      manualHeight: manualBox.height,
      rulesHeight: rulesBox.height,
      manualTop: manualBox.top,
      rulesTop: rulesBox.top,
    }
  })

  expect.soft(metrics.overflow, 'phone News has no horizontal overflow').toBeLessThanOrEqual(1)
  expect(['auto', 'scroll']).not.toContain(metrics.boardOverflowY)
  expect.soft(metrics.manualHeight, 'Manual action remains touch-sized').toBeGreaterThanOrEqual(40)
  expect.soft(metrics.rulesHeight, 'Rules action remains touch-sized').toBeGreaterThanOrEqual(40)
  expect
    .soft(metrics.rulesTop, 'phone empty-state actions stack instead of squeezing side by side')
    .toBeGreaterThan(metrics.manualTop + 12)

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'news-index-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
