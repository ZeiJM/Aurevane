import { expect, type Page, type TestInfo } from '@playwright/test'
import { expectRefinedCockpit, targetForecast } from './refined-battle-helpers'

export async function expectBattleReferenceLayout(page: Page, testInfo: TestInfo, label: string) {
  const root = page.locator('main[data-unified-battle="true"]')
  await expect(root).toHaveAttribute('data-battle-layout', 'refined')
  await expectRefinedCockpit(page)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  const geometry = await root.evaluate((element) => {
    const rect = (selector: string) =>
      element.querySelector(selector)!.getBoundingClientRect().toJSON()
    const board = element.querySelector('[data-board-auto-fit]')!
    const boardRect = board.getBoundingClientRect()
    const viewport = board.parentElement!.getBoundingClientRect()
    const tile = board.querySelector('button')!.getBoundingClientRect()
    const last = board.querySelector('button:last-child')!.getBoundingClientRect()
    return {
      board: boardRect.toJSON(),
      viewport: viewport.toJSON(),
      tile: tile.toJSON(),
      last: last.toJSON(),
      deck: rect('[data-unified-command-deck]'),
      forecast: rect('[data-battle-preview-strip]'),
      key: rect('[data-battle-terrain-key]'),
      log: rect('[data-battle-inline-log]'),
      tokens: [...board.querySelectorAll('[data-battle-shared-token]')].map((token) => ({
        token: token.getBoundingClientRect().toJSON(),
        tile: token.parentElement!.getBoundingClientRect().toJSON(),
      })),
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      w: innerWidth,
      h: innerHeight,
    }
  })
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.w + 1)
  expect(Math.abs(geometry.tile.width - geometry.tile.height)).toBeLessThanOrEqual(1)
  if (geometry.w > 820) {
    expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.h + 1)
    expect(geometry.board.left).toBeGreaterThanOrEqual(geometry.viewport.left - 1)
    expect(geometry.last.right).toBeLessThanOrEqual(geometry.viewport.right + 1)
    expect(geometry.last.bottom).toBeLessThanOrEqual(geometry.viewport.bottom + 1)
    expect(geometry.key.right).toBeLessThanOrEqual(geometry.viewport.left + 1)
    expect(geometry.log.left).toBeGreaterThanOrEqual(geometry.viewport.right - 1)
    expect(geometry.forecast.top).toBeGreaterThanOrEqual(geometry.viewport.bottom - 1)
    expect(geometry.deck.top).toBeGreaterThanOrEqual(geometry.forecast.bottom - 1)
  }
  for (const { token, tile } of geometry.tokens) {
    expect(token.width).toBeGreaterThan(tile.width * 0.8)
    expect(token.width).toBeLessThanOrEqual(tile.width * 0.9)
    expect(Math.abs(token.width - token.height)).toBeLessThanOrEqual(1)
  }
  await expectBattlePreviewFits(page)
  await testInfo.attach(label, {
    body: await page.screenshot({ path: testInfo.outputPath(`${label}.png`) }),
    contentType: 'image/png',
  })
}

export async function expectBattleFlowKeepsBoardSize(page: Page) {
  const board = page.locator('#battlefield [data-board-auto-fit]')
  const before = await board.boundingBox()
  await page.getByRole('button', { name: 'Expand battle history' }).click()
  const dialog = page.getByRole('dialog', { name: 'Battle Log', exact: true })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  const after = await board.boundingBox()
  expect(after?.width).toBe(before?.width)
  expect(after?.height).toBe(before?.height)
}

export async function expectBattlePreviewFits(page: Page) {
  const geometry = await targetForecast(page).evaluate((element) => {
    const host = element.getBoundingClientRect().toJSON()
    const items = [
      ...element.querySelectorAll<HTMLElement>(
        '[data-battle-instruction-title], [data-react-battle-preview] > span, [data-react-battle-preview] > button',
      ),
    ]
      .filter(
        (item) =>
          getComputedStyle(item).position !== 'absolute' && item.getBoundingClientRect().height > 0,
      )
      .map((item) => item.getBoundingClientRect().toJSON())
    return { host, items }
  })
  expect(geometry.items.length).toBeGreaterThan(0)
  for (const rect of geometry.items) {
    expect(rect.left).toBeGreaterThanOrEqual(geometry.host.left - 1)
    expect(rect.right).toBeLessThanOrEqual(geometry.host.right + 1)
    expect(rect.top).toBeGreaterThanOrEqual(geometry.host.top - 1)
    expect(rect.bottom).toBeLessThanOrEqual(geometry.host.bottom + 1)
  }
}
