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

test('keeps compact local and selected PvP cards while inspecting board participants', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop PvP rail regression')
  test.setTimeout(180_000)

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('RailHost')
  const guestIdentity = uniqueIdentity('RailGuest')
  const hostContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const guestContext = await browser.newContext({ baseURL: 'http://127.0.0.1:3100' })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

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

    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
    ]) {
      await host.setViewportSize(viewport)
      const local = host.locator('[data-battle-combatant-card="local"]')
      const selected = host.locator('[data-battle-combatant-card="selected"]')
      await expect(local).toHaveCount(1)
      await expect(selected).toHaveCount(1)
      await expect(local).toContainText(hostIdentity.characterName)
      await host.locator('[data-battle-command="inspect"]').click()
      await host
        .locator('#battlefield')
        .getByRole('button', { name: new RegExp(`occupied by ${guestIdentity.characterName}`) })
        .click()
      const details = host.getByRole('dialog', {
        name: `${guestIdentity.characterName} battle details`,
      })
      await expect(details).toBeVisible()
      await host.keyboard.press('Escape')
      await expect(selected).toContainText(guestIdentity.characterName)
      const geometry = await selected
        .locator('[data-av-square-media]')
        .evaluate((element) => element.getBoundingClientRect().toJSON())
      expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(1)
      await expect(selected).toContainText(/HP.*MP/s)
    }
  } finally {
    await Promise.allSettled([hostContext.close(), guestContext.close()])
  }
})
