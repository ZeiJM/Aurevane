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

test(
  'keeps battle tokens, facing guides, and PvE surrender presentation aligned',
  async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-chromium'
    test.skip(
      !mobile && testInfo.project.name !== 'desktop-chromium',
      'Battle UI polish regression',
    )
    test.slow()

    const identity = uniqueIdentity('BattlePolish')
    await provisionAccountAndEnterCharacter({
      page,
      email: identity.email,
      password: 'AurevaneTest!42',
      characterName: identity.characterName,
    })
    await page.goto('/game/battle')
    await page.getByLabel('Battle mode').selectOption('recruit-sparring')
    await page.getByRole('button', { name: 'Enter Battle' }).click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

    const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
    await expect(root).toBeVisible()
    const occupied = root.locator('#battlefield button[aria-label*="occupied by"]')
    await expect.poll(() => occupied.count()).toBeGreaterThanOrEqual(2)

    const tokenGeometry = await occupied.evaluateAll(
      (tiles, playerName) => {
        return tiles.map((tile) => {
          const token = tile.querySelector<HTMLElement>(':scope > span:last-child')!
          const arrow = token.querySelector<HTMLElement>(':scope > i')!
          const tileRect = tile.getBoundingClientRect()
          const tokenRect = token.getBoundingClientRect()
          const arrowRect = arrow.getBoundingClientRect()
          const arrowStyle = getComputedStyle(arrow)
          return {
            player: (tile.getAttribute('aria-label') ?? '').includes(`occupied by ${playerName}`),
            tileWidth: tileRect.width,
            tileHeight: tileRect.height,
            tokenWidth: tokenRect.width,
            tokenHeight: tokenRect.height,
            arrowTopOffset: arrowRect.top - tokenRect.top,
            arrowFontSize: Number.parseFloat(arrowStyle.fontSize),
          }
        })
      },
      identity.characterName,
    )

    const playerToken = tokenGeometry.find((geometry) => geometry.player)
    expect(playerToken).toBeTruthy()
    for (const geometry of tokenGeometry) {
      expect(Math.abs(geometry.tokenWidth - geometry.tokenHeight)).toBeLessThanOrEqual(1)
      expect(geometry.tokenWidth).toBeLessThanOrEqual(geometry.tileWidth * 0.6)
      expect(Math.abs(geometry.arrowFontSize - playerToken!.arrowFontSize)).toBeLessThanOrEqual(0.2)
      expect(Math.abs(geometry.arrowTopOffset - playerToken!.arrowTopOffset)).toBeLessThanOrEqual(1)
    }

    if (!mobile) {
      const board = root.locator("#battlefield [data-board-auto-fit='9x7']")
      await expect(board).toHaveAttribute('data-battle-square-geometry', 'true')
      const firstTile = occupied.first()
      const dimensions = await firstTile.evaluate((tile) => {
        const rect = tile.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      expect(Math.abs(dimensions.width - dimensions.height)).toBeLessThanOrEqual(1)
    }

    let facingGuides = root.locator('#battlefield button[data-facing-guide="true"]')
    if (mobile) {
      const commandDeck = root.getByRole('region', { name: 'Command Deck' })
      await commandDeck.getByRole('button', { name: /Finish Turn/ }).click()
      await expect.poll(() => facingGuides.count()).toBeGreaterThan(0)
    } else {
      const probe = occupied.first()
      await probe.evaluate((tile) => tile.setAttribute('data-facing-guide', 'true'))
      facingGuides = probe
    }

    const guideGlyphs = await facingGuides.evaluateAll((guides) =>
      guides.map((guide) => {
        const pseudo = getComputedStyle(guide, '::before')
        return { display: pseudo.display, content: pseudo.content }
      }),
    )
    for (const guide of guideGlyphs) {
      expect(guide.display).toBe('none')
      expect(['none', '""']).toContain(guide.content)
    }

    if (mobile) {
      await root.getByRole('button', { name: 'Cancel Action' }).click()
    } else {
      await facingGuides.evaluate((tile) => tile.removeAttribute('data-facing-guide'))
    }

    await root.getByRole('button', { name: 'Surrender', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Surrender this battle?' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('data-pve-surrender-modal', 'true')
    await expect(dialog.locator(':scope > span')).toHaveText('Battle Hall • PvE')

    const stay = dialog.getByRole('button', { name: 'Stay in battle' })
    const confirm = dialog.getByRole('button', { name: 'Confirm Surrender' })
    await expect(stay).toBeVisible()
    await expect(confirm).toBeVisible()
    const actionGeometry = await Promise.all([stay.boundingBox(), confirm.boundingBox()])
    expect(actionGeometry[0]).not.toBeNull()
    expect(actionGeometry[1]).not.toBeNull()
    expect(Math.abs(actionGeometry[0]!.y - actionGeometry[1]!.y)).toBeLessThanOrEqual(2)
    expect(actionGeometry[0]!.x + actionGeometry[0]!.width).toBeLessThanOrEqual(
      actionGeometry[1]!.x + 1,
    )
  },
)
