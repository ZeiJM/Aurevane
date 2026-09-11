import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  createAccountAndEnterCharacter,
  provisionAccountAndEnterCharacter,
} from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const suffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  return {
    email: `${prefix.toLowerCase()}.${seed}@example.com`,
    characterName: `${prefix} ${suffix}`,
  }
}

async function expectInsideViewport(locator: Locator, surface: string): Promise<void> {
  await expect(locator, `${surface} should be visible`).toBeVisible()
  const geometry = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })

  expect(geometry.width, `${surface} should retain measurable width`).toBeGreaterThan(0)
  expect(geometry.height, `${surface} should retain measurable height`).toBeGreaterThan(0)
  expect(geometry.top, `${surface} should not be clipped above the viewport`).toBeGreaterThanOrEqual(
    -1,
  )
  expect(geometry.left, `${surface} should not be clipped left of the viewport`).toBeGreaterThanOrEqual(
    -1,
  )
  expect(geometry.right, `${surface} should not overflow the viewport width`).toBeLessThanOrEqual(
    geometry.viewportWidth + 1,
  )
  expect(geometry.bottom, `${surface} should not overflow the viewport height`).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
  )
}

async function expectBattleCockpitFits(page: Page, surface: string): Promise<void> {
  const root = page.locator("main[data-unified-battle='true']")
  const battlefield = page.locator('#battlefield')
  const commandDeck = page.locator("section[aria-label='Command Deck']")
  const footer = root.locator(':scope > footer')

  await expect(root).toHaveAttribute('data-battle-visual-contract', 'true')
  await page.evaluate(async () => {
    await document.fonts.ready
  })

  const dimensions = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(
    dimensions.scrollHeight,
    `${surface} should not require a vertical page scrollbar`,
  ).toBeLessThanOrEqual(dimensions.clientHeight + 1)
  expect(
    dimensions.scrollWidth,
    `${surface} should not require a horizontal page scrollbar`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1)

  await expectInsideViewport(root, `${surface} root`)
  await expectInsideViewport(battlefield, `${surface} battlefield`)
  await expectInsideViewport(commandDeck, `${surface} command deck`)
  await expectInsideViewport(footer, `${surface} footer`)

  const commandCards = commandDeck.locator('[data-command-card]')
  await expect(commandCards).toHaveCount(6)
  const commandCardHeights = await commandCards.evaluateAll((cards) =>
    cards.map((card) => card.getBoundingClientRect().height),
  )
  expect(Math.min(...commandCardHeights), `${surface} command cards should stay usable`).toBeGreaterThanOrEqual(
    76,
  )
}

async function createPvpBattle(host: Page, guest: Page, password: string): Promise<void> {
  const hostIdentity = uniqueIdentity('ViewportHost')
  const guestIdentity = uniqueIdentity('ViewportGuest')

  await provisionAccountAndEnterCharacter({
    page: host,
    email: hostIdentity.email,
    password,
    characterName: hostIdentity.characterName,
  })
  await provisionAccountAndEnterCharacter({
    page: guest,
    email: guestIdentity.email,
    password,
    characterName: guestIdentity.characterName,
  })

  await host.goto('/game/battle')
  await host.getByRole('button', { name: /Player vs Player/ }).click()
  await host.getByRole('button', { name: 'Create Battle Lobby' }).click()

  const hostDialog = host.getByRole('dialog', { name: 'The arena is waiting.' })
  await expect(hostDialog).toBeVisible()
  const lobbyKey = (
    await hostDialog
      .locator('button')
      .filter({ hasText: 'Lobby Key' })
      .locator('strong')
      .textContent()
  )?.trim()
  expect(lobbyKey).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

  await guest.goto(`/game/battle?join=${encodeURIComponent(lobbyKey!)}`)
  const guestDialog = guest.getByRole('dialog', { name: 'The arena is waiting.' })
  await expect(guestDialog).toBeVisible()
  await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
  await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()

  await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })
  await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })
}

test('fits the active AI battle cockpit without desktop page scrolling', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop battle viewport-fit regression')
  test.slow()

  const identity = uniqueIdentity('ViewportPve')
  await page.setViewportSize({ width: 1728, height: 900 })
  await createAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  await expectBattleCockpitFits(page, 'AI battle at 1728x900')
  await page.setViewportSize({ width: 1366, height: 768 })
  await expectBattleCockpitFits(page, 'AI battle at 1366x768')
})

test('fits the active PvP battle cockpit without desktop page scrolling', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop battle viewport-fit regression')
  test.slow()

  const hostContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1728, height: 900 },
  })
  const guestContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1728, height: 900 },
  })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await createPvpBattle(host, guest, 'AurevaneTest!42')
    await expectBattleCockpitFits(host, 'PvP battle at 1728x900')
    await host.setViewportSize({ width: 1366, height: 768 })
    await expectBattleCockpitFits(host, 'PvP battle at 1366x768')
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
