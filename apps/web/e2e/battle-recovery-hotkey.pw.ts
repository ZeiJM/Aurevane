import { expect, test } from '@playwright/test'

import { targetForecast } from './refined-battle-helpers'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Recovery ${letters}`
}

test('routes the Recovery hotkey to the stable slot after swapping HP Recovery to MP Recovery', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Desktop keyboard shortcut contract')
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `recovery-hotkey-${projectSlug}-${Date.now()}@example.com`
  const password = 'Recovery-hotkey-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const root = page.locator("main[data-unified-battle='true'][data-battle-kind='pve']")
  await expect(root).toBeVisible()
  const deck = root.getByRole('region', { name: 'Command Deck' })
  const economy = root.getByRole('progressbar', { name: 'Action Economy remaining' })
  await root.locator('[data-battle-secondary-actions] summary').click()
  await root.getByRole('button', { name: 'MP Recovery · 50 AP', exact: true }).click()
  await expect(targetForecast(page)).toContainText('MP Recovery')
  await root.getByRole('button', { name: 'Cancel Action' }).click()
  await page.keyboard.press('KeyR')
  await expect(targetForecast(page)).toContainText('MP Recovery')
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await expect(deck.locator('[data-battle-skill-slot]')).toHaveCount(4)
})
