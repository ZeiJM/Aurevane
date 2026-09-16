import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { COMBAT_KEYBIND_ACTIONS } from '@aurevane/validation/player/combat-controls'
import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}

function maxRgbChannel(value: string) {
  return Math.max(...(value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))
}

test('Controls keeps all bindings reachable inside a dark desktop workspace', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop Controls composition only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `controls-layout-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Control Wayfarer',
  })
  await page.goto('/game/settings/controls')

  const concept = page.locator('[data-character-concept="controls"]')
  const heading = page.getByRole('heading', { name: 'Controls & Keybinds' })
  const outerSurface = heading.locator('xpath=ancestor::*[@data-av-surface][1]')
  const rows = page.locator('[data-testid^="keybind-"]')
  const list = page.getByTestId('keybind-inspect').locator('..')
  const reset = page.getByRole('button', { name: 'Reset defaults' })
  const save = page.getByRole('button', { name: 'Save Controls' })

  await expect(concept).toBeVisible()
  await expect(heading).toBeVisible()
  await expect(rows).toHaveCount(COMBAT_KEYBIND_ACTIONS.length)
  await expect(reset).toBeVisible()
  await expect(save).toBeVisible()
  await settle(page)

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-character-concept="controls"]')!
    const outer = root.closest('[data-av-surface]') as HTMLElement
    const grid = document.querySelector('[data-testid="keybind-inspect"]')!.parentElement!
    const actions = Array.from(root.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Reset defaults'))!
      .parentElement!
    const footer = document
      .querySelector('[data-testid="authenticated-shell"] > footer')!
      .getBoundingClientRect()
    const gridBox = grid.getBoundingClientRect()
    const actionsBox = actions.getBoundingClientRect()
    return {
      surface: root.dataset.avSurface ?? null,
      outerSurface: outer.dataset.avSurface ?? null,
      background: getComputedStyle(root).backgroundColor,
      outerBackground: getComputedStyle(outer).backgroundColor,
      headingColor: getComputedStyle(root.closest('[data-av-surface]')!.querySelector('h1')!).color,
      gridOverflowY: getComputedStyle(grid).overflowY,
      gridClientHeight: grid.clientHeight,
      gridScrollHeight: grid.scrollHeight,
      gridBottom: gridBox.bottom,
      actionsTop: actionsBox.top,
      actionsBottom: actionsBox.bottom,
      footerTop: footer.top,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'desktop has no horizontal overflow').toBeLessThanOrEqual(1)
  expect.soft(metrics.surface, 'Controls uses the dark surface token contract').toBe('ink')
  expect.soft(metrics.outerSurface, 'outer Controls workspace uses the dark surface').toBe('ink')
  expect.soft(maxRgbChannel(metrics.background), 'Controls panel stays dark').toBeLessThan(90)
  expect.soft(maxRgbChannel(metrics.outerBackground), 'outer workspace stays dark').toBeLessThan(90)
  expect.soft(maxRgbChannel(metrics.headingColor), 'Controls heading remains readable').toBeGreaterThanOrEqual(160)
  expect.soft(['auto', 'scroll']).toContain(metrics.gridOverflowY)
  expect
    .soft(metrics.gridScrollHeight - metrics.gridClientHeight, 'desktop binding library scrolls internally')
    .toBeGreaterThan(24)
  expect.soft(metrics.gridBottom, 'binding library ends before actions').toBeLessThanOrEqual(metrics.actionsTop + 1)
  expect.soft(metrics.actionsBottom, 'Controls actions stay above footer').toBeLessThanOrEqual(metrics.footerTop + 1)

  const lastBinding = page.getByTestId('keybind-combatLog')
  await lastBinding.scrollIntoViewIfNeeded()
  await expect(lastBinding).toBeInViewport({ ratio: 1 })
  expect.soft(await list.evaluate((element) => element.scrollTop), 'last binding uses list scroll').toBeGreaterThan(0)

  const inspectChange = page.getByRole('button', { name: 'Change Inspect keybind' })
  await inspectChange.scrollIntoViewIfNeeded()
  await inspectChange.click()
  await page.keyboard.press('q')
  await expect(page.getByTestId('keybind-inspect').locator('kbd')).toHaveText('Q')
  await expect(save).toBeEnabled()
  await save.click({ trial: true })
  await reset.click({ trial: true })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'controls-desktop-1366x768.png'),
      fullPage: true,
    })
  }
})

test('Controls stays a natural single-column scroll on phone', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Phone Controls composition only')
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `controls-mobile-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Mobile Control Wayfarer',
  })
  await page.goto('/game/settings/controls')

  const concept = page.locator('[data-character-concept="controls"]')
  const heading = page.getByRole('heading', { name: 'Controls & Keybinds' })
  const outerSurface = heading.locator('xpath=ancestor::*[@data-av-surface][1]')
  const rows = page.locator('[data-testid^="keybind-"]')
  const list = page.getByTestId('keybind-inspect').locator('..')
  await expect(concept).toBeVisible()
  await expect(rows).toHaveCount(COMBAT_KEYBIND_ACTIONS.length)
  await settle(page)

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-character-concept="controls"]')!
    const outer = root.closest('[data-av-surface]') as HTMLElement
    const grid = document.querySelector('[data-testid="keybind-inspect"]')!.parentElement!
    return {
      surface: root.dataset.avSurface ?? null,
      outerSurface: outer.dataset.avSurface ?? null,
      background: getComputedStyle(root).backgroundColor,
      outerBackground: getComputedStyle(outer).backgroundColor,
      gridOverflowY: getComputedStyle(grid).overflowY,
      gridClientHeight: grid.clientHeight,
      gridScrollHeight: grid.scrollHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'phone has no horizontal overflow').toBeLessThanOrEqual(1)
  expect.soft(metrics.surface, 'phone Controls uses the dark surface token contract').toBe('ink')
  expect.soft(metrics.outerSurface, 'phone outer workspace uses the dark surface').toBe('ink')
  expect.soft(maxRgbChannel(metrics.background), 'phone Controls panel stays dark').toBeLessThan(90)
  expect.soft(maxRgbChannel(metrics.outerBackground), 'phone outer workspace stays dark').toBeLessThan(90)
  expect.soft(metrics.gridOverflowY, 'phone binding list uses natural page scroll').not.toBe('auto')
  expect
    .soft(metrics.gridScrollHeight - metrics.gridClientHeight, 'phone does not trap bindings internally')
    .toBeLessThanOrEqual(1)

  const lastBinding = page.getByTestId('keybind-combatLog')
  await lastBinding.scrollIntoViewIfNeeded()
  await expect(lastBinding).toBeInViewport({ ratio: 1 })
  expect.soft(await list.evaluate((element) => element.scrollTop), 'phone list itself does not scroll').toBe(0)

  const reset = page.getByRole('button', { name: 'Reset defaults' })
  const save = page.getByRole('button', { name: 'Save Controls' })
  await reset.scrollIntoViewIfNeeded()
  await expect(reset).toBeInViewport({ ratio: 1 })
  await reset.click({ trial: true })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport({ ratio: 1 })
  await save.click({ trial: true })

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'controls-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
