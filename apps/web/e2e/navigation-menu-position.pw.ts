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
  await expect(primaryNavigation.getByRole('link', { name: 'Profile', exact: true })).toBeVisible()
  await expect(primaryNavigation.getByRole('link', { name: 'Items', exact: true })).toHaveCount(0)
  await expect(primaryNavigation.getByRole('link', { name: 'Loadout', exact: true })).toBeVisible()
  await expect(primaryNavigation.getByRole('link', { name: /^Battle/ })).toBeVisible()
  await expect(primaryNavigation.getByRole('link', { name: /^Training/ })).toBeVisible()
  await expect(primaryNavigation.getByRole('button', { name: 'Items', exact: true })).toHaveCount(0)
  await expect(primaryNavigation.getByText('Adventurers', { exact: true })).toHaveCount(0)

  for (const name of ['Titles', 'Audio', 'Controls']) {
    await expect(
      page.locator('[data-av-game-rail]').getByRole('link', { name, exact: true }),
    ).toHaveCount(0)
  }
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  const accountMenu = page.getByRole('menu', { name: 'Account menu' })
  for (const [name, href] of [
    ['Audio', '/game/settings/audio'],
    ['Controls & Keybinds', '/game/settings/controls'],
    ['Titles & Profile Display', '/game/account/titles'],
  ]) {
    await expect(accountMenu.getByRole('menuitem', { name, exact: true })).toHaveAttribute(
      'href',
      href,
    )
  }
  await accountMenu.getByRole('menuitem', { name: 'Audio', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/settings\/audio$/)
  await expect(page.locator('[data-audio-workspace]')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Audio settings' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Online Users/ })).toBeVisible()
})
