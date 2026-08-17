import { expect, test } from '@playwright/test'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('launches the Tactical Hall and completes one authoritative player turn', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p25-${projectSlug}-${Date.now()}@example.com`
  const password = 'P25-browser-battle-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()

  await expect(page).toHaveURL(/\/game$/)
  await expect(page.getByTestId('character-creation')).toBeVisible()

  await page.getByLabel('Character name').fill(characterName)
  await page.getByRole('button', { name: 'Choose your foundation' }).click()
  await page.getByRole('button', { name: 'Review character' }).click()
  await page.getByRole('button', { name: 'Create permanent character' }).click()
  await expect(page.getByTestId('character-established')).toContainText(characterName)

  const tacticalHallLink = page.getByRole('link', { name: 'Enter Tactical Hall' })
  await tacticalHallLink.focus()
  await expect(tacticalHallLink).toBeFocused()
  await tacticalHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await expect(page.getByRole('heading', { name: 'Enter the training field' })).toBeVisible()
  await expect(
    page.locator('[data-media-status="requested"][data-media-request="ART-UI-001"]'),
  ).toBeVisible()
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.getByRole('button', { name: 'Begin exercise' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Turn Economy Tracker' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Command Deck' })).toBeVisible()
  await expect(page.getByText('Your turn', { exact: true })).toBeVisible()
  await expect(page.getByTestId('battle-facing-context')).toContainText('Recruit: front')
  expect(await hasHorizontalOverflow(page)).toBe(false)
  await expectBattlefieldAndCommandDeckInViewport(page)

  await page.getByRole('button', { name: /Move.*Build a path/ }).click()
  await page.getByRole('button', { name: /Tile 2, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await expect(page.getByText('Preview cost 1')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Command committed\. Authoritative battle version 2\./)).toBeVisible()

  await page.getByRole('button', { name: /Move.*Build a path/ }).click()
  await page.getByRole('button', { name: /Tile 3, 2; rough-ground; elevation 0/ }).click()
  await expect(page.getByText('Preview cost 2')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 3/)).toBeVisible()

  await page.getByRole('button', { name: /Move.*Build a path/ }).click()
  await page.getByRole('button', { name: /Tile 4, 2; open-ground; elevation 0/ }).click()
  await expect(page.getByText('Preview cost 1')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 4/)).toBeVisible()

  await page.getByRole('button', { name: /Basic Attack.*Target one enemy/ }).click()
  await page
    .getByRole('button', {
      name: /Tile 5, 2; open-ground; elevation 0; occupied by Recruit/,
    })
    .click()
  await expect(page.getByText('Hit chance')).toBeVisible()
  await expect(page.getByText('Base damage after armor')).toBeVisible()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 5/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Basic Attack.*Target one enemy/ })).toBeDisabled()

  await page.getByTestId('battle-log-toggle').click()
  const battleLog = page.getByTestId('battle-log-panel')
  await expect(battleLog).toContainText('Committed history')
  await expect(battleLog).toContainText('Wayfarer used Basic Attack.')
  await expect(battleLog).not.toContainText('rollBasisPoints')
  await page.getByTestId('battle-log-toggle').click()

  await page.getByRole('button', { name: 'Face east' }).click()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 6/)).toBeVisible()
  await expect(page.getByText('east →')).toBeVisible()

  await page.getByRole('button', { name: /End Turn.*Facing required/ }).click()
  await expect(page.getByText('Preview ready. Confirm to commit this command.')).toBeVisible()
  await page.getByRole('button', { name: /Confirm command/ }).click()
  await expect(page.getByText(/Authoritative battle version 7/)).toBeVisible()
  await expect(page.getByText('Opponent turn', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Move.*Build a path/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /End Turn.*Facing required/ })).toBeDisabled()

  expect(await hasHorizontalOverflow(page)).toBe(false)
  await expectBattlefieldAndCommandDeckInViewport(page)
})

async function expectBattlefieldAndCommandDeckInViewport(
  page: import('@playwright/test').Page,
): Promise<void> {
  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()
  if (!viewport) return

  const battlefield = await page.getByRole('region', { name: 'Tactical battlefield' }).boundingBox()
  const commandDeck = await page.getByRole('region', { name: 'Command Deck' }).boundingBox()
  expect(battlefield).not.toBeNull()
  expect(commandDeck).not.toBeNull()
  if (!battlefield || !commandDeck) return

  expect(battlefield.y).toBeGreaterThanOrEqual(0)
  expect(battlefield.y).toBeLessThan(viewport.height)
  expect(commandDeck.y).toBeGreaterThanOrEqual(0)
  expect(commandDeck.y + Math.min(commandDeck.height, 48)).toBeLessThanOrEqual(viewport.height + 1)
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}
