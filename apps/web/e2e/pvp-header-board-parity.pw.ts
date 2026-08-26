import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix}${seed.slice(-7)}`,
  }
}

test('keeps the live desktop PvP header AI-aligned and the full board visible', async ({
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

  try {
    await createAccountAndEnterCharacter({
      page: host,
      email: hostIdentity.email,
      password,
      characterName: hostIdentity.characterName,
    })
    await createAccountAndEnterCharacter({
      page: guest,
      email: guestIdentity.email,
      password,
      characterName: guestIdentity.characterName,
    })

    await host.goto('/game/battle')
    await host.getByRole('button', { name: /Player vs Player/ }).click()
    await expect(host.getByRole('heading', { name: /Challenge another player/ })).toBeVisible()
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
    await expect(guestDialog).toContainText(hostIdentity.characterName)
    await expect(guestDialog).toContainText(guestIdentity.characterName)

    await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()

    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/i, { timeout: 20_000 })

    const root = host.locator("main[data-pvp-battle='true']")
    const header = root.locator(':scope > header')
    const economy = header.locator("[data-pvp-header-economy='true']")
    const victory = economy.getByRole('button', { name: /Victory Conditions/i })
    const round = header.getByRole('button', { name: /Round \d+.*Combat Log/i })
    const battlefield = root.locator('#battlefield')
    const viewport = battlefield.locator(':scope > div').first()
    const board = viewport.locator(':scope > div').first()
    const tiles = board.locator("button[aria-label^='Tile ']")

    await expect(root).toBeVisible()
    await expect(header).toHaveAttribute('data-pvp-header-layout', 'approved')
    await expect(economy).toHaveAttribute('data-pvp-header-layout', 'approved')
    await expect(victory).toBeVisible()
    await expect(round).toBeVisible()
    await expect(tiles).toHaveCount(63)
    await expect(board.getByRole('button', { name: /^Tile 9, 7;/ })).toBeVisible()

    const readGeometry = async () =>
      root.evaluate((element) => {
        const headerElement = element.querySelector<HTMLElement>(':scope > header')!
        const economyElement = headerElement.querySelector<HTMLElement>(
          '[data-pvp-header-economy="true"]',
        )!
        const victoryElement = Array.from(
          economyElement.querySelectorAll<HTMLButtonElement>('button'),
        ).find((button) => button.textContent?.includes('Victory Conditions'))!
        const roundElement = Array.from(
          headerElement.querySelectorAll<HTMLButtonElement>('button'),
        ).find((button) => button.textContent?.includes('COMBAT LOG'))!
        const battlefieldElement = element.querySelector<HTMLElement>('#battlefield')!
        const viewportElement = battlefieldElement.firstElementChild as HTMLElement
        const boardElement = viewportElement.firstElementChild as HTMLElement
        const lastTile = boardElement.querySelector<HTMLButtonElement>(
          'button[aria-label^="Tile 9, 7;"]',
        )!
        const panel = window.getComputedStyle(economyElement, '::before')
        const victoryStyle = window.getComputedStyle(victoryElement)
        const economyRect = economyElement.getBoundingClientRect()
        const headerRect = headerElement.getBoundingClientRect()
        const victoryRect = victoryElement.getBoundingClientRect()
        const roundRect = roundElement.getBoundingClientRect()
        const viewportRect = viewportElement.getBoundingClientRect()
        const boardRect = boardElement.getBoundingClientRect()
        const lastTileRect = lastTile.getBoundingClientRect()
        const trackRect = economyElement
          .querySelector<HTMLElement>('[role="progressbar"]')!
          .getBoundingClientRect()

        return {
          panelDisplay: panel.display,
          panelHeight: Number.parseFloat(panel.height),
          panelBorderTopWidth: Number.parseFloat(panel.borderTopWidth),
          panelBackground: panel.backgroundColor,
          economyHeight: economyRect.height,
          economyMidpoint: economyRect.left + economyRect.width / 2,
          headerMidpoint: headerRect.left + headerRect.width / 2,
          victoryHeight: victoryRect.height,
          roundHeight: roundRect.height,
          victoryTextTransform: victoryStyle.textTransform,
          victoryBackground: victoryStyle.backgroundColor,
          trackHeight: trackRect.height,
          boardWidth: boardRect.width,
          boardLeft: boardRect.left,
          boardRight: boardRect.right,
          boardTop: boardRect.top,
          boardBottom: boardRect.bottom,
          viewportLeft: viewportRect.left,
          viewportRight: viewportRect.right,
          viewportTop: viewportRect.top,
          viewportBottom: viewportRect.bottom,
          lastTileRight: lastTileRect.right,
          lastTileBottom: lastTileRect.bottom,
        }
      })

    const geometry = await readGeometry()

    expect(geometry.panelDisplay).toBe('block')
    expect(geometry.panelBorderTopWidth).toBeGreaterThanOrEqual(1)
    expect(geometry.panelBackground).not.toBe('rgba(0, 0, 0, 0)')
    expect(geometry.panelHeight).toBeGreaterThan(20)
    expect(geometry.panelHeight).toBeGreaterThan(geometry.trackHeight * 3)
    expect(Math.abs(geometry.panelHeight - geometry.economyHeight)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.victoryHeight - geometry.roundHeight)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.economyMidpoint - geometry.headerMidpoint)).toBeLessThanOrEqual(2)
    expect(geometry.victoryTextTransform).toBe('none')
    expect(geometry.victoryBackground).not.toBe('rgba(0, 0, 0, 0)')

    expect(geometry.boardWidth).toBeLessThanOrEqual(621)
    expect(geometry.boardLeft).toBeGreaterThanOrEqual(geometry.viewportLeft - 1)
    expect(geometry.boardRight).toBeLessThanOrEqual(geometry.viewportRight + 1)
    expect(geometry.boardTop).toBeGreaterThanOrEqual(geometry.viewportTop - 1)
    expect(geometry.boardBottom).toBeLessThanOrEqual(geometry.viewportBottom + 1)
    expect(geometry.lastTileRight).toBeLessThanOrEqual(geometry.viewportRight + 1)
    expect(geometry.lastTileBottom).toBeLessThanOrEqual(geometry.viewportBottom + 1)

    await host.waitForTimeout(1_250)
    const afterPollGeometry = await readGeometry()
    expect(afterPollGeometry.boardWidth).toBeLessThanOrEqual(621)
    expect(afterPollGeometry.boardBottom).toBeLessThanOrEqual(afterPollGeometry.viewportBottom + 1)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
