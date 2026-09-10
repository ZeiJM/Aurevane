import { expect, test, type Locator, type Page } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Fit ${letters}`
}

test('keeps A1 surfaces readable and within viewport', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name === 'mobile-chromium',
    'Desktop readability and no-scroll fitting are intentionally separate from phone layout.',
  )
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `a1-fit-${projectSlug}-${Date.now()}@example.com`
  const password = 'A1-layout-fit-2026!'
  const characterName = uniqueCharacterName()

  await page.goto('/')
  await expect(page.getByTestId('account-shell')).toBeVisible()
  await expectMinimumFontSize(
    page.locator("[data-testid='account-shell'] .av-kicker").first(),
    12,
    'Account Entry kicker',
  )
  await expectInitialViewportFit(page, 'Account Entry')

  await page.goto('/news')
  await expect(page.getByRole('heading', { level: 1, name: 'News' })).toBeVisible()
  await expectMinimumFontSize(
    page.locator("[data-testid='public-information-shell'] main p").first(),
    14,
    'News body copy',
  )
  await expectInitialViewportFit(page, 'News')

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await expect(page.getByTestId('character-profile')).toContainText(characterName)
  await expectMinimumFontSize(
    page.locator('[data-profile-fact] small').first(),
    11,
    'Character Profile identity label',
  )
  await expectMinimumFontSize(
    page.getByTestId('profile-attribute-might').locator(':scope > span:last-child > span'),
    11.5,
    'Character Profile attribute label',
  )
  await expectMinimumFontSize(
    page.locator("[data-testid^='derived-stat-']").first().locator(':scope > span:first-child'),
    11.5,
    'Character Profile derived-stat label',
  )
  await expectInitialViewportFit(page, 'Character Profile')

  await page.goto('/game/battle')
  await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Battle Hall')

  await page.goto('/game/settings/controls')
  await expect(page.getByRole('heading', { name: 'Controls & Keybinds' })).toBeVisible()
  await expectInitialViewportFit(page, 'Controls & Keybinds')

  await page.goto('/game/training')
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expectInitialViewportFit(page, 'Passive Training')

  await page.goto('/game')
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expectMinimumFontSize(
    page.locator("[data-character-select-page='true'] main p").first(),
    13,
    'Character Select body copy',
  )
  await expectInitialViewportFit(page, 'Character Select')

  await page.setViewportSize({ width: 1024, height: 576 })
  await page.goto('/game')
  await expect(page.getByRole('heading', { name: 'Choose your character.' })).toBeVisible()
  await expectInitialViewportFit(page, 'Character Select at 1024x576')
})

async function expectMinimumFontSize(
  locator: Locator,
  minimumPx: number,
  surface: string,
): Promise<void> {
  await expect(locator, `${surface} should be visible before measuring typography`).toBeVisible()
  const fontSize = await locator.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  )
  const readabilityMessage = `${surface} should meet the desktop readability floor`
  expect(fontSize, readabilityMessage).toBeGreaterThanOrEqual(minimumPx)
}

async function expectInitialViewportFit(
  page: Page,
  surface: string,
  options: { allowVerticalScroll?: boolean } = {},
): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const dimensions = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  if (!options.allowVerticalScroll) {
    expect(
      dimensions.scrollHeight,
      `${surface} should not require initial vertical page scrolling`,
    ).toBeLessThanOrEqual(dimensions.clientHeight + 1)
  }
  expect(
    dimensions.scrollWidth,
    `${surface} should not require horizontal page scrolling`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}
