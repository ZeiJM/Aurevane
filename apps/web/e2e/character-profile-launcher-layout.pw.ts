import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Launcher ${letters}`
}

test('Profile build launchers stay centered and typographically matched', async ({
  page,
}, testInfo) => {
  const characterName = uniqueCharacterName()
  const slug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

  await provisionAccountAndEnterCharacter({
    page,
    email: `profile-launchers-${slug}-${Date.now()}@example.com`,
    password: 'Profile-launchers-2026!',
    characterName,
  })

  const disciplineLauncher = page
    .getByTestId('primary-build-panel')
    .getByRole('button', { name: /Manage Primary Discipline/ })
  const techniquesLauncher = page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
  const disciplineLabel = disciplineLauncher.getByText('Discipline Management', { exact: true })
  const techniquesLabel = techniquesLauncher.locator('strong')

  await expect(disciplineLauncher).toBeVisible()
  await expect(techniquesLauncher).toBeVisible()
  await expect(page.locator('#build-disciplines-heading')).toHaveText('Disciplines')
  await expect(page.locator('#build-techniques-heading')).toHaveText('Techniques')
  await expect(page.getByText(/\d+ \/ \d+ tagged/)).toHaveCount(0)

  const [buttonBox, labelBox] = await Promise.all([
    techniquesLauncher.boundingBox(),
    techniquesLabel.boundingBox(),
  ])
  if (!buttonBox || !labelBox) {
    throw new Error('The Techniques launcher geometry is unavailable.')
  }

  expect(
    Math.abs(buttonBox.x + buttonBox.width / 2 - (labelBox.x + labelBox.width / 2)),
  ).toBeLessThanOrEqual(2)

  const [techniquesFontSize, disciplineFontSize] = await Promise.all([
    techniquesLabel.evaluate((element) => getComputedStyle(element, '::after').fontSize),
    disciplineLabel.evaluate((element) => getComputedStyle(element).fontSize),
  ])
  expect(techniquesFontSize).toBe(disciplineFontSize)
})
