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

async function openTechniques(page: Page) {
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  await expect(dialog).toBeVisible()
  return dialog
}

test('favorite Technique is visible, character-scoped, persistent, unique per category, and becomes the battle default', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated desktop Chromium proof covers persistence into battle.',
  )

  const characterName = uniqueCharacterName()
  await provisionAccountAndEnterCharacter({
    page,
    email: `favorite-technique-${Date.now()}@example.com`,
    password: 'Favorite-technique-2026!',
    characterName,
  })

  let dialog = await openTechniques(page)
  const allStars = dialog.locator('button[data-favorite-technique-star="true"]')
  await expect(allStars.first()).toBeVisible()
  expect(await allStars.count()).toBeGreaterThan(0)

  const forceful = skillCard(page, 'Forceful Strike')
  const forcefulCheckbox = forceful.getByRole('checkbox')
  const forcefulStar = forceful.locator('button[data-favorite-technique-star="true"]')
  await expect(forcefulStar).toHaveCount(1)
  await expect(forcefulStar).toBeVisible()
  if (!(await forcefulCheckbox.isChecked())) {
    await expect(forcefulStar).toBeDisabled()
    await forcefulCheckbox.click()
  }
  await expect(forcefulStar).toBeEnabled()
  await expect(forcefulStar).toHaveAttribute('data-favorite-technique-id', /forceful-strike/)
  await expect(forcefulStar).toHaveAttribute(
    'aria-label',
    'Set Forceful Strike as favorite Attack Technique',
  )
  await forcefulStar.click()
  await expect(forcefulStar).toHaveAttribute('aria-pressed', 'true')

  const essenceHeading = page.getByTestId('active-essence')
  await expect(essenceHeading).toContainText('Unbroken Strike')
  const essenceCard = essenceHeading.locator('xpath=ancestor::article[1]')
  const essenceStar = essenceCard.locator('button[data-favorite-technique-star="true"]')
  await expect(essenceStar).toHaveCount(1)
  await expect(essenceStar).toBeVisible()
  await expect(essenceStar).toHaveAttribute('data-favorite-technique-id', /unbroken-strike/)
  await essenceStar.click()

  await expect(essenceStar).toHaveAttribute('aria-pressed', 'true')
  await expect(forcefulStar).toHaveAttribute('aria-pressed', 'false')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.reload()
  dialog = await openTechniques(page)
  const persistedEssenceStar = page
    .getByTestId('active-essence')
    .locator('xpath=ancestor::article[1]')
    .locator('button[data-favorite-technique-star="true"]')
  await expect(persistedEssenceStar).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'Close' }).click()

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

test('favorite Technique controls stay visible and usable on mobile', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile favorite-control usability proof')

  await provisionAccountAndEnterCharacter({
    page,
    email: `favorite-technique-mobile-${Date.now()}@example.com`,
    password: 'Favorite-technique-2026!',
    characterName: uniqueCharacterName(),
  })

  const dialog = await openTechniques(page)
  const forceful = skillCard(page, 'Forceful Strike')
  const checkbox = forceful.getByRole('checkbox')
  const star = forceful.locator('button[data-favorite-technique-star="true"]')

  await expect(star).toBeVisible()
  const box = await star.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(28)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(28)

  if (!(await checkbox.isChecked())) await checkbox.tap()
  await expect(star).toBeEnabled()
  await star.tap()
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await expect(dialog).toBeVisible()
})
