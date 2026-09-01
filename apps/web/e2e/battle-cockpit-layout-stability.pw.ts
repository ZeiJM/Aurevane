import { expect, test, type Page, type Request } from '@playwright/test'

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

async function expectStableFullDesktopCockpit(page: Page) {
  const deck = page.locator('section[aria-label="Command Deck"]')
  const commands = deck.locator('[data-command-card] > button[data-battle-command]')
  const facingPad = deck.locator('[data-unified-facing-pad="true"]')

  await expect(deck).toBeVisible()
  await expect(commands).toHaveCount(6)
  await expect(facingPad).toBeHidden()

  const before = await commands.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  )
  expect(Math.min(...before)).toBeGreaterThanOrEqual(95)

  await deck.getByRole('button', { name: /Move/ }).click()
  await expect(facingPad).toBeHidden()

  const after = await commands.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  )
  expect(after).toHaveLength(before.length)
  after.forEach((height, index) => {
    expect(Math.abs(height - before[index]!)).toBeLessThanOrEqual(1)
  })
}

test('keeps the shared PvE desktop cockpit at its full scale before and after action selection', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop shared cockpit regression')
  test.slow()

  await page.setViewportSize({ width: 1440, height: 900 })
  const identity = uniqueIdentity('CockpitPve')
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

  await expectStableFullDesktopCockpit(page)
})

test('keeps the shared PvP desktop cockpit at the same full scale', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop shared cockpit regression')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('CockpitHost')
  const guestIdentity = uniqueIdentity('CockpitGuest')
  const hostContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1440, height: 900 },
  })
  const guestContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1440, height: 900 },
  })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
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

    await expectStableFullDesktopCockpit(host)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})

test('mobile Finish Turn opens battlefield facing guides and commits a double-tapped direction', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile shared cockpit regression')
  test.slow()

  const identity = uniqueIdentity('MobFace')
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

  const deck = page.locator('section[aria-label="Command Deck"]')
  const facingPad = deck.locator('[data-unified-facing-pad="true"]')
  const finishTurn = deck.getByRole('button', { name: /Finish Turn/ })
  const facingGuides = page.locator('#battlefield button[data-facing-guide="true"]')
  const tokenArrows = page.locator('#battlefield [data-battle-facing-indicator="true"]')

  await expect(facingPad).toBeHidden()
  await expect(finishTurn).toContainText('Choose facing + end')
  await expect(tokenArrows).toHaveCount(2)

  const arrowGeometry = await tokenArrows.evaluateAll((arrows) =>
    arrows.map((arrow) => {
      const token = arrow.parentElement!
      const arrowRect = arrow.getBoundingClientRect()
      const tokenRect = token.getBoundingClientRect()
      return {
        width: arrowRect.width,
        height: arrowRect.height,
        topOffset: arrowRect.top - tokenRect.top,
        centerOffset:
          (arrowRect.left + arrowRect.right) / 2 - (tokenRect.left + tokenRect.right) / 2,
        path: arrow.querySelector('path')?.getAttribute('d') ?? '',
      }
    }),
  )
  expect(Math.abs(arrowGeometry[0]!.width - arrowGeometry[1]!.width)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(arrowGeometry[0]!.height - arrowGeometry[1]!.height)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(arrowGeometry[0]!.topOffset - arrowGeometry[1]!.topOffset)).toBeLessThanOrEqual(1)
  expect(arrowGeometry[0]!.path).toBe(arrowGeometry[1]!.path)
  arrowGeometry.forEach((arrow) => expect(Math.abs(arrow.centerOffset)).toBeLessThanOrEqual(1))

  let finalTurnRequests = 0
  const countFinalTurn = (request: Request) => {
    if (
      request.method() === 'POST' &&
      /\/api\/battles\/[0-9a-f-]+\/final-turn$/i.test(new URL(request.url()).pathname)
    ) {
      finalTurnRequests += 1
    }
  }
  page.on('request', countFinalTurn)

  await finishTurn.tap()
  await expect(facingGuides).toHaveCount(4)
  await page.waitForTimeout(200)
  expect(finalTurnRequests).toBe(0)

  const northGuide = page.locator(
    '#battlefield button[data-facing-guide="true"][data-facing-direction="north"]',
  )
  const finalTurnResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/battles\/[0-9a-f-]+\/final-turn$/i.test(new URL(response.url()).pathname),
  )
  await northGuide.tap()
  await northGuide.tap()
  expect((await finalTurnResponse).ok()).toBe(true)
  expect(finalTurnRequests).toBe(1)
  page.off('request', countFinalTurn)
})

test('mobile double-tap Finish Turn keeps the current facing as a shortcut', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile shared cockpit regression')
  test.slow()

  const identity = uniqueIdentity('MobKeep')
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

  const finishTurn = page
    .locator('section[aria-label="Command Deck"]')
    .getByRole('button', { name: /Finish Turn/ })
  const finalTurnResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/battles\/[0-9a-f-]+\/final-turn$/i.test(new URL(response.url()).pathname),
  )

  await finishTurn.tap()
  await page.waitForTimeout(80)
  await finishTurn.tap()
  expect((await finalTurnResponse).ok()).toBe(true)
})
