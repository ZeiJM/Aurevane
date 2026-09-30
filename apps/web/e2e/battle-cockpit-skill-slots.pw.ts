import { expect, test } from '@playwright/test'

import { expectRefinedCockpit, targetForecast } from './refined-battle-helpers'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('keeps four numbered Skill slots and secondary Recovery without changing cockpit geometry', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `skill-slot-${projectSlug}-${Date.now()}@example.com`
  const password = 'Skill-slot-browser-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle/ })
    .click()
  await expect(page).toHaveURL(/\/game\/battle$/)

  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  await expectRefinedCockpit(page)
  const deck = page.getByRole('region', { name: 'Command Deck' })
  const before = await deck.boundingBox()
  await page.locator('[data-battle-secondary-actions] summary').click()
  await expect(page.getByRole('button', { name: 'HP Recovery · 50 AP', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'MP Recovery · 50 AP', exact: true }).click()
  await expect(targetForecast(page)).toContainText('MP Recovery')
  const after = await deck.boundingBox()
  expect(after?.width).toBe(before?.width)
  await expect(page.getByRole('progressbar', { name: 'Action Economy remaining' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  )
})
