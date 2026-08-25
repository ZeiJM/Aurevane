import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

const BASE_URL = 'http://127.0.0.1:3100'

function uniqueCharacterName(prefix: string): string {
  const suffix = Date.now().toString(36).toUpperCase()
  return `${prefix} ${suffix}`
}

test('mobile spectator renders the full 9x7 PvP battlefield', async ({ browser, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'This regression is mobile-specific.')
  test.setTimeout(120_000)

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const password = 'PvP-spectator-browser-2026!'
  const hostContext = await browser.newContext({ baseURL: BASE_URL })
  const guestContext = await browser.newContext({ baseURL: BASE_URL })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()

  try {
    await createAccountAndEnterCharacter({
      page: host,
      email: `spectator-host-${runId}@example.com`,
      password,
      characterName: uniqueCharacterName('Host'),
    })
    await host.goto('/game/battle')
    await host.getByRole('button', { name: /Player vs Player/ }).click()
    await host.getByRole('button', { name: 'Create Battle Lobby' }).click()
    const hostLobby = host.getByRole('dialog', { name: 'The arena is waiting.' })
    await expect(hostLobby).toBeVisible()
    const lobbyKey = (await hostLobby.locator('button').filter({ hasText: 'Lobby Key' }).locator('strong').textContent())?.trim()
    expect(lobbyKey).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    await createAccountAndEnterCharacter({
      page: guest,
      email: `spectator-guest-${runId}@example.com`,
      password,
      characterName: uniqueCharacterName('Guest'),
    })
    await guest.goto(`/game/battle?join=${encodeURIComponent(lobbyKey ?? '')}`)
    const guestLobby = guest.getByRole('dialog', { name: 'The arena is waiting.' })
    await expect(guestLobby).toBeVisible({ timeout: 15_000 })

    await guestLobby.getByRole('button', { name: 'Mark Ready' }).click()
    await hostLobby.getByRole('button', { name: 'Mark Ready' }).click()

    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    const battleKey = (await host.locator('[data-pvp-spectator-key="true"] strong').textContent())?.trim()
    expect(battleKey).toMatch(/^AVB-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    await createAccountAndEnterCharacter({
      page,
      email: `spectator-viewer-${runId}@example.com`,
      password,
      characterName: uniqueCharacterName('Viewer'),
    })
    await page.goto('/game/battle')
    await page.getByRole('button', { name: /^03\s*Spectate/ }).click()
    await page.getByLabel('Battle Key').fill(battleKey ?? '')
    await page.getByRole('button', { name: 'Spectate Battle' }).click()
    await expect(page).toHaveURL(/\/game\/battle\/spectate\/AVB-[A-Z0-9-]+$/, { timeout: 15_000 })

    const battlefield = page.getByRole('region', { name: 'Live battlefield' })
    const boardScroller = battlefield.locator(':scope > div').nth(1)
    const board = boardScroller.locator(':scope > div')
    const tiles = battlefield.getByRole('button', { name: /^Tile / })

    await expect(battlefield).toBeVisible()
    await expect(tiles).toHaveCount(63)

    const measurements = await page.evaluate(() => {
      const battlefield = document.querySelector<HTMLElement>('#battlefield')
      const scroller = battlefield?.children.item(1) as HTMLElement | null
      const board = scroller?.firstElementChild as HTMLElement | null
      const tile = board?.querySelector<HTMLElement>('button[aria-label^="Tile "]') ?? null
      const measure = (element: HTMLElement | null) => {
        if (!element) return null
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)
        return {
          width: rect.width,
          height: rect.height,
          display: style.display,
          overflow: style.overflow,
          gridTemplateRows: style.gridTemplateRows,
          gridTemplateColumns: style.gridTemplateColumns,
          aspectRatio: style.aspectRatio,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
        }
      }
      return {
        battlefield: measure(battlefield),
        scroller: measure(scroller),
        board: measure(board),
        tile: measure(tile),
      }
    })

    console.log('mobile spectator battlefield measurements', measurements)

    const scrollerBox = await boardScroller.boundingBox()
    const boardBox = await board.boundingBox()
    const firstTileBox = await tiles.first().boundingBox()

    expect(scrollerBox).not.toBeNull()
    expect(scrollerBox?.height ?? 0).toBeGreaterThan(0)
    expect(boardBox).not.toBeNull()
    expect(boardBox?.height ?? 0).toBeGreaterThan(0)
    expect(firstTileBox).not.toBeNull()
    expect(firstTileBox?.width ?? 0).toBeGreaterThan(0)
    expect(firstTileBox?.height ?? 0).toBeGreaterThan(0)
  } finally {
    await hostContext.close()
    await guestContext.close()
  }
})
