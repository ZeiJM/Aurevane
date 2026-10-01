import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { COMBAT_KEYBIND_ACTIONS } from '@aurevane/validation/player/combat-controls'
import { expect, test, type Page, type TestInfo } from '@playwright/test'

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

async function expectDesktopControlsFit(page: Page, info: TestInfo, label: string) {
  await settle(page)
  // Measure the untouched viewport: scrolling a target into view could hide this regression.
  const metrics = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('#game-main')!
    const root = main.querySelector<HTMLElement>('[data-character-concept="controls"]')!
    const scene = root.closest<HTMLElement>('[data-settings-scene]')!
    const grid = root.querySelector('[data-testid="keybind-inspect"]')!.parentElement!
    const mainBox = main.getBoundingClientRect()
    const rootBox = root.getBoundingClientRect()
    const gridBox = grid.getBoundingClientRect()
    const footerBox = document
      .querySelector('[data-testid="authenticated-shell"] > footer')!
      .getBoundingClientRect()
    const details = Array.from(
      root.querySelectorAll<HTMLElement>('strong, small, kbd, button, p, button > span'),
    ).map((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      const ancestorsClipping = []
      for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const ancestorStyle = getComputedStyle(ancestor)
        const box = ancestor.getBoundingClientRect()
        if (
          (['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowY) &&
            (rect.top < box.top - 1 || rect.bottom > box.bottom + 1)) ||
          (['hidden', 'clip', 'auto', 'scroll'].includes(ancestorStyle.overflowX) &&
            (rect.left < box.left - 1 || rect.right > box.right + 1))
        )
          ancestorsClipping.push(ancestor.id || ancestor.className)
      }
      return {
        name: element.getAttribute('aria-label') || element.textContent?.trim(),
        visible: element.checkVisibility(),
        fontSize: Number.parseFloat(style.fontSize),
        height: rect.height,
        button: element.matches('button'),
        overflow: Math.max(
          element.scrollWidth - element.clientWidth,
          element.scrollHeight - element.clientHeight,
        ),
        clipped: ancestorsClipping,
        outside:
          rect.top < mainBox.top - 1 ||
          rect.bottom > footerBox.top + 1 ||
          rect.left < rootBox.left - 1 ||
          rect.right > rootBox.right + 1,
      }
    })
    const rows = Array.from(grid.children).map((element) => {
      const box = element.getBoundingClientRect()
      return {
        id: element.getAttribute('data-testid'),
        outside:
          box.top < gridBox.top - 1 ||
          box.bottom > gridBox.bottom + 1 ||
          box.left < gridBox.left - 1 ||
          box.right > gridBox.right + 1,
      }
    })
    const scrollContainers = Array.from(main.querySelectorAll<HTMLElement>('*'))
      .filter((element) => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))
      .map((element) => ({
        name: element.getAttribute('data-testid') || element.className,
        overflow: element.scrollHeight - element.clientHeight,
      }))
    return {
      viewport: { width: innerWidth, height: innerHeight },
      pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pageOverflowY: document.documentElement.scrollHeight - innerHeight,
      mainOverflowX: main.scrollWidth - main.clientWidth,
      mainOverflowY: main.scrollHeight - main.clientHeight,
      mainScrollTop: main.scrollTop,
      pageScrollTop: window.scrollY,
      gridScrollTop: grid.scrollTop,
      gridOverflowY: grid.scrollHeight - grid.clientHeight,
      sceneBottom: scene.getBoundingClientRect().bottom,
      footerTop: footerBox.top,
      surface: root.dataset.avSurface,
      background: getComputedStyle(root).backgroundImage,
      outerBackground: getComputedStyle(root.parentElement!).backgroundImage,
      headingColor: getComputedStyle(scene.querySelector('h1')!).color,
      gridColumns: getComputedStyle(grid).gridTemplateColumns,
      details,
      rows,
      scrollContainers,
    }
  })
  const screenshot = await page.screenshot({ fullPage: true })
  const json = JSON.stringify(metrics, null, 2)
  // Keep screenshots and measured geometry even when the very first fit assertion fails.
  await info.attach(label, { body: screenshot, contentType: 'image/png' })
  await info.attach(`${label}-geometry`, { body: json, contentType: 'application/json' })
  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await writeFile(path.join(process.env.LAYOUT_REVIEW_OUTPUT, `${label}.png`), screenshot)
    await writeFile(path.join(process.env.LAYOUT_REVIEW_OUTPUT, `${label}.json`), json)
  }

  for (const field of [
    'pageOverflowX',
    'pageOverflowY',
    'mainOverflowX',
    'mainOverflowY',
    'gridOverflowY',
  ] as const) {
    expect(metrics[field], `${label}: ${field}`).toBeLessThanOrEqual(1)
  }
  expect(metrics.mainScrollTop, `${label}: no main scrolling needed`).toBe(0)
  expect(metrics.pageScrollTop, `${label}: no document scrolling needed`).toBe(0)
  expect(metrics.gridScrollTop, `${label}: no binding scrolling needed`).toBe(0)
  expect(metrics.sceneBottom, `${label}: workspace ends above footer`).toBeLessThanOrEqual(
    metrics.footerTop + 1,
  )
  expect(
    metrics.scrollContainers.filter((container) => container.overflow > 1),
    `${label}: no inner scroller`,
  ).toEqual([])
  expect(metrics.rows).toHaveLength(COMBAT_KEYBIND_ACTIONS.length)
  expect(
    metrics.rows.filter((row) => row.outside),
    `${label}: all cards inside binding grid`,
  ).toEqual([])
  expect(
    metrics.details.filter(
      (detail) =>
        !detail.visible || detail.outside || detail.clipped.length > 0 || detail.overflow > 1,
    ),
    `${label}: no hidden or clipped text/controls`,
  ).toEqual([])
  expect(
    metrics.details.filter((detail) => detail.fontSize < 13),
    `${label}: readable text`,
  ).toEqual([])
  expect(
    metrics.details.filter((detail) => detail.button && detail.height < 44),
    `${label}: 44px buttons`,
  ).toEqual([])
  expect(metrics.surface).toBe('moonstone')
  expect(metrics.background).toContain('linear-gradient')
  expect(metrics.outerBackground).toContain('linear-gradient')
  expect(maxRgbChannel(metrics.headingColor)).toBeGreaterThan(200)
}

