import { expect, test, type Page } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Fit ${letters}`
}

test('keeps the core A1 surfaces inside the initial desktop and laptop viewport', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Natural vertical scrolling is allowed on phones.',
  )
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `a1-fit-${projectSlug}-${Date.now()}@example.com`
  const password = 'A1-layout-fit-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await expect(page.getByTestId('account-shell')).toBeVisible()
  await expectInitialViewportFit(page, 'Account Entry')

  await page.goto('/news')
  await expect(page.getByRole('heading', { level: 1, name: 'News' })).toBeVisible()
  await expectInitialViewportFit(page, 'News')

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  await expectInitialViewportFit(page, 'Character Profile')

  await page.goto('/game/battle')
  await expect(page.getByRole('heading', { name: 'Choose a battle.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Battle Hall')

  await page.goto('/game/settings/controls')
  await expect(page.getByRole('heading', { name: 'Controls & Keybinds' })).toBeVisible()
  await expectInitialViewportFit(page, 'Controls & Keybinds')

  await page.goto('/game/training')
  await expect(page.getByRole('heading', { name: "Wayfarer's Practice" })).toBeVisible()
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expectInitialViewportFit(page, "Wayfarer's Practice")

  await page.goto('/game')
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Character Select')
})

async function expectInitialViewportFit(page: Page, surface: string): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const dimensions = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(
    dimensions.scrollHeight,
    `${surface} should not require initial vertical page scrolling`,
  ).toBeLessThanOrEqual(dimensions.clientHeight + 1)
  expect(
    dimensions.scrollWidth,
    `${surface} should not require horizontal page scrolling`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}
