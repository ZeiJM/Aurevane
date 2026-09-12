import { expect, test } from '@playwright/test'

import { expectBattleReferenceLayout } from './battle-reference-layout-helpers'
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

test('keeps the desktop PvP battle flow below compact commands with the terrain legend visible', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Desktop PvP battle-log regression')
  test.slow()

  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('LogHost')
  const guestIdentity = uniqueIdentity('LogGuest')
  const hostContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 614 },
  })
  const guestContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: { width: 1536, height: 614 },
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

    const root = host.locator("main[data-pvp-battle='true']")
    const battlefield = root.locator('#battlefield')
    const combatLog = root.locator(':scope > header').getByRole('button', {
      name: /Round \d+.*Combat Log/i,
    })

    if ((await combatLog.getAttribute('aria-expanded')) !== 'true') await combatLog.click()
    const terrainLegend = battlefield.locator(':scope > [aria-label="Terrain legend"]')
    await expect(terrainLegend).toBeVisible()
    await expect(terrainLegend.getByText('Difficult Terrain')).toBeVisible()
    await expect(terrainLegend.getByText('Elevated Ground')).toBeVisible()
    await expectBattleReferenceLayout(host, testInfo, 'combat-pvp-short-window')
    for (const size of [
      { width: 2400, height: 1350 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
    ]) {
      await host.setViewportSize(size)
      await expectBattleReferenceLayout(host, testInfo, `combat-pvp-${size.width}x${size.height}`)
    }
    await combatLog.click()
    await expect(host.getByTestId('battle-log-panel')).toHaveCount(0)
    await host.reload()
    await expect(host.getByTestId('battle-log-panel')).toHaveCount(0)
    await host.getByRole('region', { name: 'Battle flow', exact: true }).getByRole('button').click()
    await expectBattleReferenceLayout(host, testInfo, 'combat-pvp-flow-reopened')
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
