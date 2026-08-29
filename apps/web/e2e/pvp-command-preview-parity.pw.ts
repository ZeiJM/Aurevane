import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

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

test('uses the richer PvE-style command context in playable PvP without stale state', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop PvP command parity regression')
  test.slow()

  const password = 'PvpCommandParity-2026!'
  const hostIdentity = uniqueIdentity('PvpCommandHost')
  const guestIdentity = uniqueIdentity('PvpCommandGuest')
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
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

    await commandDeck.getByRole('button', { name: /Move/ }).click()
    const context = commandDeck.locator('[data-pvp-command-context="true"]')
    await expect(context).toContainText('Move · 25 AP per normal tile')

    await activePage.getByRole('button', { name: 'Cancel Action' }).click()
    await expect(context).toHaveCount(0)
    await expect(commandDeck).toContainText('Selection cleared')

    await commandDeck.getByRole('button', { name: /Guard/ }).click()
    await expect(context).toContainText('Guard · 30 AP')
    const preview = context.locator('[data-battle-target-preview="true"]')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('Success 100%')
    await expect(preview).toContainText('Guarded')
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
