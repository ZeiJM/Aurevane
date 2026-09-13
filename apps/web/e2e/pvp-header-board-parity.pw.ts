import { expect, test } from '@playwright/test'

import { expectMapKey } from './battle-map-key-helpers'
import { expectBattleReferenceLayout } from './battle-reference-layout-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Keep this as a rendered two-player regression: CSS-source assertions alone missed both failures.
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

test('keeps the live desktop PvP header, opponent timer, and full board stable', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop PvP geometry regression')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('PvPHost')
  const guestIdentity = uniqueIdentity('PvPGuest')
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  // Reproduce the user's short desktop viewport (roughly 1920x768 at 125% display scaling).
  await Promise.all([
    host.setViewportSize({ width: 1536, height: 614 }),
    guest.setViewportSize({ width: 1536, height: 614 }),
  ])

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
    await expect(guestDialog).toContainText(hostIdentity.characterName)
    await expect(guestDialog).toContainText(guestIdentity.characterName)

    await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()

    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })

    const root = host.locator("main[data-pvp-battle='true']")
    const guestRoot = guest.locator("main[data-pvp-battle='true']")
    await expect(root).toBeVisible()
    await expect(guestRoot).toBeVisible()

    const viewportFit = await host.evaluate(() => {
      const battle = document.querySelector<HTMLElement>("main[data-pvp-battle='true']")!
      const rect = battle.getBoundingClientRect()
      return {
        viewportHeight: window.innerHeight,
        battleTop: rect.top,
        battleBottom: rect.bottom,
        documentClientHeight: document.documentElement.clientHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        bodyOverflow: getComputedStyle(document.body).overflow,
      }
    })
    expect(viewportFit.documentScrollHeight).toBeLessThanOrEqual(
      viewportFit.documentClientHeight + 1,
    )
    expect(viewportFit.battleTop).toBeGreaterThanOrEqual(-1)
    expect(viewportFit.battleBottom).toBeLessThanOrEqual(viewportFit.viewportHeight + 1)
    expect(viewportFit.bodyOverflow).toBe('hidden')

    const hostHasTurn = (await root.getAttribute('data-local-turn')) === 'true'
    const waitingRoot = hostHasTurn ? guestRoot : root
    const waitingPage = hostHasTurn ? guest : host
    const opponentClock = waitingRoot.locator("[data-pvp-opponent-turn-clock='true']")

    await expect(opponentClock).toBeVisible({ timeout: 10_000 })
    await expect(opponentClock).toHaveText(/\d+s left/, { timeout: 10_000 })
    const firstCountdown = readCountdownSeconds(await opponentClock.textContent())
    expect(firstCountdown).toBeGreaterThan(0)
    expect(firstCountdown).toBeLessThanOrEqual(60)
    await waitingPage.waitForTimeout(1_400)
    const secondCountdown = readCountdownSeconds(await opponentClock.textContent())
    expect(secondCountdown).toBeLessThan(firstCountdown)

    const header = root.locator(':scope > header')
    const economy = header.locator('[data-pvp-header-economy="true"]')
    await expect(header).toHaveAttribute('data-pvp-header-layout', 'approved')
    await expect(economy).toHaveAttribute('data-pvp-header-layout', 'approved')
    await expectMapKey(host)
    await expect(header.getByRole('button', { name: /Round .*Combat Log/i })).toHaveCount(0)
    await expect(root.locator('#battlefield button[aria-label^="Tile "]')).toHaveCount(63)
    await expectBattleReferenceLayout(host, testInfo, 'pvp-header-map-first')
    const board = root.locator('[data-board-auto-fit]')
    const before = await board.boundingBox()
    await host.waitForTimeout(1_250)
    const after = await board.boundingBox()
    expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
