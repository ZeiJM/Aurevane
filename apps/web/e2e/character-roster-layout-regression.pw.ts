import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Character Select keeps its heading above three readable, reachable roster cards', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host))
    throw new Error('Character roster review requires disposable local Supabase.')

  const suffix = `${Date.now()}${info.workerIndex}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const characterName = `Aurelia ${suffix}`
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await provisionAccountAndEnterCharacter({
    page,
    email: `roster-layout-${info.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-roster-layout-2026!',
    characterName,
  })
  await page.goto('/game')
  const board = page.locator('[data-character-slot-board]')
  const cards = board.locator(':scope > article')
  await expect(cards).toHaveCount(3)
  await expect(board.locator('[data-locked="true"]')).toHaveCount(2)
  const selectedCard = board.locator('article[data-selected="true"]')
  await expect(selectedCard).toHaveCount(1)
  expect
    .soft(await selectedCard.evaluate((node) => getComputedStyle(node).animationName), 'selected character has a calm living glow')
    .not.toBe('none')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect
    .soft(await selectedCard.evaluate((node) => getComputedStyle(node).animationName), 'reduced motion disables selected-character glow')
    .toBe('none')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const play = board.getByRole('link', { name: `Play ${characterName}`, exact: true })
  await expect(play).toHaveAttribute('href', /\/game\/select\/[0-9a-f-]+$/)
  await expect(board.getByRole('button', { name: 'Delete Character', exact: true })).toBeVisible()
  await expect(page.getByTestId('delete-account-button')).toHaveText('Delete Account')

  const sizes =
    info.project.name === 'mobile-chromium'
      ? [
          { width: 390, height: 844 },
          { width: 320, height: 740 },
        ]
      : info.project.name === 'laptop-chromium'
        ? [{ width: 1366, height: 768 }]
        : [
            { width: 1728, height: 887 },
            { width: 1440, height: 900 },
            { width: 1024, height: 576 },
            { width: 980, height: 768 },
            { width: 768, height: 576 },
          ]
  const results = []
  for (const size of sizes) {
    await page.setViewportSize(size)
    await page.evaluate(async () => {
      await document.fonts.ready
      scrollTo(0, 0)
    })
    const portrait = cards.first().locator('img').first()
    await expect(portrait).toBeVisible()
    await expect
      .poll(() =>
        portrait.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true)
    const metrics = await board.evaluate((node) => {
      const rect = (element: Element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom }
      }
      const first = node.querySelector('article')!
      const hero = document.querySelector('[data-roster-stage] > header')!
      const accountDelete = document.querySelector('[data-testid="delete-account-button"]')!
      const locked = node.querySelector('[data-locked="true"]')!
      return {
        board: rect(node),
        hero: rect(hero),
        portrait: rect(first.querySelector('img')!),
        name: rect(first.querySelector('h2')!),
        play: rect(first.querySelector('a')!),
        accountDelete: rect(accountDelete),
        lockedBackground: getComputedStyle(locked).backgroundColor,
        nameFont: parseFloat(getComputedStyle(first.querySelector('h2')!).fontSize),
        buttonFont: parseFloat(getComputedStyle(first.querySelector('a')!).fontSize),
        documentOverflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    results.push({ viewport: size, ...metrics })
    const label = `${info.project.name}-${size.width}x${size.height}`
    if (process.env.LAYOUT_REVIEW_OUTPUT) {
      await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
      await page.screenshot({
        path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, `character-roster-${label}.png`),
        fullPage: true,
      })
      await page.screenshot({
        path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, `character-roster-${label}-viewport.png`),
      })
    }
    expect
      .soft(metrics.hero.bottom, `${label}: heading is above the board`)
      .toBeLessThanOrEqual(metrics.board.y + 1)
    expect.soft(metrics.documentOverflow, `${label}: no horizontal overflow`).toBeLessThanOrEqual(1)
    expect
      .soft(metrics.portrait.width / metrics.portrait.height, `${label}: square portrait`)
      .toBeCloseTo(1, 2)
    expect.soft(metrics.nameFont, `${label}: readable name`).toBeGreaterThanOrEqual(16)
    expect.soft(metrics.buttonFont, `${label}: readable primary action`).toBeGreaterThanOrEqual(14)
    expect.soft(metrics.play.height, `${label}: usable primary action`).toBeGreaterThanOrEqual(40)
    expect
      .soft(metrics.accountDelete.y, `${label}: account management follows the roster`)
      .toBeGreaterThanOrEqual(metrics.board.bottom - 1)
    expect
      .soft(
        Math.max(...(metrics.lockedBackground.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)),
        `${label}: dark locked cards`,
      )
      .toBeLessThan(75)
    if (size.width >= 1280 && size.height >= 768) {
      expect
        .soft(metrics.play.bottom, `${label}: play fits at normal zoom`)
        .toBeLessThanOrEqual(size.height)
    }
    await play.scrollIntoViewIfNeeded()
    await expect(play).toBeInViewport({ ratio: 1 })
    await play.click({ trial: true })
    const accountDelete = page.getByTestId('delete-account-button')
    await accountDelete.scrollIntoViewIfNeeded()
    await expect(accountDelete).toBeInViewport({ ratio: 1 })
    await accountDelete.click({ trial: true })
  }
  if (process.env.LAYOUT_REVIEW_OUTPUT)
    await writeFile(
      path.join(process.env.LAYOUT_REVIEW_OUTPUT, `character-roster-${info.project.name}.json`),
      JSON.stringify(results, null, 2),
    )
  // Exercise the real footer sign-out, not a mocked navigation.
  await page.getByRole('button', { name: 'Switch account', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await page.goto('/game')
  await expect(page).toHaveURL(/\/$/)
  expect(pageErrors).toEqual([])
})
