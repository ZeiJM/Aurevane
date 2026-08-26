import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueIdentity(prefix: string): { email: string; characterName: string } {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `${prefix}${seed.slice(-7)}`,
  }
}

test('renders the desktop PvP header with the AI economy surface and matched controls', async ({
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

    await expect(root).toBeVisible()
    await expect(header).toHaveAttribute('data-pvp-header-layout', 'approved')
    await expect(economy).toHaveAttribute('data-pvp-header-layout', 'approved')
    await expect(victory).toBeVisible()
    await expect(round).toBeVisible()

    const geometry = await economy.evaluate((element) => {
      const panel = window.getComputedStyle(element, '::before')
      const economyRect = element.getBoundingClientRect()
      const headerRect = element.closest('header')!.getBoundingClientRect()
      const victoryElement = element.querySelector<HTMLButtonElement>(':scope > button')!
      const roundElement = element.closest('header')!.querySelector<HTMLButtonElement>(
        ':scope > button:last-child',
      )!
      const trackElement = element.querySelector<HTMLElement>('[role="progressbar"]')!
      const victoryStyle = window.getComputedStyle(victoryElement)
      const victoryRect = victoryElement.getBoundingClientRect()
      const roundRect = roundElement.getBoundingClientRect()
      const trackRect = trackElement.getBoundingClientRect()

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
      }
    })

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
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
