import { expect, test } from '@playwright/test'

import { expectTerrainKey } from './battle-map-key-helpers'
import { expectBattleFlowKeepsBoardSize } from './battle-reference-layout-helpers'
import { expectRefinedCockpit } from './refined-battle-helpers'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const nameSuffix = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix} ${nameSuffix}`,
  }
}

function readCountdownSeconds(text: string | null): number {
  const match = text?.match(/(\d+)s left/)
  if (!match) throw new Error(`Expected opponent countdown text, received: ${text ?? '<empty>'}`)
  return Number(match[1])
}

test('keeps the unified PvP battle usable on mobile', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile PvP regression')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('MobileHost')
  const guestIdentity = uniqueIdentity('MobileGuest')
  const contextOptions = {
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  }
  const hostContext = await browser.newContext(contextOptions)
  const guestContext = await browser.newContext(contextOptions)
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
    await host.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
    await expect(
      host
        .getByRole('group', { name: 'Map size' })
        .getByRole('button', { name: 'Medium · 12×7', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    const createLobbyButton = host.getByRole('button', { name: 'Create Battle Lobby' })
    await expect(createLobbyButton).toBeVisible()
    await createLobbyButton.click()

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

    const hostRoot = host.locator("main[data-unified-battle='true'][data-battle-kind='pvp']")
    const guestRoot = guest.locator("main[data-unified-battle='true'][data-battle-kind='pvp']")
    await expect(hostRoot).toBeVisible()
    await expect(guestRoot).toBeVisible()

    const hostHasTurn = (await hostRoot.getAttribute('data-local-turn')) === 'true'
    const activePage = hostHasTurn ? host : guest
    const activeRoot = hostHasTurn ? hostRoot : guestRoot
    const waitingRoot = hostHasTurn ? guestRoot : hostRoot
    const waitingPage = hostHasTurn ? guest : host

    const battlefield = activeRoot.locator('#battlefield')
    const board = battlefield.locator("[data-board-auto-fit='12x7']")
    const commandDeck = activeRoot.getByRole('region', { name: 'Command Deck' })

    await expect(battlefield).toBeVisible()
    await expect(commandDeck).toBeVisible()
    await expect(board.locator(":scope > button[aria-label^='Tile ']")).toHaveCount(84)
    await expectTerrainKey(hostHasTurn ? host : guest)

    await expect(commandDeck.getByRole('button', { name: /^Move, / })).toBeVisible()
    await expect(commandDeck.getByRole('button', { name: /^Basic Attack, / })).toBeVisible()
    await expect(commandDeck.getByRole('button', { name: /^Guard, / })).toBeVisible()
    await expect(commandDeck.getByRole('button', { name: /^End Turn, / })).toBeVisible()
    await expect(activeRoot.getByRole('button', { name: /^Chat/ })).toBeVisible()
    await expect(activeRoot.locator('[data-pvp-spectator-key="true"]')).toBeVisible()
    await expect(activeRoot.locator('button[data-pvp-surrender="true"]')).toBeVisible()

    const opponentClock = waitingRoot.locator('[data-pvp-opponent-turn-clock="true"]')
    await expect(opponentClock).toBeVisible({ timeout: 10_000 })
    await expect(opponentClock).toHaveText(/\d+s left/, { timeout: 10_000 })
    const firstCountdown = readCountdownSeconds(await opponentClock.textContent())
    expect(firstCountdown).toBeGreaterThan(0)
    expect(firstCountdown).toBeLessThanOrEqual(60)
    await waitingPage.waitForTimeout(1_400)
    const secondCountdown = readCountdownSeconds(await opponentClock.textContent())
    expect(secondCountdown).toBeLessThan(firstCountdown)

    await expectRefinedCockpit(activePage)
    const documentFits = await activePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    )
    expect(documentFits).toBe(true)
    await expect(activeRoot.locator('[data-battle-combatant-card="local"]')).toBeVisible()
    await expect(activeRoot.locator('[data-battle-combatant-card="selected"]')).toBeVisible()
    await expectBattleFlowKeepsBoardSize(hostHasTurn ? host : guest)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
