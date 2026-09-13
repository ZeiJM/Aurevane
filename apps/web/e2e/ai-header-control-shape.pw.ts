import { expect, test } from '@playwright/test'

import { expectMapKey } from './battle-map-key-helpers'
import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('keeps Map Key immediately left of Victory Conditions at desktop and mobile sizes', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `ai-header-shape-${projectSlug}-${Date.now()}@example.com`
  const password = 'AI-header-shape-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.getByRole('button', { name: 'Navigation' }).click()
  const battleHallLink = page
    .getByRole('navigation', { name: 'Game navigation', exact: true })
    .getByRole('link', { name: /Battle Hall/ })
  await battleHallLink.focus()
  await battleHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()

  const victoryConditions = page.getByRole('button', { name: /^Victory conditions/i })
  const key = page.getByRole('button', { name: 'Map Key', exact: true })
  await expect(victoryConditions).toBeVisible()
  await expect(page.getByRole('button', { name: /Round .*Combat Log/i })).toHaveCount(0)
  await expectMapKey(page)
  expect(
    await victoryConditions
      .locator('span')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(testInfo.project.name === 'mobile-chromium' ? 10 : 12)
  const victoryBox = await victoryConditions.boundingBox()
  const keyBox = await key.boundingBox()
  expect(keyBox!.x + keyBox!.width).toBeLessThanOrEqual(victoryBox!.x)
  expect(Math.abs(victoryBox!.height - keyBox!.height)).toBeLessThanOrEqual(1)
  await victoryConditions.click()
  await expect(page.getByRole('dialog', { name: /^Victory conditions/i })).toBeVisible()
  await page.getByRole('button', { name: 'Close victory conditions', exact: true }).click()
  await expect(page.getByRole('dialog', { name: /^Victory conditions/i })).toHaveCount(0)
})
