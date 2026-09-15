import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function enterHall(page: Page, testInfo: TestInfo, suffix: string) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error('Hall review requires disposable local Supabase.')
  }
  const mobile = testInfo.project.name === 'mobile-chromium'
  await page.setViewportSize({
    width: mobile ? 390 : testInfo.project.name === 'laptop-chromium' ? 1366 : 1728,
    height: mobile ? 844 : testInfo.project.name === 'laptop-chromium' ? 768 : 887,
  })
  await provisionAccountAndEnterCharacter({
    page,
    email: `hall-${suffix}-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-hall-review-2026!',
    characterName: suffix === 'lobby' ? 'Mira Vale' : 'Eira Vale',
  })
  await page.goto('/game/battle')
  await expect(page.getByRole('heading', { name: 'Battle Hall', exact: true })).toBeVisible()
  return mobile
}

async function capture(page: Page, testInfo: TestInfo, state: string) {
  const output = process.env.LAYOUT_REVIEW_OUTPUT
  if (!output) return
  await mkdir(output, { recursive: true })
  await page.screenshot({
    path: path.join(output, `hall-${state}-${testInfo.project.name}.png`),
    fullPage: true,
  })
}

test('Battle Hall presents three real workspaces with usable AI, join and spectator controls', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const mobile = await enterHall(page, testInfo, 'hall')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await capture(page, testInfo, 'idle')
  await expect(page.locator('[data-hall-workspace]')).toHaveCount(3)
  const panels = page.locator('[data-hall-workspace]')
  if (!mobile) {
    const rects = await panels.evaluateAll((items) =>
      items.map((item) => {
        const r = item.getBoundingClientRect()
        return { x: r.x, y: r.y, right: r.right, width: r.width }
      }),
    )
    expect(rects[0].width).toBeGreaterThan(280)
    expect(rects[1].x).toBeGreaterThanOrEqual(rects[0].right)
    expect(rects[2].x).toBeGreaterThanOrEqual(rects[1].right)
    expect(Math.abs(rects[0].y - rects[2].y)).toBeLessThan(2)
  }
  const background = await panels.first().evaluate((node) => getComputedStyle(node).backgroundColor)
  const rgb = (background.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  expect(Math.max(...rgb)).toBeLessThan(65)
  await expect(page.getByLabel('Battle mode')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Enter Battle', exact: true })).toHaveCount(0)
  for (const mode of ['recruit-sparring', 'guided-fundamentals', 'mastery-trial']) {
    await page.getByLabel('Battle mode').selectOption(mode)
    await expect(page.getByRole('button', { name: 'Enter Battle', exact: true })).toBeEnabled()
    if (mode === 'mastery-trial') {
      await expect(page.getByRole('button', { name: 'Easy', exact: true })).toHaveCount(0)
    }
    await capture(page, testInfo, mode)
  }
  const navigation = page.getByRole('navigation', { name: 'Battle Hall sections', exact: true })
  await navigation.getByRole('button', { name: /Player vs Player/ }).click()
  await page.locator('#pvp-mode').selectOption('flex-teams')
  await expect(page.locator('[data-pvp-team-sizes] select')).toHaveCount(2)
  await page.locator('#lobby-key').fill('avlabcd1234')
  await expect(page.locator('#lobby-key')).toHaveValue('AVL-ABCD-1234')
  await expect(page.getByRole('button', { name: 'Join Battle Lobby', exact: true })).toBeEnabled()
  await page.locator('#lobby-key').clear()
  await expect(page.getByRole('button', { name: 'Join Battle Lobby', exact: true })).toBeDisabled()
  await capture(page, testInfo, 'pvp')
  await navigation.getByRole('button', { name: /^Spectate/ }).click()
  await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Battle Key', exact: true }).fill('avb-abcd-1234')
  await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeEnabled()
  await expect(page.getByText('Featured Matches', { exact: true })).toHaveCount(0)
  await capture(page, testInfo, 'spectate')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  if (mobile) {
    for (const width of [320, 375, 760]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(page.getByRole('button', { name: 'Spectate Battle', exact: true })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    }
  }
  expect(errors).toEqual([])
})

test('real multi-seat lobby remains a keyboard-contained dialog with square portraits and readable settings', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  await enterHall(page, testInfo, 'lobby')
  await page.getByRole('navigation', { name: 'Battle Hall sections' }).getByRole('button', { name: /Player vs Player/ }).click()
  await page.locator('#pvp-mode').selectOption('3v3')
  await page.getByRole('button', { name: '120 second turn timer', exact: true }).click()
  const created = page.waitForResponse((response) => response.url().endsWith('/api/pvp/lobbies') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create Battle Lobby', exact: true }).click()
  expect((await created).ok()).toBe(true)
  const dialog = page.getByRole('dialog', { name: 'The arena is waiting.' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('120 seconds', { exact: true })).toBeVisible()
  await capture(page, testInfo, 'lobby')
  const metrics = await dialog.evaluate((element) => {
    const portrait = element.querySelector('img')!.getBoundingClientRect()
    const settings = element.querySelector('[aria-label="Locked PvP battle settings"]')!
    return {
      portraitRatio: portrait.width / portrait.height,
      labelSizes: [...settings.querySelectorAll('span')].map((node) => parseFloat(getComputedStyle(node).fontSize)),
      valueSizes: [...settings.querySelectorAll('strong')].map((node) => parseFloat(getComputedStyle(node).fontSize)),
      overflow: element.scrollWidth - element.clientWidth,
      focusInside: element.contains(document.activeElement),
    }
  })
  expect.soft(metrics.portraitRatio).toBeCloseTo(1, 2)
  expect.soft(Math.min(...metrics.labelSizes)).toBeGreaterThanOrEqual(12)
  expect.soft(Math.min(...metrics.valueSizes)).toBeGreaterThanOrEqual(13)
  expect.soft(metrics.overflow).toBeLessThanOrEqual(1)
  expect.soft(metrics.focusInside).toBe(true)
  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press('Tab')
    expect.soft(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true)
  }
  await page.reload()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('120 seconds', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close Lobby', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create Battle Lobby', exact: true })).toBeEnabled()
})
