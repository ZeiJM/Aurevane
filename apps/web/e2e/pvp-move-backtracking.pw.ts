import { expect, test } from '@playwright/test'

import { moveOneStep } from './refined-battle-helpers'

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

test('PvP shares single-input Move execution and blocks the waiting player', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop two-player PvP movement parity')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('MoveHost')
  const guestIdentity = uniqueIdentity('MoveGuest')
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
    const activeRoot = hostHasTurn ? hostRoot : guestRoot
    const actorName = hostHasTurn ? hostIdentity.characterName : guestIdentity.characterName
    const before = await activeRoot
      .getByRole('progressbar', { name: 'Action Economy remaining' })
      .getAttribute('aria-valuenow')
    const result = await moveOneStep(activePage, actorName)
    const intent = result.request().postDataJSON().intent
    expect(intent.kind).toBe('move')
    expect(intent.path).toHaveLength(2)
    await expect(
      activeRoot.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).not.toHaveAttribute('aria-valuenow', before!)
    await expect(activeRoot).toHaveAttribute('data-local-turn', 'true')
    const waitingRoot = hostHasTurn ? guestRoot : hostRoot
    await expect(waitingRoot.locator('[data-battle-command="move"]')).toBeDisabled()
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
