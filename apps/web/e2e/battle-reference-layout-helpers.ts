import { expect, type Page, type TestInfo } from '@playwright/test'

export async function expectBattleReferenceLayout(page: Page, testInfo: TestInfo, label: string) {
  const root = page.locator('main[data-unified-battle="true"]')
  const log = root.locator('[data-battle-flow-log-target="true"] [data-docked-battle-log="true"]')
  await expect(log).toBeVisible()
  const clock = root.locator('[data-battle-turn-clock-slot="true"] > span')
  await expect(clock).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const geometry = await root.evaluate((element) => {
    const rect = (selector: string) =>
      element.querySelector(selector)!.getBoundingClientRect().toJSON()
    const board = element.querySelector('[data-board-auto-fit]')!
    const boardRect = board.getBoundingClientRect()
    const viewport = board.parentElement!.getBoundingClientRect()
    const lastTile = board.querySelector('button:last-child')!.getBoundingClientRect()
    const cards = [...element.querySelectorAll<HTMLElement>('[data-command-card]')]
    return {
      battlefield: rect('#battlefield'),
      deck: rect('[data-unified-command-deck]'),
      flow: rect('[data-battle-flow]'),
      log: rect('[data-docked-battle-log]'),
      footer: rect(':scope > footer'),
      economy: rect('[data-unified-battle-economy]'),
      clock: rect('[data-battle-turn-clock-slot]'),
      boardFits:
        boardRect.left >= viewport.left - 1 &&
        boardRect.right <= viewport.right + 1 &&
        boardRect.top >= viewport.top - 1 &&
        boardRect.bottom <= viewport.bottom + 1,
      lastTileFits: lastTile.right <= viewport.right + 1 && lastTile.bottom <= viewport.bottom + 1,
      cards: cards.map((card) => ({
        ...card.getBoundingClientRect().toJSON(),
        font: parseFloat(getComputedStyle(card.querySelector('strong')!).fontSize),
      })),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth,
    }
  })
  expect(geometry.deck.x).toBeLessThan(geometry.battlefield.x)
  expect(geometry.deck.right).toBeGreaterThan(geometry.battlefield.right)
  expect(Math.abs(geometry.deck.x - geometry.flow.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry.deck.width - geometry.flow.width)).toBeLessThanOrEqual(1)
  expect(geometry.deck.y).toBeGreaterThanOrEqual(geometry.battlefield.bottom - 1)
  expect(geometry.flow.y).toBeGreaterThanOrEqual(geometry.deck.bottom - 1)
  expect(geometry.flow.bottom).toBeLessThanOrEqual(geometry.footer.y + 1)
  expect(geometry.boardFits).toBe(true)
  expect(geometry.lastTileFits).toBe(true)
  expect(geometry.log.x).toBeGreaterThanOrEqual(geometry.flow.x)
  expect(geometry.log.right).toBeLessThanOrEqual(geometry.flow.right)
  expect(geometry.log.width).toBeGreaterThan(geometry.flow.width - 4)
  expect(geometry.clock.x).toBeGreaterThanOrEqual(geometry.economy.x)
  expect(geometry.clock.right).toBeLessThanOrEqual(geometry.economy.right + 1)
  expect(geometry.cards).toHaveLength(6)
  for (const card of geometry.cards) {
    expect(card.height).toBeLessThanOrEqual(160)
    expect(card.font).toBeGreaterThanOrEqual(12)
    expect(card.x).toBeGreaterThanOrEqual(geometry.deck.x)
    expect(card.right).toBeLessThanOrEqual(geometry.deck.right + 1)
  }
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
  await testInfo.attach(label, {
    body: await page.screenshot({ path: testInfo.outputPath(`${label}.png`) }),
    contentType: 'image/png',
  })
}
