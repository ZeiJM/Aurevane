import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Favorite ${letters}`
}

function skillCard(page: Page, name: string) {
  return page.getByTestId('learned-skill-list').locator('article').filter({ hasText: name }).first()
}

test('favorite Technique star is unique per category and becomes the battle default', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated Chromium proof covers favorite Technique persistence into battle.',
  )

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `favorite-technique-${Date.now()}@example.com`,
    password: 'Favorite-technique-2026!',
    characterName,
  })

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  await expect(dialog).toBeVisible()

  const forceful = skillCard(page, 'Forceful Strike')
  const forcefulCheckbox = forceful.getByRole('checkbox')
  if (!(await forcefulCheckbox.isChecked())) await forcefulCheckbox.click()

  const forcefulStar = forceful.getByRole('button', {
    name: 'Set Forceful Strike as favorite Attack Technique',
  })
  await expect(forcefulStar).toBeVisible()
  await forcefulStar.click()
  await expect(forcefulStar).toHaveAttribute('aria-pressed', 'true')

  const essenceHeading = page.getByTestId('active-essence')
  await expect(essenceHeading).toContainText('Unbroken Strike')
  const essenceCard = essenceHeading.locator('xpath=ancestor::article[1]')
  const essenceStar = essenceCard.getByRole('button', {
    name: 'Set Unbroken Strike as favorite Attack Technique',
  })
  await expect(essenceStar).toBeVisible()
  await essenceStar.click()

  await expect(essenceStar).toHaveAttribute('aria-pressed', 'true')
  await expect(forcefulStar).toHaveAttribute('aria-pressed', 'false')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)

  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)

  const commandDeck = page.getByRole('region', { name: 'Command Deck' })
  const attackAction = commandDeck.locator('button[data-command-slot="attack"]')
  const attackArtwork = commandDeck
    .locator('[data-command-card="attack"]')
    .getByRole('button', { name: /Choose Attack skill/i })

  await expect(attackAction).toContainText('Unbroken Strike', { timeout: 8000 })
  await expect(attackArtwork).toHaveAttribute('data-battle-selected-skill-id', /unbroken-strike/)
})
