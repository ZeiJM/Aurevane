import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

const publicRoutes = [
  { path: '/news', heading: 'News' },
  { path: '/manual', heading: 'Manual' },
  { path: '/rules', heading: 'Rules' },
] as const

for (const route of publicRoutes) {
  test(`${route.path} is public, responsive, keyboard reachable, and linked to sibling surfaces`, async ({
    page,
  }) => {
    await page.goto(route.path)

    await expect(page.getByTestId('public-information-shell')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible()
    await expect(page.getByLabel(`Current screen: ${route.heading}`)).toHaveCount(0)

    const navigation = page.getByRole('navigation', { name: 'Public information', exact: true })
    await expect(navigation.getByRole('link', { name: 'News', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Manual', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Rules', exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name: 'Play / Sign In' })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)

    await page.keyboard.press('Tab')
    await expect(page.locator('.skip-link')).toBeFocused()
  })
}

test('News launches with an intentional empty state instead of a fake archive', async ({
  page,
}) => {
  await page.goto('/news')
  await expect(page.getByTestId('news-empty-state')).toContainText('No public posts yet')
  await expect(page.getByTestId('news-empty-state')).toContainText('No synthetic archive')
})

test('Manual has stable article routes and deep section anchors', async ({ page }) => {
  await page.goto('/manual')
  await page.getByRole('link', { name: /Character Creation/ }).click()
  await expect(page).toHaveURL(/\/manual\/character-creation$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Character Creation' })).toBeVisible()

  await page.goto('/manual/wayfarers-practice#guardrails')
  await expect(
    page.getByRole('heading', { level: 2, name: 'What Passive Training cannot do' }),
  ).toBeVisible()
})

test('Rules exposes stable section anchors and truthful current-scope language', async ({
  page,
}) => {
  await page.goto('/rules#bugs-and-exploits')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Bugs & Exploit Reporting' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Finding or accidentally triggering a bug is not misconduct/),
  ).toBeVisible()
  await expect(page.getByText(/does not currently publish speculative marketplace/)).toBeVisible()
})

test('an authenticated character keeps a direct return path while reading the Manual', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated return-path proof is sufficient.',
  )

  const now = Date.now()
  const email = `p17-public-${now}@example.com`
  const password = 'P17-public-information-2026!'
  const suffix = now
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  const characterName = `Guide ${suffix}`

  await createAccountAndEnterCharacter({ page, email, password, characterName })

  await page.goto('/manual')
  await expect(page).toHaveURL(/\/manual$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Manual' })).toBeVisible()
  await expect(page.getByLabel('Current screen: Manual')).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Return to Game' })).toBeVisible()
})
