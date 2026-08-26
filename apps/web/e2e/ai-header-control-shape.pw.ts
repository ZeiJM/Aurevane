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

test('matches the desktop AI Combat Log shape to Victory Conditions without changing mobile', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `ai-header-shape-${projectSlug}-${Date.now()}@example.com`
  const password = 'AI-header-shape-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.getByRole('button', { name: 'Navigation' }).click()
  const battleHallLink = page.getByRole('link', { name: /Battle Hall/ })
  await battleHallLink.focus()
  await battleHallLink.press('Enter')

  await expect(page).toHaveURL(/\/game\/battle$/)
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('region', { name: 'Tactical battlefield' })).toBeVisible()

  const victoryConditions = page.getByRole('button', { name: /Victory conditions/i })
  const combatLog = page.getByRole('button', { name: /Round .*Combat Log/i })
  await expect(victoryConditions).toBeVisible()
  await expect(combatLog).toBeVisible()

  const victoryRadius = await victoryConditions.evaluate(
    (element) => window.getComputedStyle(element).borderTopLeftRadius,
  )
  const combatLogRadius = await combatLog.evaluate(
    (element) => window.getComputedStyle(element).borderTopLeftRadius,
  )

  if (testInfo.project.name === 'mobile-chromium') {
    expect(combatLogRadius).toBe('999px')
    expect(combatLogRadius).not.toBe(victoryRadius)
  } else {
    expect(combatLogRadius).toBe(victoryRadius)
    expect(combatLogRadius).not.toBe('999px')
  }
})
