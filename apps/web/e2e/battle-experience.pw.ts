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

test('resolves a readable authoritative player and Recruit combat loop', async ({
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
  await expect(page.getByRole('heading', { name: 'Choose a battle.' })).toBeVisible()
  const requestedUiArt = page.locator(
    '[data-media-status="requested"][data-media-request="ART-UI-001"]',
  )
  expect(await requestedUiArt.count()).toBeGreaterThan(0)
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('button', { name: /Strike Drill/ }).click()
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const moveButton = commandDeck.getByRole('button', { name: /Move/ })
  const attackButton = commandDeck.getByRole('button', { name: /Basic Attack/ })
  const guardButton = commandDeck.getByRole('button', { name: /Guard/ })
  const finishButton = commandDeck.getByRole('button', { name: /Finish Turn/ })
  const confirmButton = page.getByRole('button', { name: 'Confirm Action' })

  await expect(battlefield).toBeVisible()
  await expect(commandDeck).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(15)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Choose your action')
  await expect(page.getByText(/100 AP/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Chat', exact: true }).click()
  await page.getByLabel('Battle chat message').fill('Testing solo battle chat')
  await page.getByRole('button', { name: 'Choose emoji' }).click()
  await page.getByRole('button', { name: 'Insert ⚔️' }).click()
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Testing solo battle chat⚔️', { exact: true })).toBeVisible()
  await page.mouse.click(1, 1)
  await expect(page.getByLabel('Battle chat message')).toHaveCount(0)

  await page.getByRole('button', { name: `Show ${characterName} combat details` }).click()
  await expect(page.getByText(`${characterName} · combat details`)).toBeVisible()
  await expect(page.getByText('Initiative', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close combatant details' }).click()
  await expect(page.getByText(characterName, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Recruit', { exact: true }).first()).toBeVisible()
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

  await finishButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'direction you choose immediately ends the turn',
  )
  await page.getByRole('button', { name: 'Face east' }).click()

  await expect(page.getByTestId('combat-mode-instruction')).toContainText(/Recruit:/, {
    timeout: 15_000,
  })
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
    { timeout: 15_000 },
  )

  if (testInfo.project.name === 'mobile-chromium') {
    await guardButton.tap()
    await guardButton.tap()
  } else {
    await guardButton.dblclick()
  }
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Guarded for 2 turns', {
    timeout: 10_000,
  })
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '70',
  )

  await attackButton.click()
  const rangedTiles = battlefield.locator('button[data-attack-range]')
  await expect(rangedTiles).toHaveCount(15)
  await expect(battlefield.locator('button[data-attack-range="legal"]')).not.toHaveCount(0)
  await expect(battlefield.locator('button[data-attack-range="illegal"]')).not.toHaveCount(0)
  await page.getByRole('button', { name: /occupied by Recruit/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Basic Attack ready')
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(/Basic Attack/)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '40',
  )

  const roundButton = page.getByRole('button', { name: /Round .*Combat Log/ })
  await roundButton.click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toBeVisible()
  await expect(battleLog).toContainText(characterName)
  await expect(battleLog).toContainText(/moved|Basic Attack/)
  await expect(battleLog).not.toContainText(/\bv\d+\b/)
  await expect(battleLog).not.toContainText('rollBasisPoints')
  await page.getByRole('button', { name: 'Close combat log' }).click()

  await expect(moveButton).toBeEnabled()
  await expectBattlefieldReadable(page)
  expect(await hasHorizontalOverflow(page)).toBe(false)
})

async function expectBattlefieldReadable(page: import('@playwright/test').Page): Promise<void> {
  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const box = await battlefield.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThan(280)
  expect(box.height).toBeGreaterThan(180)
  await expect(page.getByRole('button', { name: /^Tile / }).first()).toBeVisible()
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}
