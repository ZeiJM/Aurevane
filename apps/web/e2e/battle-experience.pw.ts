import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('resolves Guided Fundamentals through authoritative battle criteria', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p26-${projectSlug}-${Date.now()}@example.com`
  const password = 'P26-browser-battle-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.getByRole('button', { name: 'Navigation' }).click()
  const battleHallLink = page.getByRole('link', { name: /Battle Hall/ })
  await battleHallLink.focus()
  await expect(battleHallLink).toBeFocused()
  await battleHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const fullBattlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  await expect(fullBattlefield).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(63)
  await expect(fullBattlefield.locator('[data-board-auto-fit="9x7"]')).toHaveCount(1)
  await expectBattlefieldContained(page)

  const standardCriteriaButton = page.getByRole('button', { name: /Victory conditions/i })
  await expect(standardCriteriaButton).toBeVisible()
  await standardCriteriaButton.click()
  const standardWinDialog = page.getByRole('dialog', { name: /Victory conditions/i })
  await expect(standardWinDialog).toBeVisible()
  await expect(standardWinDialog).toContainText('Defeat all opposing combatants')
  await standardWinDialog.getByRole('button', { name: 'Return to battle' }).click()

  await page.getByRole('button', { name: 'Surrender', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Surrender this battle?' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm Surrender' }).click()
  await expect(page.getByTestId('battle-result-overlay')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible()
  await page.getByRole('button', { name: 'Return to Battle Hall' }).click()
  await expect(page).toHaveURL(/\/game\/battle$/)
  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()

  await page.getByLabel('Battle mode').selectOption('guided-fundamentals')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const commandContext = commandDeck.locator(':scope > div').first()
  const inspectButton = commandDeck.getByRole('button', { name: /Inspect/ })
  const moveButton = commandDeck.getByRole('button', { name: /Move/ })
  const attackButton = commandDeck.getByRole('button', { name: /Basic Attack/ })
  const guardButton = commandDeck.getByRole('button', { name: /Guard/ })
  const finishButton = commandDeck.getByRole('button', { name: /Finish Turn/ })
  const facingPad = commandDeck.locator('[data-unified-facing-pad="true"]')
  const confirmButton = page.getByRole('button', { name: 'Confirm Action' })
  const criteriaButton = page.getByRole('button', { name: /Victory conditions/i })

  await expect(
    page.getByRole('dialog', { name: 'Complete the tactical fundamentals' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Continue training' }).click()

  await expect(battlefield).toBeVisible()
  await expect(commandDeck).toBeVisible()
  await expect(criteriaButton).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(63)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(commandContext).toContainText('Choose your action')
  await expect(page.getByText(/100 AP/).first()).toBeVisible()
  const fittedBoard = battlefield.locator('[data-board-auto-fit="9x7"]')
  await expect(fittedBoard).toHaveCount(1)
  await expectBattlefieldContained(page)

  await expect(page.getByRole('button', { name: /^Chat/ })).toHaveCount(0)

  if (testInfo.project.name === 'mobile-chromium') {
    const playerTile = page.getByRole('button', {
      name: new RegExp(`occupied by ${characterName}`),
    })
    const recruitTile = page.getByRole('button', { name: /occupied by Recruit/ })
    const combatantDialog = page.getByRole('dialog', { name: `${characterName} battle details` })
    await playerTile.click()
    await expect(combatantDialog).toHaveCount(0)
    await inspectButton.click()
    await playerTile.click()
    await expect(combatantDialog).toBeVisible()
    await expect(combatantDialog.getByText('Initiative', { exact: true })).toBeVisible()
    await page.mouse.click(1, 1)
    await expect(combatantDialog).toHaveCount(0)
    await expect(playerTile).toBeVisible()
    await expect(recruitTile).toBeVisible()
    await expect(page.getByRole('button', { name: `Inspect ${characterName}`, exact: true })).toBeHidden()
  } else {
    await inspectButton.click()
    const playerRailButton = page.getByRole('button', {
      name: `Inspect ${characterName}`,
      exact: true,
    })
    const recruitRailButton = page.getByRole('button', { name: 'Inspect Recruit', exact: true })
    await playerRailButton.click()
    const combatantDialog = page.getByRole('dialog', { name: `${characterName} battle details` })
    await expect(combatantDialog).toBeVisible()
    await expect(combatantDialog.getByText('Initiative', { exact: true })).toBeVisible()
    await expect(combatantDialog.getByText('AP', { exact: true })).toHaveCount(0)
    await page.mouse.click(1, 1)
    await expect(combatantDialog).toHaveCount(0)
    const playerRail = playerRailButton.locator('..')
    const recruitRail = recruitRailButton.locator('..')
    await expect(playerRail.getByText(characterName, { exact: true })).toBeVisible()
    await expect(recruitRail.getByText('Recruit', { exact: true })).toBeVisible()
    const playerTokenName = page
      .getByRole('button', { name: new RegExp(`occupied by ${characterName}`) })
      .locator(':scope > span:last-child > strong')
    const recruitTokenName = page
      .getByRole('button', { name: /occupied by Recruit/ })
      .locator(':scope > span:last-child > strong')
    await expect(playerTokenName).toBeHidden()
    await expect(recruitTokenName).toBeHidden()
  }
  await expectBattlefieldReadable(page)
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await moveButton.click()
  await expect(commandContext).toContainText('Move · 25 AP per normal tile')
  await expect(commandContext).toContainText('Rough ground costs 50 AP')
  await page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ }).click()
  await expect(commandContext).toContainText('100 AP')
  await expect(commandContext).toContainText('0 AP left')
  if (testInfo.project.name !== 'mobile-chromium') {
    await expect(battlefield.getByText('0', { exact: true })).toHaveCount(1)
    await expect(
      page
        .getByRole('button', { name: new RegExp(`occupied by ${characterName}`) })
        .locator(':scope > span:last-child'),
    ).toHaveCount(1)
  }
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(commandContext).toContainText('Movement committed. 0 AP remains.')
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  )
  await expect(attackButton).toBeDisabled()
  await expect(criteriaButton).toHaveAttribute('data-new-progress', 'true')
  await expect(
    page.getByRole('dialog', { name: 'Complete the tactical fundamentals' }),
  ).toHaveCount(0)
  await openCriteriaAndClose(page, '1/4 complete')
  await expect(criteriaButton).not.toHaveAttribute('data-new-progress', 'true')

  await expect(facingPad).toBeHidden()
  await finishCurrentTurn(finishButton, testInfo.project.name)

  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
    { timeout: 15_000 },
  )
  await expect(commandContext).toContainText('Choose your action', { timeout: 15_000 })
  await expect(facingPad).toBeHidden()
  await expect(criteriaButton).toHaveAttribute('data-new-progress', 'true')
  await expect(
    page.getByRole('dialog', { name: 'Complete the tactical fundamentals' }),
  ).toHaveCount(0)

  // Guided Fundamentals now uses the full 9x7 Duel Yard. Traverse a second movement turn toward
  // the Recruit before completing Guard/Attack so the lesson remains deterministic at medium scale.
  await moveButton.click()
  await chooseReachableTowardRecruit(battlefield)
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await finishCurrentTurn(finishButton, testInfo.project.name)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
    { timeout: 15_000 },
  )
  await expect(commandContext).toContainText('Choose your action', { timeout: 15_000 })

  if (testInfo.project.name === 'mobile-chromium') {
    await guardButton.tap()
  } else {
    await guardButton.click()
  }
  await expect(commandContext).toContainText('Guard ready')
  await expect(battlefield.locator('button[data-target="friendly"]')).toHaveCount(1)
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(commandContext).toContainText('Guarded for 2 turns', { timeout: 10_000 })
  await expect(criteriaButton).toHaveAttribute('data-new-progress', 'true')
  await openCriteriaAndClose(page, '3/4 complete')

  const roundButton = page.getByRole('button', { name: /Round .*Combat Log/ })
  const battleLog = page.getByTestId('battle-log-panel')
  await roundButton.click()
  await expect(battleLog).toBeVisible()
  await expect(battleLog).toContainText(characterName)
  await expect(battleLog).toContainText(/moved|Guard/)
  await expect(battleLog).not.toContainText(/\bv\d+\b/)
  await expect(battleLog).not.toContainText('rollBasisPoints')
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: 'Close battle log' }).click()
  } else {
    await roundButton.click()
    await expect(battleLog).toHaveCount(0)
    await roundButton.click()
    await expect(battleLog).toBeVisible()
  }

  await attackButton.click()
  if ((await battlefield.locator('button[data-target="enemy"]').count()) === 0) {
    await moveButton.click()
    await chooseReachableTowardRecruit(battlefield, true)
    await expect(confirmButton).toBeEnabled()
    await confirmButton.click()
    await attackButton.click()
  }

  const recruitTarget = page.getByRole('button', { name: /occupied by Recruit/ })
  await expect(battlefield.locator('button[data-target="enemy"]')).toHaveCount(1)
  await expect(recruitTarget).toHaveAttribute('data-target', 'enemy')
  await recruitTarget.click()
  await expect(commandContext).toContainText('Basic Attack ready')
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()

  const result = page.getByTestId('battle-result-overlay')
  await expect(result).toBeVisible({ timeout: 15_000 })
  await expect(result).toContainText('Training Complete')
  await expect(result).toContainText('Guided Fundamentals')
  await expect(result).toContainText('no Character XP, Mastery, loot, Crowns, PvP rating')
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

async function chooseReachableTowardRecruit(
  battlefield: ReturnType<import('@playwright/test').Page['locator']>,
  adjacentOnly = false,
): Promise<void> {
  const reachable = battlefield.locator('button[data-reachable]')
  await expect.poll(() => reachable.count()).toBeGreaterThan(0)

  const targetLabel = await reachable.evaluateAll((tiles, requireAdjacent) => {
    const parse = (label: string | null): { x: number; y: number } | null => {
      const match = label?.match(/^Tile\s+(\d+),\s*(\d+)/i)
      return match ? { x: Number(match[1]), y: Number(match[2]) } : null
    }
    const board = tiles[0]?.closest('[data-board-auto-fit]')
    const recruit = board?.querySelector<HTMLButtonElement>(
      'button[aria-label*="occupied by Recruit"]',
    )
    const recruitPosition = parse(recruit?.getAttribute('aria-label') ?? null)
    if (!recruitPosition) return null

    const candidates = tiles
      .map((tile) => {
        const element = tile as HTMLButtonElement
        const position = parse(element.getAttribute('aria-label'))
        if (!position) return null
        return {
          label: element.getAttribute('aria-label'),
          distance:
            Math.abs(position.x - recruitPosition.x) + Math.abs(position.y - recruitPosition.y),
          open: element.dataset.terrain === 'open',
        }
      })
      .filter(
        (candidate): candidate is { label: string; distance: number; open: boolean } =>
          Boolean(candidate?.label),
      )
      .filter((candidate) => !requireAdjacent || candidate.distance === 1)
      .sort((left, right) => left.distance - right.distance || Number(right.open) - Number(left.open))

    return candidates[0]?.label ?? null
  }, adjacentOnly)

  expect(targetLabel).not.toBeNull()
  await battlefield.getByRole('button', { name: targetLabel!, exact: true }).click()
}

async function finishCurrentTurn(
  finishButton: ReturnType<import('@playwright/test').Page['locator']>,
  projectName: string,
): Promise<void> {
  if (projectName === 'mobile-chromium') {
    await expect(finishButton).toContainText('Choose facing + end')
    await finishButton.tap()
    await new Promise((resolve) => setTimeout(resolve, 80))
    await finishButton.tap()
  } else {
    await expect(finishButton).toContainText('Keep facing + end')
    await finishButton.click()
  }
}

async function openCriteriaAndClose(
  page: import('@playwright/test').Page,
  expectedProgress: string,
): Promise<void> {
  await page.getByRole('button', { name: /Victory conditions/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Complete the tactical fundamentals' })
  await expect(dialog).toBeVisible({ timeout: 4_000 })
  await expect(dialog).toContainText(expectedProgress)
  await dialog.getByRole('button', { name: 'Continue training' }).click()
}

async function expectBattlefieldReadable(page: import('@playwright/test').Page): Promise<void> {
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const box = await battlefield.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThan(280)
  expect(box.height).toBeGreaterThan(180)
  await expect(page.getByRole('button', { name: /^Tile / }).first()).toBeVisible()
}

async function expectBattlefieldContained(page: import('@playwright/test').Page): Promise<void> {
  const bounds = await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('#battlefield [data-board-auto-fit]')
    const viewport = board?.parentElement
    if (!board || !viewport) return null
    const boardRect = board.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()
    return {
      board: {
        left: boardRect.left,
        top: boardRect.top,
        right: boardRect.right,
        bottom: boardRect.bottom,
      },
      viewport: {
        left: viewportRect.left,
        top: viewportRect.top,
        right: viewportRect.right,
        bottom: viewportRect.bottom,
      },
    }
  })

  expect(bounds).not.toBeNull()
  if (!bounds) return
  expect(bounds.board.left).toBeGreaterThanOrEqual(bounds.viewport.left - 1)
  expect(bounds.board.top).toBeGreaterThanOrEqual(bounds.viewport.top - 1)
  expect(bounds.board.right).toBeLessThanOrEqual(bounds.viewport.right + 1)
  expect(bounds.board.bottom).toBeLessThanOrEqual(bounds.viewport.bottom + 1)
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}
