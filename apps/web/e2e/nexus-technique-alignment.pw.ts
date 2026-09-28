import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  return `Align ${Date.now().toString(36)}`
}

test('single-Discipline Nexus and Technique modal align live and locked slots', async ({
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

  const lanes = page.locator('[data-nexus-technique-lane="true"]')
  await expect(lanes).toHaveCount(2)

  const activeLane = lanes.nth(0)
  const lockedLane = lanes.nth(1)
  await expect(lockedLane).toHaveAttribute('data-locked', 'true')

  const activeHeaderBox = await activeLane.locator('header').boundingBox()
  const lockedHeaderBox = await lockedLane.locator('header').boundingBox()
  const activeSlotBox = await activeLane
    .locator('[data-arsenal-technique-row="true"]')
    .first()
    .boundingBox()
  const lockedSlotBox = await lockedLane
    .locator('[data-arsenal-technique-row="true"]')
    .first()
    .boundingBox()

  if (!activeHeaderBox || !lockedHeaderBox || !activeSlotBox || !lockedSlotBox) {
    throw new Error('Nexus Technique geometry is unavailable.')
  }

  expect(Math.abs(activeHeaderBox.height - lockedHeaderBox.height)).toBeLessThanOrEqual(1)
  expect(Math.abs(activeSlotBox.y - lockedSlotBox.y)).toBeLessThanOrEqual(1)

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
  expect(Math.abs(liveArtBox.y - lockedArtBox.y)).toBeLessThanOrEqual(1)
})
