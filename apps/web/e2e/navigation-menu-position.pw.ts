import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

test('game navigation opens above and aligned with the footer trigger', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop anchoring proof is sufficient for the footer popover geometry.',
  )

  const now = Date.now()
  const email = `nav-popover-${now}@example.com`
  const password = 'Nav-popover-2026!'
  const suffix = now
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  await createAccountAndEnterCharacter({
    page,
    email,
    password,
    characterName: `Navigator ${suffix}`,
  })

  const trigger = page.getByRole('button', { name: /Navigation/i })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const menu = page.getByRole('navigation', { name: 'Game navigation' })
  await expect(menu).toBeVisible()

  const triggerBox = await trigger.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(triggerBox).not.toBeNull()
  expect(menuBox).not.toBeNull()

  expect(menuBox!.y + menuBox!.height).toBeLessThan(triggerBox!.y)
  expect(Math.abs(menuBox!.x + menuBox!.width - (triggerBox!.x + triggerBox!.width))).toBeLessThanOrEqual(
    8,
  )
  expect(menuBox!.y).toBeGreaterThan(page.viewportSize()!.height / 2)
})
