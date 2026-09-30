import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Align ${letters}`
}

test('single-Discipline Nexus aligns its four selected slots and preserves locked modal choices', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop Chromium proves the one-Discipline Technique alignment.',
  )

  await provisionAccountAndEnterCharacter({
    page,
    email: `nexus-technique-align-${Date.now()}@example.com`,
    password: 'Nexus-technique-align-2026!',
    characterName: uniqueCharacterName(),
  })

  await page.goto('/game/nexus')
  await expect(page.locator('[data-arsenal-workspace]')).toBeVisible()

  const lane = page.locator('[data-nexus-technique-lane="true"]')
  await expect(lane).toHaveCount(1)
  const slots = lane.locator('[data-arsenal-technique-row="true"]')
  await expect(slots).toHaveCount(4)
  const geometry = await slots.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { y: rect.y, width: rect.width, height: rect.height }
    }),
  )
  expect(
    Math.max(...geometry.map((slot) => slot.y)) - Math.min(...geometry.map((slot) => slot.y)),
  ).toBeLessThanOrEqual(1)
  await expect(page.locator('[data-arsenal-panel="disciplines"]')).toContainText('Locked')

  await page
    .getByTestId('skill-build-panel')
    .getByRole('button', { name: /Manage Techniques/ })
    .click()

  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  await expect(dialog).toBeVisible()

  const liveArt = dialog.locator('[data-av-square-media="true"]').first()
  const lockedCard = dialog.getByText('Locked', { exact: true }).first().locator('..')
  const lockedArt = lockedCard.locator('span').first()

  const liveArtBox = await liveArt.boundingBox()
  const lockedArtBox = await lockedArt.boundingBox()
  if (!liveArtBox || !lockedArtBox) {
    throw new Error('Technique modal slot geometry is unavailable.')
  }
  // The approved modal stacks Discipline groups; both groups retain the same square art size.
  for (const artwork of [liveArtBox, lockedArtBox]) {
    expect(Math.abs(artwork.width - artwork.height)).toBeLessThanOrEqual(1)
    expect(Math.abs(artwork.width - 64)).toBeLessThanOrEqual(1)
  }
})
