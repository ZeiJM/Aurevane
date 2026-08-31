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

  const geometry = await Promise.all([stay.boundingBox(), confirm.boundingBox()])
  expect(geometry[0]).not.toBeNull()
  expect(geometry[1]).not.toBeNull()
  expect(Math.abs(geometry[0]!.y - geometry[1]!.y)).toBeLessThanOrEqual(2)
  expect(geometry[0]!.x + geometry[0]!.width).toBeLessThanOrEqual(geometry[1]!.x + 2)
}

async function expectCanonicalFacingIndicators(root: ReturnType<Page['locator']>) {
  const indicators = root.locator('[data-battle-facing-indicator="true"]')
  await expect.poll(() => indicators.count()).toBeGreaterThanOrEqual(2)

  const geometry = await indicators.evaluateAll((elements) =>
    elements.map((element) => {
      const indicator = element as HTMLElement
      const token = indicator.parentElement as HTMLElement
      const indicatorRect = indicator.getBoundingClientRect()
      const tokenRect = token.getBoundingClientRect()
      return {
        width: indicatorRect.width,
        height: indicatorRect.height,
        centerOffset:
          indicatorRect.left + indicatorRect.width / 2 - (tokenRect.left + tokenRect.width / 2),
        topOffset: indicatorRect.top - tokenRect.top,
        path: indicator.querySelector('path')?.getAttribute('d') ?? '',
      }
    }),
  )

  expect(geometry.length).toBeGreaterThanOrEqual(2)
  const reference = geometry[0]!
  for (const indicator of geometry) {
    expect(Math.abs(indicator.width - reference.width)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(indicator.height - reference.height)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(indicator.centerOffset)).toBeLessThanOrEqual(0.75)
    expect(Math.abs(indicator.topOffset - reference.topOffset)).toBeLessThanOrEqual(0.75)
    expect(indicator.path).toBe(reference.path)
  }

  const rotations = await indicators.first().evaluate((element) => {
    const indicator = element as HTMLElement
    const token = indicator.parentElement as HTMLElement
    const original = indicator.dataset.facing
    const directions = ['north', 'east', 'south', 'west'] as const
    const samples = directions.map((direction) => {
      indicator.dataset.facing = direction
      const indicatorRect = indicator.getBoundingClientRect()
      const tokenRect = token.getBoundingClientRect()
      return {
        direction,
        width: indicatorRect.width,
        height: indicatorRect.height,
        centerOffset:
          indicatorRect.left + indicatorRect.width / 2 - (tokenRect.left + tokenRect.width / 2),
        topOffset: indicatorRect.top - tokenRect.top,
        transform: getComputedStyle(indicator).transform,
      }
    })
    if (original) indicator.dataset.facing = original
    return samples
  })

  const rotationReference = rotations[0]!
  expect(new Set(rotations.map((sample) => sample.transform)).size).toBe(4)
  for (const sample of rotations) {
    expect(Math.abs(sample.width - rotationReference.width)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(sample.height - rotationReference.height)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(sample.centerOffset)).toBeLessThanOrEqual(0.75)
    expect(Math.abs(sample.topOffset - rotationReference.topOffset)).toBeLessThanOrEqual(0.75)
  }
}

async function expectLargeBoardGeometry(root: ReturnType<Page['locator']>) {
  const board = root.locator('#battlefield [data-board-auto-fit]')
  await expect(board).toHaveAttribute('data-board-auto-fit', '13x9')
  await expect(board.locator('button[aria-label^="Tile "]')).toHaveCount(117)

  const geometry = await board.evaluate((element) => {
    const tiles = Array.from(
      element.querySelectorAll<HTMLButtonElement>('button[aria-label^="Tile "]'),
    )
    const occupied = tiles.filter((tile) =>
      tile.getAttribute('aria-label')?.includes('occupied by'),
    )
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
    const indicators = tokens
      .map((token) =>
        token.querySelector<HTMLElement>(':scope > [data-battle-facing-indicator="true"]'),
      )
      .filter((indicator): indicator is HTMLElement => Boolean(indicator))
      .map((indicator) => {
        const rect = indicator.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          top: getComputedStyle(indicator).top,
          left: getComputedStyle(indicator).left,
          path: indicator.querySelector('path')?.getAttribute('d') ?? '',
        }
      })
    const rect = element.getBoundingClientRect()
    return {
      boardRatio: rect.width / rect.height,
      tileRatios,
      tokenRatios,
      indicators,
    }
  })

  expect(Math.abs(geometry.boardRatio - 13 / 9)).toBeLessThan(0.03)
  for (const ratio of geometry.tileRatios) expect(Math.abs(ratio - 1)).toBeLessThan(0.04)
  for (const ratio of geometry.tokenRatios) expect(ratio).toBeLessThanOrEqual(0.82)
  expect(geometry.indicators.length).toBeGreaterThanOrEqual(2)
  expect(new Set(geometry.indicators.map((indicator) => indicator.width.toFixed(2))).size).toBe(1)
  expect(new Set(geometry.indicators.map((indicator) => indicator.height.toFixed(2))).size).toBe(1)
  expect(new Set(geometry.indicators.map((indicator) => indicator.top)).size).toBe(1)
  expect(new Set(geometry.indicators.map((indicator) => indicator.left)).size).toBe(1)
  expect(new Set(geometry.indicators.map((indicator) => indicator.path)).size).toBe(1)
}

