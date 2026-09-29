import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  return `Preview ${Date.now().toString(36)}`
}

test('Technique Preview keeps compact effects aligned and unwrapped', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop Chromium proves the compact Technique Preview layout.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `technique-preview-v51-${Date.now()}@example.com`,
    password: 'Technique-preview-v51-2026!',
    characterName: uniqueCharacterName(),
  })

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  await page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  const preview = dialog.getByTestId('technique-preview')
  await expect(preview).toBeVisible()

  const effectsRow = preview.locator('dt', { hasText: 'Effects' }).locator('..')
  await expect(effectsRow.locator('ul')).toHaveCount(0)

  const compactEffects = effectsRow.locator('[data-compact-skill-effect="true"]')
  expect(await compactEffects.count()).toBeGreaterThan(0)

  const firstEffect = compactEffects.first()
  await expect(firstEffect).toBeVisible()
  expect(
    await firstEffect.evaluate((element) => ({
      textAlign: getComputedStyle(element).textAlign,
      whiteSpace: getComputedStyle(element).whiteSpace,
    })),
  ).toEqual({ textAlign: 'right', whiteSpace: 'nowrap' })

  const magnitude = preview.locator('[data-compact-effect-magnitude="true"]').first()
  await expect(magnitude).toBeVisible()

  const duration = preview.locator('[data-compact-effect-duration="true"]').first()
  if (await duration.count()) {
    await expect(duration).toBeVisible()
    const [magnitudeColor, durationColor] = await Promise.all([
      magnitude.evaluate((element) => getComputedStyle(element).color),
      duration.evaluate((element) => getComputedStyle(element).color),
    ])
    expect(durationColor).not.toBe(magnitudeColor)
  }
})
