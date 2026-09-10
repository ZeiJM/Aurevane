import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const suffix =
    Date.now()
      .toString(36)
      .replace(/[^a-z]/gi, '')
      .slice(-7) || 'mobile'
  return `Header ${suffix}`
}

function overlaps(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  )
}

async function closeOpenDialog(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  if ((await dialog.count()) === 0) return
  await dialog.first().getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toHaveCount(0)
}

test('mobile mixed-build Technique counters sit below the title without colliding with Close', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.AUREVANE_PV2_TEST_MODE !== '1',
    'Mixed build header regression requires the explicit local PV-2 test kit.',
  )
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Mobile Techniques header layout proof')

  await provisionAccountAndEnterCharacter({
    page,
    email: `mobile-techniques-header-${Date.now()}@example.com`,
    password: 'Mobile-techniques-header-2026!',
    characterName: uniqueCharacterName(),
  })

  const prepared = await page.evaluate(async () => {
    const response = await fetch('/api/character/build/pv2-test-kit', { method: 'POST' })
    return { ok: response.ok, body: await response.json() }
  })
  expect(prepared.ok).toBe(true)

  await page.reload()
  await expect(page.getByTestId('character-profile')).toBeVisible()
  await closeOpenDialog(page)

  await page
    .getByTestId('primary-build-panel')
    .getByRole('button', { name: /Manage Primary Discipline/ })
    .click()
  const disciplineDialog = page.getByRole('dialog', { name: 'Discipline Management' })
  await expect(disciplineDialog).toBeVisible()
  await page.getByLabel('Proposed Secondary').selectOption('lifebinder')
  await page.getByRole('button', { name: 'Commit Discipline changes' }).click()
  await expect(page.getByRole('status')).toContainText(
    'Lifebinder is now the committed Secondary Discipline.',
  )
  await disciplineDialog.getByRole('button', { name: 'Close' }).click()

  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques' })
  await expect(dialog).toBeVisible()

  const heading = dialog.getByRole('heading', { name: 'Techniques' })
  const close = dialog.getByRole('button', { name: 'Close' })
  const capacity = dialog.getByTestId('skill-capacity')
  const badges = capacity.locator(':scope > div')

  await expect(heading).toBeVisible()
  await expect(close).toBeVisible()
  await expect(capacity).toBeVisible()
  await expect(badges).toHaveCount(2)
  await expect(capacity).toContainText('Vanguard')
  await expect(capacity).toContainText('Lifebinder')

  const headingBox = await heading.boundingBox()
  const closeBox = await close.boundingBox()
  const capacityBox = await capacity.boundingBox()
  expect(headingBox).not.toBeNull()
  expect(closeBox).not.toBeNull()
  expect(capacityBox).not.toBeNull()

  if (!headingBox || !closeBox || !capacityBox) return

  expect(overlaps(headingBox, closeBox)).toBe(false)
  expect(overlaps(headingBox, capacityBox)).toBe(false)
  expect(overlaps(closeBox, capacityBox)).toBe(false)
  expect(capacityBox.y).toBeGreaterThanOrEqual(
    Math.max(headingBox.y + headingBox.height, closeBox.y + closeBox.height),
  )

  const firstBadgeBox = await badges.nth(0).boundingBox()
  const secondBadgeBox = await badges.nth(1).boundingBox()
  expect(firstBadgeBox).not.toBeNull()
  expect(secondBadgeBox).not.toBeNull()
  if (firstBadgeBox && secondBadgeBox) expect(overlaps(firstBadgeBox, secondBadgeBox)).toBe(false)
})
