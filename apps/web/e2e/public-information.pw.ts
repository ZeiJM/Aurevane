import { expect, test } from '@playwright/test'

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
    page.getByRole('heading', { level: 2, name: 'What offline practice cannot do' }),
  ).toBeVisible()
})

test('Manual distinguishes current Tactical Hall play from planned roadmap direction', async ({
  page,
}) => {
  await page.goto('/manual/tactical-hall')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tactical Hall & Practice Battles' }),
  ).toBeVisible()
  await expect(page.getByText(/Movement — learn legal positioning/)).toBeVisible()
  await expect(page.getByText(/Recruit Sparring — fight a legal AI opponent/)).toBeVisible()
  await expect(page.getByText(/do not provide repeatable progression rewards/)).toBeVisible()

  await page.goto('/manual/road-ahead#planned-not-live')
  await expect(page.getByRole('heading', { level: 1, name: 'Road Ahead — Approved Direction' })).toBeVisible()
  await expect(page.getByText(/Everything in this article is planned direction/)).toBeVisible()
  await expect(page.getByText(/Resonance is the current term replacing the retired Confluence/)).toBeVisible()
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

test('an authenticated session can intentionally read the canonical Manual route', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated route proof is sufficient.',
  )

  const email = `p17-public-${Date.now()}@example.com`
  const password = 'P17-public-information-2026!'

  await page.goto('/')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account', exact: true }).last().click()
  await expect(page).toHaveURL(/\/game$/)

  await page.goto('/manual')
  await expect(page).toHaveURL(/\/manual$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Manual' })).toBeVisible()
})
