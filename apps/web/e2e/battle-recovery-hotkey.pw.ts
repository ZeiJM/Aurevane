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

test('retains default HP Recovery keyboard input without exposing the deferred Recovery menu', async ({
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
  await expect(root.locator('[data-battle-secondary-actions]')).toHaveCount(0)
  await page.keyboard.press('KeyR')
  await expect(targetForecast(page)).toContainText('HP Recovery')
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await root.getByRole('button', { name: 'Cancel Action' }).click()
  // Move focus off the footer button so Enter remains a battle shortcut.
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('KeyR')
  await expect(targetForecast(page)).toContainText('HP Recovery')
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await expect(deck.locator('[data-battle-skill-slot]')).toHaveCount(4)
  await page.keyboard.press('Enter')
  await expect(economy).toHaveAttribute('aria-valuenow', '50')
  await expect(root.locator('[data-battle-secondary-actions]')).toHaveCount(0)
})
