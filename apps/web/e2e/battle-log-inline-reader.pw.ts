import { expect, test, type Locator, type Page } from '@playwright/test'

import { recordedChronicleAction } from './battle-log-chronicle-fixtures'
import {
  battleChronicleScrollRegion,
  expectReadableBattleLog,
  scrollBattleChronicle,
  setBattleChronicleOpen,
} from './battle-log-layout-helpers'
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

async function readMobileFrame(page: Page) {
  return page.evaluate(() => {
    const regions = {
      header: 'main[data-unified-battle] > header',
      rails: '[data-battle-side="local"]',
      board: '[data-board-auto-fit]',
      footer: '[data-battle-mobile-footer]',
      lower: '[data-battle-mobile-lower-panel]',
    }
    return Object.fromEntries(
      Object.entries(regions).map(([name, selector]) => {
        const { x, y, width, height } = document.querySelector(selector)!.getBoundingClientRect()
        return [name, { x, y, width, height }]
      }),
    )
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
  const mobileTimeline = page.locator('[data-battle-mobile-chronicle-strip]')
  if (await mobileTimeline.isVisible()) {
    const strip = mobileTimeline.locator('[data-battle-action-strip]')
    const track = strip.locator('[aria-label="Battle actions"]')
    const actions = track.getByRole('button', { name: /Show Chronicle details/i })
    await expect(actions).toHaveCount(20)
    await expect(page.locator('[data-battle-mobile-chronicle-toggle]')).toHaveCount(0)
    const board = page.locator('[data-board-auto-fit]')
    const before = await readBoardGeometry(board)
    const frameBefore = await readMobileFrame(page)
    await actions.first().click()
    const details = page.getByRole('region', { name: /Chronicle action:/i })
    await expect(details).toBeVisible()
    await expect(details).toContainText(characterName)
    await expect(details).toContainText('1 damage')
    await details.getByRole('button', { name: 'Close Chronicle action' }).click()
    await track.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    await expect(actions.last()).toBeInViewport()
    expect(await readMobileFrame(page)).toEqual(frameBefore)
    await page
      .locator('main[data-unified-battle]')
      .evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }))
    await page.keyboard.press('Digit3')
    await expect(page.locator('main[data-unified-battle]')).toHaveAttribute(
      'data-battle-action-mode',
      'guard',
    )
    entries = [...entries, ...recordedChronicleAction(21, 1)]
    const refreshed = page.waitForResponse(
      (response) => response.url().endsWith('/events') && response.request().method() === 'GET',
    )
    await commitGesture(
      page,
      page.getByRole('button', { name: new RegExp('occupied by ' + characterName) }),
    )
    await refreshed
    await expect(actions).toHaveCount(21)
    await actions.last().click()
    await expect(details).toBeVisible()
    await expect(details).toContainText('21 damage')
    await details.getByRole('button', { name: 'Close Chronicle action' }).click()
    expect(await readMobileFrame(page)).toEqual(frameBefore)
    const after = await readBoardGeometry(board)
    expect(after.layout.width).toBe(before.layout.width)
    expect(after.layout.height).toBe(before.layout.height)
    await testInfo.attach('mobile-chronicle-history-after-refresh', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    return
  }

  await setBattleChronicleOpen(page, true)
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
  const scroller = await battleChronicleScrollRegion(page, reader)
  const geometry = await scroller.evaluate((element) => ({
    horizontal: element.scrollWidth - element.clientWidth,
    vertical: element.scrollHeight - element.clientHeight,
  }))
  expect(geometry.horizontal).toBeLessThanOrEqual(1)
  expect(geometry.vertical).toBeGreaterThan(0)
  await scrollBattleChronicle(page, reader, 'start')
  await expect(firstAction).toBeInViewport()
  await expect(firstAction).toContainText('1 damage')
  const after = await readBoardGeometry(board)
  await testInfo.attach('inline-log-board-geometry', {
    body: Buffer.from(JSON.stringify({ before, after }, null, 2)),
    contentType: 'application/json',
  })
  if (testInfo.project.name === 'mobile-chromium') {
    expect(after.viewport).toEqual(before.viewport)
    expect(after.layout).toEqual(before.layout)
  } else {
    expect(after.viewport).toEqual(before.viewport)
  }

  // Arm the real Guard flow without scrolling the open history to its cockpit.
  await page
    .locator('main[data-unified-battle]')
    .evaluate((element) => (element as HTMLElement).focus({ preventScroll: true }))
  await page.keyboard.press('Digit3')
  await expect(page.locator('main[data-unified-battle]')).toHaveAttribute(
    'data-battle-action-mode',
    'guard',
  )
  await scrollBattleChronicle(page, reader, 'start')
  const anchor = await firstAction.evaluate((element) => {
    const reader = element.closest('[data-battle-chronicle]')!
    const lower = element.closest('[data-battle-mobile-lower-panel]')
    const viewport = lower && getComputedStyle(lower).display !== 'contents' ? lower : reader
    return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top
  })
  // Guard spends AP in the same recorded round; it does not advance the battle to Round 2.
  entries = [...entries, ...recordedChronicleAction(21, 1)]
  const refreshed = page.waitForResponse(
    (response) => response.url().endsWith('/events') && response.request().method() === 'GET',
  )
  const toggle = page.locator('[data-battle-mobile-chronicle-toggle]')
  const mobile = await toggle.isVisible()
  const frameBefore = mobile ? await readMobileFrame(page) : null
  await commitGesture(
    page,
    page.getByRole('button', { name: new RegExp(`occupied by ${characterName}`) }),
  )
  await refreshed
  if (mobile) {
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await readMobileFrame(page)).toEqual(frameBefore)
  }
  await expect(reader.locator('[data-chronicle-action]')).toHaveCount(21)
  await expect(reader).toContainText('ROUND 1')
  await expect(reader.locator('[data-chronicle-round]')).toHaveCount(1)
  await expect(currentRound).toHaveAttribute('data-chronicle-current-round', 'true')
  await expect(firstAction).toBeInViewport()
  const refreshedAnchor = await firstAction.evaluate((element) => {
    const reader = element.closest('[data-battle-chronicle]')!
    const lower = element.closest('[data-battle-mobile-lower-panel]')
    const viewport = lower && getComputedStyle(lower).display !== 'contents' ? lower : reader
    return element.getBoundingClientRect().top - viewport.getBoundingClientRect().top
  })
  expect(Math.abs(refreshedAnchor - anchor)).toBeLessThanOrEqual(1)
  await scrollBattleChronicle(page, reader, 'end')
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
