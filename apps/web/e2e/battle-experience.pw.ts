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

  const tacticalHallLink = page.getByRole('link', { name: 'Tactical Hall' })
  await tacticalHallLink.focus()
  await expect(tacticalHallLink).toBeFocused()
  await tacticalHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await expect(page.getByRole('heading', { name: 'Choose a practice' })).toBeVisible()
  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-UI-001"]'),
  ).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('button', { name: /GUIDED LESSON.*Strike Drill/ }).click()
  await page.getByRole('button', { name: 'Start Strike Drill' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const battlefield = page.getByRole('region', { name: 'Tactical battlefield' })
  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const moveButton = commandDeck.getByRole('button', { name: /Move/ })
  const attackButton = commandDeck.getByRole('button', { name: /Basic Attack/ })
  const finishButton = commandDeck.getByRole('button', { name: /Finish Turn/ })
  const confirmButton = page.getByRole('button', { name: 'Confirm action' })

  await expect(battlefield).toBeVisible()
  await expect(commandDeck).toBeVisible()
  await expect(page.getByRole('button', { name: /^Tile / })).toHaveCount(15)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
  await expect(page.getByText(characterName, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Recruit', { exact: true }).first()).toBeVisible()
  await expectBattlefieldReadable(page)
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await moveButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'Move · 10% per normal tile',
  )
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Rough ground costs 20%')
  await page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Movement path ready')
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'leaves 70% Action Economy',
  )
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(
    'Movement committed. 70% Action Economy remains.',
  )
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '70',
  )

  await attackButton.click()
  await page.getByRole('button', { name: /occupied by Recruit/ }).click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText('Basic Attack ready')
  await expect(confirmButton).toBeEnabled()
  await confirmButton.click()
  await expect(page.getByTestId('combat-mode-instruction')).toContainText(/Basic Attack/)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '40',
  )
  await expect(attackButton).toBeEnabled()

  const roundButton = page.getByRole('button', { name: /Round 1.*Combat Log/ })
  await roundButton.click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toBeVisible()
  await expect(battleLog).toContainText(characterName)
  await expect(battleLog).toContainText(/moved|Basic Attack/)
  await expect(battleLog).not.toContainText('rollBasisPoints')
  await page.getByRole('button', { name: 'Close combat log' }).click()

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
