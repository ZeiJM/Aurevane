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
  const inspectButton = commandDeck.getByRole('button', { name: /Inspect/ })
  const moveButton = commandDeck.getByRole('button', { name: /Move/ })
  const attackButton = commandDeck.getByRole('button', { name: /Basic Attack/ })
  const guardButton = commandDeck.getByRole('button', { name: /Guard/ })
  const finishButton = commandDeck.getByRole('button', { name: /Finish Turn/ })
  const confirmButton = page.getByRole('button', { name: 'Confirm Action' })
  const criteriaButton = page.getByRole('button', { name: /Victory conditions/i })

  await expect(
    page.getByRole('dialog', { name: 'Complete the tactical fundamentals' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Continue training' }).click()

  await expect(battlefield).toBeVisible()
  await expect(commandDeck).toBeVisible()
  await expect(criteriaButton).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(15)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Choose your action')
  await expect(page.getByText(/100 AP/).first()).toBeVisible()
  await expect(battlefield.locator('[data-board-auto-fit="5x3"]')).toHaveCount(1)
  await expectBattlefieldContained(page)

  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByLabel('Battle chat message').fill('Testing solo battle chat⚔️')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Testing solo battle chat⚔️', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Choose emoji' }).click()
  await expect(page.getByRole('button', { name: 'Insert ⚔️' })).toBeVisible()
  await page.mouse.click(1, 1)
  await expect(page.getByRole('group', { name: 'Recent emoji' })).toHaveCount(0)
  await expect(page.getByLabel('Battle chat message')).toBeVisible()
  await page.getByRole('button', { name: 'Close battle chat' }).click()
  await expect(page.getByLabel('Battle chat message')).toHaveCount(0)

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
    await expect(
      page.getByRole('button', { name: `Show ${characterName} combat details` }),
    ).toBeHidden()
  } else {
    await page.getByRole('button', { name: `Show ${characterName} combat details` }).click()
    await expect(page.getByText(`${characterName} · combat details`)).toBeVisible()
    await expect(page.getByText('Initiative', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Close combatant details' }).click()
    await expect(page.getByText(`${characterName} · combat details`)).toHaveCount(0)
    const playerRail = page.locator(`aside[aria-label="${characterName} combat status"]`)
    const recruitRail = page.locator('aside[aria-label="Recruit combat status"]')
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
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'Move · 25 AP per normal tile',
  )
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'Rough ground costs 50 AP',
  )
  await page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Path ready: 100 AP')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('0 AP will remain')
  await expect(confirmButton).toBeEnabled()
  await expect(page.getByText(/100 AP proposed/)).toBeVisible()
  await confirmButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'Movement committed. 0 AP remains.',
  )
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

  await finishButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'direction you choose immediately ends the turn',
  )
  await page.getByRole('button', { name: 'Face east' }).click()

  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
    { timeout: 15_000 },
  )
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Choose your action', {
    timeout: 15_000,
  })
  await expect(criteriaButton).toHaveAttribute('data-new-progress', 'true')
  await expect(
    page.getByRole('dialog', { name: 'Complete the tactical fundamentals' }),
  ).toHaveCount(0)

  if (testInfo.project.name === 'mobile-chromium') {
    await guardButton.tap()
  } else {
    await guardButton.click()
  }
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Guard ready')
  await expect(battlefield.locator('button[data-target-relation="friendly"]')).toHaveCount(1)
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Guarded for 2 turns', {
    timeout: 10_000,
  })
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '70',
  )
  await expect(criteriaButton).toHaveAttribute('data-new-progress', 'true')
  await openCriteriaAndClose(page, '3/4 complete')

  const roundButton = page.getByRole('button', { name: /Round .*Combat Log/ })
  await roundButton.click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toBeVisible()
  await expect(battleLog).toContainText(characterName)
  await expect(battleLog).toContainText(/moved|Guard/)
  await expect(battleLog).not.toContainText(/\bv\d+\b/)
  await expect(battleLog).not.toContainText('rollBasisPoints')
  await page.getByRole('button', { name: 'Close combat log' }).click()

  await attackButton.click()
  const rangedTiles = battlefield.locator('button[data-attack-range]')
  await expect(rangedTiles).toHaveCount(4)
  await expect(battlefield.locator('button[data-target-relation="enemy"]')).toHaveCount(1)
  await expect(battlefield.locator('button[data-target-relation="illegal"]')).toHaveCount(3)
  await expect(battlefield.locator('button:not([data-attack-range])')).toHaveCount(11)
  await page.getByRole('button', { name: /occupied by Recruit/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Basic Attack ready')
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()

  const result = page.getByTestId('battle-result-overlay')
  await expect(result).toBeVisible({ timeout: 15_000 })
  await expect(result).toContainText('Training Complete')
  await expect(result).toContainText('Guided Fundamentals')
  await expect(result).toContainText('no Character XP, Mastery, loot, Crowns, PvP rating')
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

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