async function sampleGuidedBoardAcrossFinishTurn(
  page: Page,
  root: ReturnType<Page['locator']>,
  board: ReturnType<Page['locator']>,
  mobile: boolean,
) {
  const baseline = await board.boundingBox()
  expect(baseline).not.toBeNull()
  if (!baseline) return

  await board.evaluate((element) => {
    const state = window as typeof window & {
      __guidedBoardSamples?: Array<{ width: number; height: number; fit: string | undefined }>
      __stopGuidedBoardSamples?: boolean
    }
    state.__guidedBoardSamples = []
    state.__stopGuidedBoardSamples = false
    const sample = () => {
      const rect = element.getBoundingClientRect()
      state.__guidedBoardSamples?.push({
        width: rect.width,
        height: rect.height,
        fit: (element as HTMLElement).dataset.boardAutoFit,
      })
      if (!state.__stopGuidedBoardSamples) window.requestAnimationFrame(sample)
    }
    sample()
  })

  const finalTurnResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/final-turn'),
  )
  const recruitTurnResponse = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/recruit-turn'),
  )
  const finish = root.getByRole('button', { name: /Finish Turn/ })
  await expect(finish).toContainText('Choose facing + end')

  if (mobile) {
    await finish.tap()
    await page.waitForTimeout(80)
    await finish.tap()
  } else {
    await finish.click()
    await finish.press('KeyD')
  }

  await finalTurnResponse
  await recruitTurnResponse
  await expect(root).toHaveAttribute('data-local-turn', 'true', { timeout: 15_000 })

  const samples = await page.evaluate(() => {
    const state = window as typeof window & {
      __guidedBoardSamples?: Array<{ width: number; height: number; fit: string | undefined }>
      __stopGuidedBoardSamples?: boolean
    }
    state.__stopGuidedBoardSamples = true
    return state.__guidedBoardSamples ?? []
  })

  expect(samples.length).toBeGreaterThan(5)
  for (const sample of samples) {
    expect(sample.fit).toBe('9x7')
    expect(Math.abs(sample.width - baseline.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(sample.height - baseline.height)).toBeLessThanOrEqual(1)
  }
}

test('uses medium Guided Fundamentals and keeps PvE surrender/results', async ({
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
  const board = root.locator('#battlefield [data-board-auto-fit]')
  await expect(board).toHaveAttribute('data-board-auto-fit', '9x7')
  await expect(board.locator('button[aria-label^="Tile "]')).toHaveCount(63)

  const coach = page.getByRole('dialog', { name: 'Complete the tactical fundamentals' })
  await expect(coach).toBeVisible()
  await coach.getByRole('button', { name: 'Continue training' }).click()

  await expectCanonicalFacingIndicators(root)
  await sampleGuidedBoardAcrossFinishTurn(
    page,
    root,
    board,
    testInfo.project.name === 'mobile-chromium',
  )

  await root.getByRole('button', { name: 'Surrender', exact: true }).click()
  await expectSurrenderActionsInline(page)
  await page
    .getByRole('dialog', { name: 'Surrender this battle?' })
    .getByRole('button', { name: 'Confirm Surrender' })
    .click()

  const result = page.getByTestId('battle-result-overlay')
  await expect(result).toBeVisible()
  await expect(result.getByRole('heading', { name: 'Defeat' })).toBeVisible()
  await expect(result.getByRole('button', { name: 'Return to Battle Hall' })).toBeVisible()
  await expect(result.getByRole('button', { name: 'Run Lesson Again' })).toBeVisible()
})

test('keeps large PvP geometry, tokens, surrender, and results', async ({ browser }, testInfo) => {
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
    await expectCanonicalFacingIndicators(root)

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
