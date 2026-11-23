import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

test('game navigation stays in the primary rail without a redundant footer trigger', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'laptop-chromium',
    'Check the shared account menu once on desktop and once on phone.',
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
  await expect(primaryNavigation.getByRole('link', { name: 'Arsenal', exact: true })).toBeVisible()
  await expect(primaryNavigation.getByRole('link', { name: /^Arena/ })).toBeVisible()
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
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  const finalAccountMenu = page.getByRole('menu', { name: 'Account menu' })
  await expect(finalAccountMenu.getByText(/Welcome back, Navigator/)).toBeVisible()
  const online = finalAccountMenu.getByRole('link', { name: /Online Users/ })
  await expect(online).toHaveAttribute('href', '/game/online')
  const viewport = page.viewportSize()!
  for (const width of testInfo.project.name === 'mobile-chromium'
    ? [viewport.width, 320]
    : [viewport.width]) {
    await page.setViewportSize({ width, height: viewport.height })
    const link = (await online.boundingBox())!
    const greeting = (await finalAccountMenu.getByText(/Welcome back, Navigator/).boundingBox())!
    const portrait = (await finalAccountMenu
      .getByRole('img', { name: /^Current character:/ })
      .boundingBox())!
    const wrapper = await online.evaluate((el) => {
      const style = getComputedStyle(el.parentElement!)
      return { border: style.borderTopWidth, padding: style.padding }
    })
    expect(wrapper).toEqual({ border: '0px', padding: '0px' })
    expect(link.y).toBeGreaterThanOrEqual(greeting.y + greeting.height - 0.5)
    expect(link.height).toBeGreaterThanOrEqual(24)
    expect(link.height).toBeLessThanOrEqual(28)
    expect(portrait.width).toBeGreaterThan(48)
    expect(portrait.width).toBeLessThanOrEqual(64)
    expect(portrait.height).toBeCloseTo(portrait.width, 1)
    expect(portrait.x).toBeGreaterThanOrEqual(link.x + link.width)
    const menu = (await finalAccountMenu.boundingBox())!
    expect(menu.x).toBeGreaterThanOrEqual(0)
    expect(menu.x + menu.width).toBeLessThanOrEqual(width)
    await page.screenshot({
      path: testInfo.outputPath(`account-menu-compact-${width}.png`),
      animations: 'disabled',
    })
  }
  await online.click()
  await expect(page).toHaveURL(/\/game\/online$/)
  await expect(page.getByRole('heading', { name: 'Online Users', exact: true })).toBeVisible()
})
