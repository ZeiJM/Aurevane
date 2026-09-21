import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('Profile stat help uses a single dismissible non-modal popover', async ({ page }, info) => {
  test.setTimeout(180_000)

  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  expect(['127.0.0.1', 'localhost']).toContain(api.hostname)

  await page.setViewportSize({ width: 1440, height: 900 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `stat-popover-${info.workerIndex}-${Date.now()}@example.com`,
    password: 'Disposable-profile-popover-2026!',
    characterName: 'Popover Vale',
  })

  await page.goto('/game/character')
  await expect(page.getByTestId('character-profile')).toBeVisible()

  const physicalPower = page.getByTestId('derived-stat-physicalPower')
  await physicalPower.click()

  const popover = page.locator('[data-profile-stat-popover="true"]')
  await expect(popover).toHaveCount(1)
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('heading', { name: 'Physical Power', exact: true })).toBeVisible()
  await expect(popover).not.toHaveAttribute('aria-modal', 'true')
  await expect(popover.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0)
  await expect(page.locator('[data-profile-detail-backdrop="true"]')).toHaveCount(0)

  await page.getByTestId('derived-stat-statusResistance').click()
  await expect(popover).toHaveCount(1)
  await expect(
    popover.getByRole('heading', { name: 'Status Resistance', exact: true }),
  ).toBeVisible()
  await expect(popover.getByRole('heading', { name: 'Physical Power', exact: true })).toHaveCount(0)

  await page.getByRole('heading', { name: 'Core Attributes', exact: true }).click()
  await expect(popover).toHaveCount(0)

  await page.getByTestId('profile-attribute-might').click()
  await expect(popover).toHaveCount(1)
  await expect(popover.getByRole('heading', { name: 'Might', exact: true })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)
})
