import { randomUUID } from 'node:crypto'

import { expect, test, type Page } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function provision(page: Page, prefix: string) {
  const seed = randomUUID()
  await provisionAccountAndEnterCharacter({
    page,
    email: `${prefix}-${seed}@example.com`,
    password: 'Pvp-map-profile-2026!',
    characterName: `${prefix} ${seed.replace(/[^a-z]/g, '').slice(0, 9)}`,
  })
}

async function currentBattle(page: Page): Promise<BattleSessionView> {
  const id = new URL(page.url()).pathname.split('/').at(-1)!
  const response = await page.request.get(`/api/battles/${id}`)
  expect(response.ok()).toBe(true)
  return (await response.json()).battle as BattleSessionView
}

for (const [size, label, width, tiles] of [
  ['small', 'Small · 9×7', 9, 63],
  ['medium', 'Medium · 12×7', 12, 84],
  ['large', 'Large · 15×7', 15, 105],
] as const) {
  test(`PvP ${size} matches AI geometry through creation, joining, reload and spectation`, async ({
    browser,
    baseURL,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'laptop-chromium', 'Covered at desktop and phone widths')
    test.setTimeout(180_000)
    const contextOptions = { baseURL, viewport: testInfo.project.use.viewport }
    const hostContext = await browser.newContext(contextOptions)
    const guestContext = await browser.newContext(contextOptions)
    const spectatorContext = await browser.newContext(contextOptions)
    const host = await hostContext.newPage()
    const guest = await guestContext.newPage()
    const spectator = await spectatorContext.newPage()
    try {
      await provision(host, 'MapHost')
      await provision(guest, 'MapGuest')
      await provision(spectator, 'MapWatcher')
      await host.goto('/game/battle')
      await host.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
      const mapGroup = host.getByRole('group', { name: 'Map size' })
      await expect(
        mapGroup.getByRole('button', { name: 'Medium · 12×7', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true')
      await mapGroup.getByRole('button', { name: label, exact: true }).click()
      const created = host.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/pvp/lobbies',
      )
      await host.getByRole('button', { name: 'Create Battle Lobby' }).click()
      const createdResponse = await created
      expect(createdResponse.ok()).toBe(true)
      expect(createdResponse.request().postDataJSON().mapSize).toBe(size)
      const { lobby } = await createdResponse.json()
      const hostDialog = host.getByRole('dialog', { name: 'The arena is waiting.' })
      await expect(
        hostDialog.getByRole('region', { name: 'Locked PvP battle settings' }),
      ).toContainText(label)
      await expect(hostDialog.getByRole('img', { name: 'Versus', exact: true })).toBeVisible()
      await guest.goto(`/game/battle?join=${encodeURIComponent(lobby.lobbyKey)}`)
      const guestDialog = guest.getByRole('dialog', { name: 'The arena is waiting.' })
      await expect(
        guestDialog.getByRole('region', { name: 'Locked PvP battle settings' }),
      ).toContainText(label)
      const joinedSettings = await guest.request.get(`/api/pvp/lobbies/${lobby.lobbyId}/settings`)
      expect(joinedSettings.ok()).toBe(true)
      expect((await joinedSettings.json()).settings.mapSize).toBe(size)
      // A waiting lobby reload reads its server-saved profile, not the launch selector default.
      await host.reload()
      await expect(
        hostDialog.getByRole('region', { name: 'Locked PvP battle settings' }),
      ).toContainText(label)
      await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
      await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()
      await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
      await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
      const before = await currentBattle(host)
      expect(before.snapshot.tactical).toMatchObject({ width, height: 7 })
      expect(before.snapshot.tactical.tiles).toHaveLength(tiles)
      for (const page of [host, guest]) {
        await expect(page.locator('[data-board-auto-fit]')).toHaveAttribute(
          'data-board-auto-fit',
          `${width}x7`,
        )
        await expect(page.locator('#battlefield button[aria-label^="Tile "]')).toHaveCount(tiles)
      }
      const startedSettings = await host.request.get(`/api/pvp/lobbies/${lobby.lobbyId}/settings`)
      expect(startedSettings.ok()).toBe(true)
      expect((await startedSettings.json()).settings.mapSize).toBe(size)
      await host.reload()
      const after = await currentBattle(host)
      expect(after.snapshot.tactical.tiles).toEqual(before.snapshot.tactical.tiles)
      expect(after.snapshot.tactical).toMatchObject({ width, height: 7 })
      await expect(host.locator('[data-board-auto-fit]')).toHaveAttribute(
        'data-board-auto-fit',
        `${width}x7`,
      )
      const key = (await host.locator('[data-pvp-spectator-key="true"]').textContent())?.match(
        /AVB-[A-Z0-9]{4}-[A-Z0-9]{4}/,
      )?.[0]
      expect(key).toBeTruthy()
      await spectator.goto(`/game/battle/spectate/${key}`)
      await expect(spectator.locator('[data-board-auto-fit]')).toHaveAttribute(
        'data-board-auto-fit',
        `${width}x7`,
      )
      await expect(spectator.locator('#battlefield button[aria-label^="Tile "]')).toHaveCount(tiles)
      await testInfo.attach(`pvp-${size}-lobby-and-board`, {
        body: await host.screenshot(),
        contentType: 'image/png',
      })
    } finally {
      await hostContext.close()
      await guestContext.close()
      await spectatorContext.close()
    }
  })
}
