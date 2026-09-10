import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Mobile ${letters}`
}

test('mobile Character Profile keeps loadout controls centered and portrait optically balanced', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'This proof targets the mobile Character Profile presentation only.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `profile-mobile-${Date.now()}@example.com`,
    password: 'Profile-mobile-polish-2026!',
    characterName: uniqueCharacterName(),
  })

  const profile = page.getByTestId('character-profile')
  const portrait = profile.getByRole('img', { name: /portrait$/ }).locator('..')
  const techniqueButton = page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })

  await expect(profile).toBeVisible()
  await expect(techniqueButton).toBeVisible()
  await expect(techniqueButton).toHaveText('Manage Techniques')

  const techniqueAlignment = await techniqueButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return { justifyContent: style.justifyContent, textAlign: style.textAlign }
  })
  expect(techniqueAlignment.justifyContent).toBe('center')
  expect(techniqueAlignment.textAlign).toBe('center')

  const portraitTransform = await portrait.evaluate((element) => getComputedStyle(element).transform)
  expect(portraitTransform).not.toBe('none')
  const matrixValues = portraitTransform.match(/matrix\(([^)]+)\)/)?.[1]?.split(',').map(Number)
  expect(matrixValues?.[5]).toBeGreaterThan(0)

  const disciplineLabel = page.locator('#build-disciplines-heading').locator('..').locator('strong')
  await expect(disciplineLabel).toHaveText('Vanguard')

  await page
    .getByTestId('primary-build-panel')
    .getByRole('button', { name: /Manage Primary Discipline/ })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(dialog).toBeVisible()
  await expect(dialog).not.toContainText('Committed Secondary')
  await expect(dialog.locator('[aria-label="Choose a proposed Primary"]')).toHaveCount(0)
  await expect(
    dialog.locator('label').filter({ hasText: /^Proposed Secondary/ }).locator('option[value=""]'),
  ).toHaveText('None')
})
