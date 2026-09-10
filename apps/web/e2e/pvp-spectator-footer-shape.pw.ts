import { expect, test, type Page } from '@playwright/test'

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

async function createTwoPlayerBattle(host: Page, guest: Page, password: string) {
  const hostIdentity = uniqueIdentity('SpectatorHost')
  const guestIdentity = uniqueIdentity('SpectatorGuest')

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

test('keeps Spectator Key and Spectators controls in the same pill family', async ({
  browser,
}, testInfo) => {
  test.skip(
    !['desktop-chromium', 'mobile-chromium'].includes(testInfo.project.name),
    'PvP spectator footer shape regression',
  )
  test.slow()

  const mobile = testInfo.project.name === 'mobile-chromium'
  const contextOptions = mobile
    ? {
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      }
    : {
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 1440, height: 900 },
      }
  const hostContext = await browser.newContext(contextOptions)
  const guestContext = await browser.newContext(contextOptions)
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await createTwoPlayerBattle(host, guest, 'AurevaneTest!42')

    const root = host.locator("main[data-pvp-battle='true']")
    const footer = root.locator(':scope > footer')
    const spectatorKey = footer.locator("[data-pvp-spectator-key='true']")
    const spectatorPresence = footer.locator("[data-pvp-footer-presence='true']")
    const spectators = spectatorPresence.getByRole('button', { name: /Spectators/i })

    await expect(root).toBeVisible()
    await expect(spectatorKey).toBeVisible()
    await expect(spectators).toBeVisible({ timeout: 10_000 })

    const shapes = await Promise.all(
      [spectatorKey, spectators].map((locator) =>
        locator.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const style = window.getComputedStyle(element)
          return {
            height: rect.height,
            radius: Number.parseFloat(style.borderTopLeftRadius),
          }
        }),
      ),
    )

    for (const shape of shapes) {
      expect(shape.height).toBeGreaterThan(0)
      expect(shape.radius).toBeGreaterThanOrEqual(shape.height / 2 - 1)
    }

    expect(Math.abs(shapes[0]!.height - shapes[1]!.height)).toBeLessThanOrEqual(1)

    await expect(spectators).toHaveAttribute('aria-expanded', 'false')
    await spectators.click()
    await expect(spectators).toHaveAttribute('aria-expanded', 'true')
    await expect(footer.getByRole('dialog', { name: 'Current spectators' })).toBeVisible()
    await spectators.click()
    await expect(footer.getByRole('dialog', { name: 'Current spectators' })).toHaveCount(0)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
