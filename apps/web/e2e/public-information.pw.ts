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
    await expect(page.getByRole('link', { name: 'Play / Sign In' })).toBeVisible()

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
    expect(hasHorizontalOverflow).toBe(false)

    await page.keyboard.press('Tab')
    await expect(page.locator('.skip-link')).toBeFocused()
  })
}

test('News, Manual, and Rules keep the same header position across public surfaces', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Desktop header anchoring is the regression being guarded.',
  )

  async function navigationCenter(): Promise<number> {
    const navigation = page.getByRole('navigation', { name: 'Public information', exact: true })
    await expect(navigation).toBeVisible()
    const box = await navigation.boundingBox()
    expect(box).not.toBeNull()
    return box!.x + box!.width / 2
  }

  await page.goto('/')
  const accountCenter = await navigationCenter()

  for (const route of publicRoutes) {
    await page.goto(route.path)
    const publicCenter = await navigationCenter()
    expect(Math.abs(publicCenter - accountCenter)).toBeLessThanOrEqual(3)
  }
})

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

test('signed-in public reading retains the same game frame and a Haven return path', async ({
  page,
}, info) => {
  const suffix = `${Date.now()}${info.workerIndex}`.replace(/\d/g, (d) =>
    String.fromCharCode(65 + Number(d)),
  )
  await createAccountAndEnterCharacter({
    page,
    email: `reading-${suffix}@example.test`,
    password: 'Public-reading-2026!',
    characterName: `Guide ${suffix}`,
  })
  const shell = page.getByTestId('authenticated-shell')
  const header = await shell.locator(':scope > header').boundingBox()
  const rail = await shell.locator('[data-av-game-rail]').boundingBox()
  for (const route of publicRoutes) {
    await page.goto(route.path)
    await expect(page.getByRole('heading', { name: route.heading, level: 1 })).toBeVisible()
    expect(await shell.locator(':scope > header').boundingBox()).toEqual(header)
    expect(await shell.locator('[data-av-game-rail]').boundingBox()).toEqual(rail)
    await expect(page.getByTestId('public-information-shell')).toHaveCount(0)
  }
  await shell.getByRole('link', { name: 'Haven', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/haven$/)
})
