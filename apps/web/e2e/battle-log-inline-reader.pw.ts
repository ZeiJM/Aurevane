import { expect, test, type Locator } from '@playwright/test'

import { recordedChronicleAction } from './battle-log-chronicle-fixtures'
import { expectReadableBattleLog } from './battle-log-layout-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import { commitGesture } from './refined-battle-helpers'

async function readBoardGeometry(board: Locator) {
  return board.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    let scrollX = window.scrollX
    let scrollY = window.scrollY
    // Mobile's BattleRouteFrame scrolls its field, independently of window.scrollY.
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent === document.scrollingElement) continue
      scrollX += parent.scrollLeft
      scrollY += parent.scrollTop
    }
    const content = element.closest('[data-unified-battle-content]')
    const origin = content && innerWidth <= 820 ? content.getBoundingClientRect() : null
    let originY = origin?.y ?? 0
    let originX = origin?.x ?? 0
    if (origin && content) {
      originY += window.scrollY
      originX += window.scrollX
      for (let parent = content.parentElement; parent; parent = parent.parentElement) {
        if (parent === document.scrollingElement) continue
        originX += parent.scrollLeft
        originY += parent.scrollTop
      }
    }
    return {
      viewport: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      layout: {
        x: rect.x + scrollX - originX,
        y: rect.y + scrollY - originY,
        width: rect.width,
        height: rect.height,
      },
      scrollOffset: { x: scrollX, y: scrollY },
    }
  })
}

test('scrolls the full chronicle and preserves reviewed history after a live commit', async ({
  page,
}, testInfo) => {
  test.slow()
  const suffix = String(Date.now())
    .slice(-8)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const characterName = `Log ${suffix}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `inline-log.${Date.now()}.${testInfo.project.name}@example.com`,
    password: 'AurevaneTest!42',
    characterName,
  })

  // Only the read presentation is synthetic; the refresh below follows a real Guard commit.
  let entries = Array.from({ length: 20 }, (_, index) => recordedChronicleAction(index + 1)).flat()
  await page.route('**/api/battles/*/events', async (route) => {
    const battleSessionId = new URL(route.request().url()).pathname.split('/')[3]!
    await route.fulfill({ json: { battleLog: { battleSessionId, entries } } })
  })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  const log = page.locator('[data-battle-inline-log]')
  const reader = log.getByRole('region', { name: 'Battle chronicle', exact: true })
  const firstAction = reader.locator('[data-chronicle-action="1:0"]')
  const currentRound = reader.locator('[data-chronicle-round="1"]')
  await expect(reader.locator('[data-chronicle-action]')).toHaveCount(20)
  await expect(reader).toContainText('ROUND 1')
  await expect(currentRound).toHaveAttribute('data-chronicle-current-round', 'true')
  await expect(reader.locator('[data-chronicle-actor] > h3')).toHaveText(characterName)
  await expect(reader).toContainText(`${characterName} finds an opening in Recruit’s guard.`)
  await expect(reader).toContainText('20 damage')
  await expect(page.locator('dialog[data-battle-action-details]')).toHaveCount(0)
  const board = page.locator('[data-board-auto-fit]')
  const before = await readBoardGeometry(board)
  await expectReadableBattleLog(page, testInfo, 'all-recorded-actions', log)
  const geometry = await reader.evaluate((element) => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.scrollHeight - element.clientHeight,
  }))
  expect(geometry.horizontal).toBeLessThanOrEqual(1)
  expect(geometry.vertical).toBeGreaterThan(0)
  await reader.evaluate((element) => {
    element.scrollTop = 0
  })
  await expect(firstAction).toBeInViewport()
  await expect(firstAction).toContainText('1 damage')
  const after = await readBoardGeometry(board)
  await testInfo.attach('inline-log-board-geometry', {
    body: Buffer.from(JSON.stringify({ before, after }, null, 2)),
    contentType: 'application/json',
  })
  if (testInfo.project.name === 'mobile-chromium') {
    // Clicking the off-screen log may scroll its field; its board layout and scale must stay fixed.
    expect(after.layout).toEqual(before.layout)
  } else {
    expect(after.viewport).toEqual(before.viewport)
  }

  const anchor = await firstAction.evaluate((element) => {
    const reader = element.closest('[data-battle-chronicle]')!
    return element.getBoundingClientRect().top - reader.getBoundingClientRect().top
  })
  // Guard spends AP in the same recorded round; it does not advance the battle to Round 2.
  entries = [...entries, ...recordedChronicleAction(21, 1)]
  const refreshed = page.waitForResponse(
    (response) => response.url().endsWith('/events') && response.request().method() === 'GET',
  )
  const deck = page.getByRole('region', { name: 'Command Deck' })
  await deck.getByRole('button', { name: /^Guard,/ }).click()
  await commitGesture(
    page,
    page.getByRole('button', { name: new RegExp(`occupied by ${characterName}`) }),
  )
  await refreshed
  await expect(reader.locator('[data-chronicle-action]')).toHaveCount(21)
  await expect(reader).toContainText('ROUND 1')
  await expect(reader.locator('[data-chronicle-round]')).toHaveCount(1)
  await expect(currentRound).toHaveAttribute('data-chronicle-current-round', 'true')
  await reader.scrollIntoViewIfNeeded()
  await expect(firstAction).toBeInViewport()
  const refreshedAnchor = await firstAction.evaluate(
    (element) =>
      element.getBoundingClientRect().top -
      element.closest('[data-battle-chronicle]')!.getBoundingClientRect().top,
  )
  expect(Math.abs(refreshedAnchor - anchor)).toBeLessThanOrEqual(1)
  await reader.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const newest = reader.locator('[data-chronicle-action="21:0"]')
  await expect(newest).toBeInViewport()
  await expect(newest).toContainText('21 damage')
  const finalBoard = await readBoardGeometry(board)
  expect(finalBoard.layout.width).toBe(before.layout.width)
  expect(finalBoard.layout.height).toBe(before.layout.height)
  await testInfo.attach('inline-log-history-after-refresh', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
})