test('Controls shows every binding and account action without desktop scrolling through editing and feedback', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Explicit desktop Controls fit matrix')
  test.setTimeout(120_000)
  await provisionAccountAndEnterCharacter({
    page,
    email: `controls-layout-${Date.now()}@example.com`,
    password: 'AurevaneTest!42',
    characterName: 'Control Wayfarer',
  })
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1536, height: 614 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/game/settings/controls')
    await expect(page.locator('[data-character-concept="controls"]')).toBeVisible()
    await expect(page.locator('[data-testid^="keybind-"]')).toHaveCount(
      COMBAT_KEYBIND_ACTIONS.length,
    )
    const label = `controls-desktop-${viewport.width}x${viewport.height}`
    await expectDesktopControlsFit(page, info, `${label}-baseline`)

    const change = page.getByRole('button', { name: 'Change Inspect keybind' })
    const reset = page.getByRole('button', { name: 'Reset defaults' })
    const save = page.getByRole('button', { name: 'Save Controls' })
    await change.click()
    await expect(page.getByRole('status')).toContainText('Press the new key for Inspect')
    await expectDesktopControlsFit(page, info, `${label}-capturing`)
    await page.keyboard.press('q')
    await expect(page.getByTestId('keybind-inspect').locator('kbd')).toHaveText('Q')
    await expect(page.getByRole('status')).toContainText('Save to keep it on your account.')
    await expect(save).toBeEnabled()
    await expectDesktopControlsFit(page, info, `${label}-draft`)
    await save.click()
    await expect(page.getByRole('status')).toContainText('Combat controls saved to your account.')
    await expectDesktopControlsFit(page, info, `${label}-saved`)
    await page.reload()
    await expect(page.getByTestId('keybind-inspect').locator('kbd')).toHaveText('Q')
    await expect(save).toBeDisabled()

    await page.getByRole('button', { name: 'Change Move keybind' }).click()
    await page.keyboard.press('q')
    await expect(page.locator('#game-main').getByRole('alert')).toContainText(
      'already assigned to Inspect',
    )
    await expect(page.getByTestId('keybind-move').locator('kbd')).toHaveText('1')
    await expect(save).toBeDisabled()
    await expectDesktopControlsFit(page, info, `${label}-duplicate`)
    await reset.click()
    await expect(page.getByRole('status')).toContainText(
      'Default combat bindings restored locally.',
    )
    await expect(save).toBeEnabled()
    await expectDesktopControlsFit(page, info, `${label}-reset`)
    await save.click()
    await expect(page.getByRole('status')).toContainText('Combat controls saved to your account.')
    await page.reload()
    await expect(page.getByTestId('keybind-inspect').locator('kbd')).toHaveText('I')
    await expect(save).toBeDisabled()
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
  const rows = page.locator('[data-testid^="keybind-"]')
  const list = page.getByTestId('keybind-inspect').locator('..')
  await expect(concept).toBeVisible()
  await expect(rows).toHaveCount(COMBAT_KEYBIND_ACTIONS.length)
  await settle(page)

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-character-concept="controls"]')!
    const outer = root.parentElement!
    const grid = document.querySelector('[data-testid="keybind-inspect"]')!.parentElement!
    return {
      surface: root.dataset.avSurface ?? null,

      background: getComputedStyle(root).backgroundImage,
      outerBackground: getComputedStyle(outer).backgroundImage,
      gridOverflowY: getComputedStyle(grid).overflowY,
      gridClientHeight: grid.clientHeight,
      gridScrollHeight: grid.scrollHeight,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }
  })

  expect.soft(metrics.overflow, 'phone has no horizontal overflow').toBeLessThanOrEqual(1)
  expect
    .soft(metrics.surface, 'phone Controls uses the stone surface token contract')
    .toBe('moonstone')
  expect
    .soft(metrics.background, 'phone panel reveals its stone workspace')
    .toContain('linear-gradient')
  expect
    .soft(metrics.outerBackground, 'phone outer workspace uses stone material')
    .toContain('linear-gradient')
  expect.soft(metrics.gridOverflowY, 'phone binding list uses natural page scroll').not.toBe('auto')
  expect
    .soft(
      metrics.gridScrollHeight - metrics.gridClientHeight,
      'phone does not trap bindings internally',
    )
    .toBeLessThanOrEqual(1)

  const lastBinding = page.getByTestId('keybind-combatLog')
  await lastBinding.scrollIntoViewIfNeeded()
  const lastControl = lastBinding.getByRole('button', { name: /^Change/ })
  await expect(lastControl).toBeInViewport({ ratio: 1 })
  await lastControl.click({ trial: true })
  expect
    .soft(await list.evaluate((element) => element.scrollTop), 'phone list itself does not scroll')
    .toBe(0)

  const reset = page.getByRole('button', { name: 'Reset defaults' })
  const save = page.getByRole('button', { name: 'Save Controls' })
  await reset.scrollIntoViewIfNeeded()
  await expect(reset).toBeInViewport({ ratio: 1 })
  await reset.click({ trial: true })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport({ ratio: 1 })
  await expect(save).toBeDisabled()

  if (process.env.LAYOUT_REVIEW_OUTPUT) {
    await mkdir(process.env.LAYOUT_REVIEW_OUTPUT, { recursive: true })
    await page.screenshot({
      path: path.join(process.env.LAYOUT_REVIEW_OUTPUT, 'controls-mobile-390x844.png'),
      fullPage: true,
    })
  }
})
