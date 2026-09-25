import { expect, test, type Locator, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Technique ${letters}`
}

function skillCard(page: Page, name: string) {
  return page.getByTestId('learned-skill-list').locator('article').filter({ hasText: name }).first()
}

async function openTechniques(page: Page) {
  if (!new URL(page.url()).pathname.startsWith('/game/nexus')) {
    await page.goto('/game/nexus')
    await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()
  }
  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: /Manage Techniques/ }).click()
  }
  await expect(dialog).toBeVisible()
  return dialog
}

async function toggleAndWait(page: Page, checkbox: Locator) {
  const before = await checkbox.isChecked()
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await checkbox.click()
  expect((await saved).status()).toBe(200)
  await expect(checkbox).toBeChecked({ checked: !before })
  return !before
}

test('Technique selection auto-saves and favorite controls are removed', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated desktop Chromium proof covers automatic Technique persistence.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `technique-autosave-${Date.now()}@example.com`,
    password: 'Technique-autosave-2026!',
    characterName: uniqueCharacterName(),
  })

  let dialog = await openTechniques(page)
  await expect(dialog.locator('[data-favorite-technique-star="true"]')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Commit Selected Techniques' })).toHaveCount(0)
  await expect(dialog).not.toContainText('Build Signature')

  const forceful = skillCard(page, 'Forceful Strike')
  const checkbox = forceful.getByRole('checkbox')
  const persistedState = await toggleAndWait(page, checkbox)

  await forceful.hover()
  const preview = page.getByTestId('technique-preview')
  await expect(preview).toContainText('Forceful Strike')
  for (const label of [
    'Skill Type',
    'Cost',
    'Damage',
    'Effects',
    'Requirements',
    'Target',
    'Target Method',
    'Target Elevation',
    'Range',
    'Line of Sight',
    'Cooldown',
  ]) {
    await expect(preview.getByText(label, { exact: true })).toBeVisible()
  }
  await expect(preview).not.toContainText('Effects, in order')
  await expect(preview.getByText('Skill details', { exact: true })).toHaveCount(0)
  await expect(forceful).toContainText('Attack')
  await expect(forceful).not.toContainText('AP')

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.reload()
  dialog = await openTechniques(page)
  await expect(skillCard(page, 'Forceful Strike').getByRole('checkbox')).toBeChecked({
    checked: persistedState,
  })
  await expect(dialog.locator('[data-favorite-technique-star="true"]')).toHaveCount(0)
})

test('mobile Techniques select and save on the first tap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile Technique interaction proof')

  await provisionAccountAndEnterCharacter({
    page,
    email: `technique-mobile-${Date.now()}@example.com`,
    password: 'Technique-mobile-2026!',
    characterName: uniqueCharacterName(),
  })

  const dialog = await openTechniques(page)
  const forceful = skillCard(page, 'Forceful Strike')
  const checkbox = forceful.getByRole('checkbox')
  const label = forceful.locator('label')
  const before = await checkbox.isChecked()

  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/character/build/skills') &&
      response.request().method() === 'PUT',
  )
  await label.tap()

  expect((await saved).status()).toBe(200)
  await expect(checkbox).toBeChecked({ checked: !before })
  await expect(dialog.locator('[data-favorite-technique-star="true"]')).toHaveCount(0)
})
