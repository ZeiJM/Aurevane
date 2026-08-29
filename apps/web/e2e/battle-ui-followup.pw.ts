import { expect, test } from '@playwright/test'

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
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${suffix}`,
  }
}

test('centers the AI header cluster and opens Battle Log without reflowing the board', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Owner-verified desktop battle geometry')
  test.slow()
  await page.setViewportSize({ width: 1536, height: 768 })

  const identity = uniqueIdentity('AiLayout')
  await createAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AI-layout-followup-2026!',
    characterName: identity.characterName,
  })

  await page.getByRole('button', { name: 'Navigation' }).click()
  const battleHallLink = page.getByRole('link', { name: /Battle Hall/ })
  await battleHallLink.focus()
  await battleHallLink.press('Enter')
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-battle-visual-contract='true']")
  const header = root.locator(":scope > header[data-battle-shared-header='true']")
  const economy = header.locator("[data-battle-shared-economy='true']")
  const victory = header.locator("[data-battle-shared-header-action='victory']")
  const combatLog = header.locator("[data-battle-shared-header-action='round-log']")
  const battlefield = root.locator('#battlefield')
  const board = battlefield.locator("[data-board-auto-fit='9x7']")

  await expect(header).toBeVisible()
  await expect(economy).toBeVisible()
  await expect(victory).toBeVisible()
  await expect(combatLog).toBeVisible()
  await expect(board).toBeVisible()

  const headerGeometry = await header.evaluate((element) => {
    const economyElement = element.querySelector<HTMLElement>("[data-battle-shared-economy='true']")!
    const victoryElement = element.querySelector<HTMLElement>(
      "[data-battle-shared-header-action='victory']",
    )!
    const headerRect = element.getBoundingClientRect()
    const economyRect = economyElement.getBoundingClientRect()
    const victoryRect = victoryElement.getBoundingClientRect()
    const clusterLeft = Math.min(economyRect.left, victoryRect.left)
    const clusterRight = Math.max(economyRect.right, victoryRect.right)

    return {
      headerMidpoint: headerRect.left + headerRect.width / 2,
      clusterMidpoint: clusterLeft + (clusterRight - clusterLeft) / 2,
    }
  })
  expect(Math.abs(headerGeometry.clusterMidpoint - headerGeometry.headerMidpoint)).toBeLessThanOrEqual(
    2,
  )

  const beforeBoard = await board.boundingBox()
  expect(beforeBoard).not.toBeNull()

  await combatLog.click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toBeVisible()
  await expect(battlefield).toHaveAttribute('data-desktop-battle-log-open', 'true')

  const afterBoard = await board.boundingBox()
  const battlefieldBox = await battlefield.boundingBox()
  const visibleLogPanel = battleLog.locator(':scope > :first-child')
  const logBox = await visibleLogPanel.boundingBox()
  expect(afterBoard).not.toBeNull()
  expect(battlefieldBox).not.toBeNull()
  expect(logBox).not.toBeNull()

  expect(Math.abs(afterBoard!.x - beforeBoard!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterBoard!.y - beforeBoard!.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterBoard!.width - beforeBoard!.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterBoard!.height - beforeBoard!.height)).toBeLessThanOrEqual(1)
  expect(logBox!.x).toBeGreaterThanOrEqual(afterBoard!.x + afterBoard!.width + 6)
  expect(logBox!.x + logBox!.width).toBeLessThanOrEqual(
    battlefieldBox!.x + battlefieldBox!.width + 1,
  )
  expect(logBox!.width).toBeGreaterThanOrEqual(220)

  await combatLog.click()
  await expect(battleLog).toHaveCount(0)
  const afterCloseBoard = await board.boundingBox()
  expect(afterCloseBoard).not.toBeNull()
  expect(Math.abs(afterCloseBoard!.x - beforeBoard!.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(afterCloseBoard!.width - beforeBoard!.width)).toBeLessThanOrEqual(1)
})

test('gives PvP the compact PvE command-strip context and authoritative preview chips', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Owner-verified desktop PvP command strip')
  test.slow()

  const password = 'PvP-context-followup-2026!'
  const hostIdentity = uniqueIdentity('PvpContextHost')
  const guestIdentity = uniqueIdentity('PvpContextGuest')
  const hostContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 768 },
  })
  const guestContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 768 },
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
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })

    const hostRoot = host.locator("main[data-pvp-battle='true']")
    const guestRoot = guest.locator("main[data-pvp-battle='true']")
    await expect(hostRoot).toBeVisible()
    await expect(guestRoot).toBeVisible()

    const hostHasTurn = (await hostRoot.getAttribute('data-local-turn')) === 'true'
    const activePage = hostHasTurn ? host : guest
    const commandDeck = activePage.getByRole('region', { name: 'Command Deck' })
    const move = commandDeck.getByRole('button', { name: /Move/ })
    const guard = commandDeck.getByRole('button', { name: /Guard/ })

    await move.click()
    const instruction = commandDeck.locator("[data-battle-instruction-row='true']")
    const title = instruction.locator("[data-battle-instruction-title='true']")
    const description = instruction.locator("[data-battle-instruction-description='true']")
    await expect(instruction).toHaveAttribute('data-battle-command-explanation', 'move')
    await expect
      .poll(() => title.evaluate((element) => window.getComputedStyle(element, '::after').content))
      .toContain('25 AP per normal tile')
    await expect(description).toBeHidden()

    await guard.click()
    await expect(instruction).toHaveAttribute('data-battle-command-explanation', 'guard')
    await expect
      .poll(() => title.evaluate((element) => window.getComputedStyle(element, '::after').content))
      .toContain('30 AP')
    const preview = commandDeck.locator("[data-battle-target-preview='true']")
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('Success 100%')
    await expect(preview).toContainText('Guarded')
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
