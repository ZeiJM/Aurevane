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

  await inspectButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Inspect mode')
  await page.getByRole('button', { name: /Tile 4, 3; rough-ground; elevation 0/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Rough ground')

  await moveButton.click()
  const playerTile = page.getByRole('button', {
    name: new RegExp(`Tile 2, 4;.*occupied by ${characterName}`),
  })
  await expect(playerTile).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Path ready:')
  await confirmButton.click()

  await attackButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Basic Attack')
  await page.getByRole('button', { name: /Cancel Action/ }).click()

  await guardButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Guard')
  await confirmButton.click()

  await finishButton.click()
  await page.getByRole('button', { name: 'Face east' }).click()

  await expect(page.getByTestId('guided-training-status')).toContainText(/completed/i)
})

async function expectBattlefieldContained(page: import('@playwright/test').Page): Promise<void> {
  const result = await page.evaluate(() => {
    const region = document.querySelector<HTMLElement>('[aria-label="Tactical battlefield"]')
    const board = region?.querySelector<HTMLElement>('[data-board-auto-fit]')
    if (!region || !board) return null
    const regionRect = region.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    return {
      contained:
        boardRect.left >= regionRect.left - 1 &&
        boardRect.right <= regionRect.right + 1 &&
        boardRect.top >= regionRect.top - 1 &&
        boardRect.bottom <= regionRect.bottom + 1,
    }
  })
  expect(result?.contained).toBe(true)
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}
