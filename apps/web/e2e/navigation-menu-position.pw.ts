import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

test('game navigation opens from the bottom-right trigger instead of the top viewport edge', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop anchoring proof is sufficient.',
  )

  const now = Date.now()
  const suffix = now
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  await createAccountAndEnterCharacter({
    page,
    email: `nav-anchor-${now}@example.com`,
    password: 'Nav-anchor-2026!',
    characterName: `Navigator ${suffix}`,
  })

  const trigger = page.getByRole('button', { name: /Navigation/ })
  await expect(trigger).toBeVisible()
  const triggerBox = await trigger.boundingBox()
  expect(triggerBox).not.toBeNull()

  await trigger.click()
  const menu = page.getByRole('navigation', { name: 'Game navigation' })
  await expect(menu).toBeVisible()
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  if (!triggerBox || !menuBox) return

  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(triggerBox.y - 4)
  expect(Math.abs(menuBox.x + menuBox.width - (triggerBox.x + triggerBox.width))).toBeLessThanOrEqual(
    12,
  )
  expect(menuBox.y).toBeGreaterThan(page.viewportSize()!.height / 2)
})
