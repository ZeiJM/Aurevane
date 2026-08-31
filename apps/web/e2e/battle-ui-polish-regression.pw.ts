import { expect, test, type Page } from '@playwright/test'

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

async function expectSurrenderActionsInline(page: Page, dialogName = 'Surrender this battle?') {
  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog).toBeVisible()
  const stay = dialog.getByRole('button', { name: /Stay in Battle/i })
  const confirm = dialog.getByRole('button', { name: /Confirm Surrender/i })
  await expect(stay).toBeVisible()
  await expect(confirm).toBeVisible()

  const geometry = await Promise.all([
    stay.boundingBox(),
    confirm.boundingBox(),
  ])
  expect(geometry[0]).not.toBeNull()
  expect(geometry[1]).not.toBeNull()
  expect(Math.abs(geometry[0]!.y - geometry[1]!.y)).toBeLessThanOrEqual(2)
  expect(geometry[0]!.x + geometry[0]!.width).toBeLessThanOrEqual(geometry[1]!.x + 2)
}

async function expectLargeBoardGeometry(root: ReturnType<Page['locator']>) {
  const board = root.locator('#battlefield [data-board-auto-fit]')
  await expect(board).toHaveAttribute('data-board-auto-fit', '13x9')
  await expect(root.locator('#battlefield button[aria-label^="Tile "]')).toHaveCount(117)

  const geometry = await board.evaluate((element) => {
    const tiles = Array.from(element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'))
    const occupied = tiles.filter((tile) => tile.getAttribute('aria-label')?.includes('occupied by'))
    const sampleTiles = [tiles[0], tiles[Math.floor(tiles.length / 2)], tiles.at(-1)].filter(
      (tile): tile is HTMLButtonElement => Boolean(tile),
    )
    const tileRatios = sampleTiles.map((tile) => {
      const rect = tile.getBoundingClientRect()
      return rect.width / rect.height
    })
    const tokens = occupied
      .map((tile) =>
        tile.querySelector<HTMLElement>(
          ':scope > [data-battle-shared-token="true"], :scope > [data-team], :scope > span:last-child',
        ),
      )
      .filter((token): token is HTMLElement => Boolean(token))
    const tokenRatios = tokens.map((token) => {
      const tile = token.parentElement as HTMLElement
      return token.getBoundingClientRect().width / tile.getBoundingClientRect().width
    })
    const arrows = tokens
      .map((token) => token.querySelector<HTMLElement>(':scope > i'))
      .filter((arrow): arrow is HTMLElement => Boolean(arrow))
      .map((arrow) => ({
        fontSize: getComputedStyle(arrow).fontSize,
        top: getComputedStyle(arrow).top,
        left: getComputedStyle(arrow).left,
        transform: getComputedStyle(arrow).transform,
      }))
    const rect = element.getBoundingClientRect()
    return {
      boardRatio: rect.width / rect.height,
      tileRatios,
      tokenRatios,
      arrows,
    }
  })

  expect(Math.abs(geometry.boardRatio - 13 / 9)).toBeLessThan(0.03)
  for (const ratio of geometry.tileRatios) expect(Math.abs(ratio - 1)).toBeLessThan(0.04)
  for (const ratio of geometry.tokenRatios) expect(ratio).toBeLessThanOrEqual(0.82)
  expect(geometry.arrows.length).toBeGreaterThanOrEqual(2)
  expect(new Set(geometry.arrows.map((arrow) => arrow.fontSize)).size).toBe(1)
  expect(new Set(geometry.arrows.map((arrow) => arrow.top)).size).toBe(1)
  expect(new Set(geometry.arrows.map((arrow) => arrow.left)).size).toBe(1)
}

test('uses the medium arena for Guided Fundamentals and keeps the PvE surrender/result UI intact', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'laptop-chromium', 'Focused battle UI regression')
  test.slow()

  const identity = uniqueIdentity('GuidedMedium')
  await provisionAccountAndEnterCharacter({
    page,
    email: identity.email,
    password: 'AurevaneTest!42',
    characterName: identity.characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
  await expect(page.getByText('Duel Yard', { exact: true })).toBeVisible()
  await expect(page.getByText(/9×7/)).toBeVisible()
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  await expect(root.locator('#battlefield [data-board-auto-fit]')).toHaveAttribute(
    'data-board-auto-fit',
    '9x7',
  )
  await expect(root.locator('#battlefield button[aria-label^="Tile "]')).toHaveCount(63)

  await root.getByRole('button', { name: 'Surrender', exact: true }).click()
  await expectSurrenderActionsInline(page)
  await page.getByRole('dialog', { name: 'Surrender this battle?' }).getByRole('button', {
    name: 'Confirm Surrender',
  }).click()

  const result = page.getByTestId('battle-result-overlay')
  await expect(result).toBeVisible()
  await expect(result.getByRole('heading', { name: 'Defeat' })).toBeVisible()
  await expect(result.getByRole('button', { name: 'Return to Battle Hall' })).toBeVisible()
  await expect(result.getByRole('button', { name: 'Run Lesson Again' })).toBeVisible()
})

test('keeps large PvP tiles square, scales tokens down, and preserves the shared surrender/result UI', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name === 'laptop-chromium', 'Focused battle UI regression')
  test.slow()

  const mobile = testInfo.project.name === 'mobile-chromium'
  const options = mobile
    ? {
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      }
    : { baseURL: 'http://127.0.0.1:3100', viewport: { width: 1440, height: 900 } }
  const hostContext = await browser.newContext(options)
  const guestContext = await browser.newContext(options)
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  const password = 'AurevaneTest!42'
  const hostIdentity = uniqueIdentity('LargeHost')
  const guestIdentity = uniqueIdentity('LargeGuest')

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
    await host
      .getByRole('group', { name: 'Map size' })
      .getByRole('button', { name: 'Large' })
      .click()
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

    const root = host.locator("main[data-unified-battle='true'][data-battle-kind='pvp']")
    await expect(root).toBeVisible()
    await expectLargeBoardGeometry(root)

    await root.getByRole('button', { name: 'Surrender', exact: true }).click()
    await expectSurrenderActionsInline(host)
    await host
      .getByRole('dialog', { name: 'Surrender this battle?' })
      .getByRole('button', { name: 'Confirm Surrender' })
      .click()

    const result = host.getByTestId('pvp-battle-result-overlay')
    await expect(result).toBeVisible({ timeout: 20_000 })
    await expect(result.getByRole('heading', { name: /Defeat|Draw/ })).toBeVisible()
    await expect(result.getByRole('button', { name: 'Return to Battle Hall' })).toBeVisible()
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
