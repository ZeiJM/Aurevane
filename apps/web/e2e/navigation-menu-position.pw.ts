import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

test('game navigation stays in the primary rail without a redundant footer trigger', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One desktop shell-navigation proof is sufficient.',
  )

  const now = Date.now()
  const suffix = now
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')

  await createAccountAndEnterCharacter({
    page,
    email: `nav-shell-${now}@example.com`,
    password: 'Nav-shell-2026!',
    characterName: `Navigator ${suffix}`,
  })

  await expect(page.getByRole('button', { name: 'Navigation', exact: true })).toHaveCount(0)

  const primaryNavigation = page.getByRole('navigation', { name: 'Primary game navigation' })
  await expect(primaryNavigation.getByRole('link', { name: /^Profile/ })).toBeVisible()
  await expect(primaryNavigation.getByRole('link', { name: /^Battle Hall/ })).toBeVisible()
  await expect(primaryNavigation.getByRole('link', { name: /^Passive Training/ })).toBeVisible()
  await expect(primaryNavigation.getByText('Adventurers', { exact: true })).toHaveCount(0)

  await expect(page.getByRole('link', { name: /Online Users/ })).toBeVisible()
})
