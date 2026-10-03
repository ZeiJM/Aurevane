import { expect, test } from '@playwright/test'

import { moveOneStep } from './refined-battle-helpers'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  return `Walker ${
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '') || 'clear'
  }`
}

test('WASD and arrows each submit one authoritative adjacent Move', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop Chromium proof covers real keyboard Move execution.',
  )
  test.slow()

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `wasd-backtrack-${Date.now()}@example.com`,
    password: 'WASD-backtrack-2026!',
    characterName,
  })

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const economy = page.getByRole('progressbar', { name: 'Action Economy remaining' })
  await expect(economy).toHaveAttribute('aria-valuenow', '100')
  await moveOneStep(page, characterName, 'wasd')
  await expect(economy).toHaveAttribute('aria-valuenow', '80')
  await moveOneStep(page, characterName, 'arrows')
  await expect(economy).toHaveAttribute('aria-valuenow', '60')
})
