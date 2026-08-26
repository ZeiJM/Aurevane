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

test('Manual states the current phase boundary and documents live PvP without starting Phase 3', async ({
  page,
}) => {
  await page.goto('/manual/start-here')
  await expect(page.getByText(/Phase 1 .* is complete/)).toBeVisible()
  await expect(page.getByText(/PV-1 \(Phase 2 test\)/).first()).toBeVisible()
  await expect(page.getByText(/Phase 3 is not active while Phase 2 testing continues/)).toBeVisible()

  await page.goto('/manual/pvp-spectation')
  await expect(page.getByRole('heading', { level: 1, name: 'PvP & Spectation' })).toBeVisible()
  await expect(page.getByText(/Direct private PvP is playable now/)).toBeVisible()
  await expect(page.getByText(/1v1, 2v2, 3v3/)).toBeVisible()
  await expect(
    page.getByText(/ranked matchmaking, rating ladders, seasons, tournaments/i),
  ).toBeVisible()
})

test('Manual publishes the authoritative six-point character creation budget', async ({ page }) => {
  await page.goto('/manual/character-creation#six-attributes')
  await expect(page.getByText(/exactly 6 additional whole-number points/)).toBeVisible()
  await expect(page.getByText(/allow from 0 to 6 bonus points in any one attribute/)).toBeVisible()
  await expect(page.getByText(/no more than 4 bonus points/)).toHaveCount(0)
})

test('Rules exposes stable anchors and the truthful current Phase 2 test scope', async ({ page }) => {
  await page.goto('/rules#bugs-and-exploits')
  await expect(
    page.getByRole('heading', { level: 2, name: 'Bugs & Exploit Reporting' }),
  ).toBeVisible()
  await expect(
    page.getByText(/Finding or accidentally triggering a bug is not misconduct/),
  ).toBeVisible()

  await page.goto('/rules#current-scope')
  await expect(page.getByText(/direct private PvP and keyed spectation/i).first()).toBeVisible()
  await expect(page.getByText(/ranked-matchmaking, rating, season, tournament/i)).toBeVisible()
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
