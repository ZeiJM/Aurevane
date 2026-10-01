import { expect, test } from '@playwright/test'

import { expectTerrainKey } from './battle-map-key-helpers'
import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Wayfarer ${letters}`
}

test('keeps contextual terrain help in the side key and Victory Conditions in the header', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `ai-header-shape-${projectSlug}-${Date.now()}@example.com`
  const password = 'AI-header-shape-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  const battleHallLink = page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Battle/ })
  await battleHallLink.focus()
  await battleHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()

  const victoryConditions = page.getByRole('button', { name: /^Victory conditions/i })
  await expect(victoryConditions).toBeVisible()
  await expect(page.getByRole('button', { name: /Round .*Combat Log/i })).toHaveCount(0)
  await expectTerrainKey(page)
  expect(
    await victoryConditions
      .locator('span')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(testInfo.project.name === 'mobile-chromium' ? 10 : 12)
  await expect(page.locator('[data-battle-header-utilities]')).toContainText('Victory Conditions')
  await expect(
    page.locator('aside[data-battle-side="local"] [data-battle-terrain-key="true"]'),
  ).toBeVisible()
  await victoryConditions.click()
  const objectives = page.getByRole('dialog', { name: /^Victory conditions/i })
  await expect(objectives).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(objectives).toHaveCount(0)
  await expect(victoryConditions).toBeFocused()
  await victoryConditions.click()
  await expect(objectives).toBeVisible()
  await objectives.getByRole('button', { name: /^Close /i }).click()
  await expect(objectives).toHaveCount(0)
})
