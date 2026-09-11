import { expect, test, type Locator, type Page } from '@playwright/test'

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
  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: /Manage Techniques/ }).click()
  }
  await expect(dialog).toBeVisible()
  return dialog
}

async function expectCenteredStar(button: Locator): Promise<void> {
  await expect(button).toBeVisible()
  const icon = button.locator('svg')
  await expect(icon).toHaveCount(1)
  await expect(icon).toHaveAttribute('aria-hidden', 'true')
  await expect(icon).toHaveAttribute('focusable', 'false')
  const active = (await button.getAttribute('aria-pressed')) === 'true'
  await expect(icon).toHaveAttribute('fill', active ? 'currentColor' : 'none')

  const geometry = await button.evaluate((element) => {
    const svg = element.querySelector('svg')
    const polygon = svg?.querySelector('polygon')
    const transform = svg?.getScreenCTM()
    if (!svg || !polygon || !transform) {
      throw new Error('Favorite star must render a measurable SVG polygon')
    }

    const points = Array.from(polygon.points, (point) => ({ x: point.x, y: point.y }))
    if (points.length < 3)
      throw new Error('Favorite star polygon must contain at least three points')

    let twiceArea = 0
    let centroidXNumerator = 0
    let centroidYNumerator = 0
    for (let index = 0; index < points.length; index += 1) {
      const current = points[index]!
      const next = points[(index + 1) % points.length]!
      const cross = current.x * next.y - next.x * current.y
      twiceArea += cross
      centroidXNumerator += (current.x + next.x) * cross
      centroidYNumerator += (current.y + next.y) * cross
    }
    if (Math.abs(twiceArea) < Number.EPSILON) {
      throw new Error('Favorite star polygon must have measurable area')
    }

    const visualCenter = new DOMPoint(
      centroidXNumerator / (3 * twiceArea),
      centroidYNumerator / (3 * twiceArea),
    ).matrixTransform(transform)
    const circle = element.getBoundingClientRect()
    const iconBox = svg.getBoundingClientRect()
    const centerX = circle.left + circle.width / 2
    const centerY = circle.top + circle.height / 2
    return {
      circleWidth: circle.width,
      circleHeight: circle.height,
      iconWidth: iconBox.width,
      iconHeight: iconBox.height,
      iconOffsetX: Math.abs(iconBox.left + iconBox.width / 2 - centerX),
      iconOffsetY: Math.abs(iconBox.top + iconBox.height / 2 - centerY),
      visualOffsetX: Math.abs(visualCenter.x - centerX),
      visualOffsetY: Math.abs(visualCenter.y - centerY),
    }
  })

  expect(Math.abs(geometry.circleWidth - geometry.circleHeight)).toBeLessThanOrEqual(0.5)
  expect(geometry.iconWidth).toBeGreaterThan(0)
  expect(geometry.iconHeight).toBeGreaterThan(0)
  expect(
    geometry.iconOffsetX,
    'SVG must be horizontally centered in its circle',
  ).toBeLessThanOrEqual(0.5)
  expect(geometry.iconOffsetY, 'SVG must be vertically centered in its circle').toBeLessThanOrEqual(
    0.5,
  )
  expect(
    geometry.visualOffsetX,
    'Star visual mass must be horizontally centered',
  ).toBeLessThanOrEqual(0.5)
  expect(
    geometry.visualOffsetY,
    'Star visual mass must be vertically centered',
  ).toBeLessThanOrEqual(0.5)
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
  await expectCenteredStar(forcefulStar)
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
  await expectCenteredStar(forcefulStar)
  await expect(forcefulCheckbox).toBeChecked()

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
  await expectCenteredStar(essenceStar)
  await expectCenteredStar(forcefulStar)

  await dialog.getByRole('button', { name: 'Close' }).click()
  await page.reload()
  dialog = await openTechniques(page)
  const persistedEssenceStar = page
    .getByTestId('active-essence')
    .locator('xpath=ancestor::article[1]')
    .locator('button[data-favorite-technique-star="true"]')
  await expect(persistedEssenceStar).toHaveAttribute('aria-pressed', 'true')
  await expectCenteredStar(persistedEssenceStar)
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
  await expectCenteredStar(star)
  const box = await star.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(28)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(28)

  if (!(await checkbox.isChecked())) await checkbox.tap()
  await expect(star).toBeEnabled()
  await star.tap()
  await expect(star).toHaveAttribute('aria-pressed', 'true')
  await expectCenteredStar(star)
  await expect(checkbox).toBeChecked()
  await star.tap()
  await expect(star).toHaveAttribute('aria-pressed', 'false')
  await expectCenteredStar(star)
  await expect(checkbox).toBeChecked()
  await expect(dialog).toBeVisible()
})
