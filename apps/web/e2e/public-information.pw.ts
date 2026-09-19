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

test('mobile public navigation keeps the account header geometry when opening News, Manual, and Rules', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-chromium',
    'Phone header parity is the regression being guarded.',
  )
  await page.setViewportSize({ width: 390, height: 844 })

  async function headerGeometry(testId: 'account-shell' | 'public-information-shell') {
    const shell = page.getByTestId(testId)
    const header = shell.locator(':scope > header')
    const brand = header.locator('.brand')
    const crest = header.locator('.brand__crest')
    const wordmark = header.locator('.brand__wordmark strong')
    const navigation = header.getByRole('navigation', { name: 'Public information', exact: true })

    await expect(header).toBeVisible()
    const [headerBox, brandBox, crestBox, navigationBox, wordmarkStyle] = await Promise.all([
      header.boundingBox(),
      brand.boundingBox(),
      crest.boundingBox(),
      navigation.boundingBox(),
      wordmark.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          fontSize: style.fontSize,
          letterSpacing: style.letterSpacing,
        }
      }),
    ])

    expect(headerBox).not.toBeNull()
    expect(brandBox).not.toBeNull()
    expect(crestBox).not.toBeNull()
    expect(navigationBox).not.toBeNull()

    return {
      headerHeight: headerBox!.height,
      brandTop: brandBox!.y,
      brandLeft: brandBox!.x,
      crestWidth: crestBox!.width,
      crestHeight: crestBox!.height,
      navigationTop: navigationBox!.y,
      navigationLeft: navigationBox!.x,
      wordmarkStyle,
    }
  }

  await page.goto('/')
  const accountGeometry = await headerGeometry('account-shell')

  for (const route of publicRoutes) {
    await page.goto(route.path)
    const publicGeometry = await headerGeometry('public-information-shell')
    expect(publicGeometry).toEqual(accountGeometry)
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

  const gameHeader = page.getByTestId('authenticated-shell').locator(':scope > header')
  const gameNewsLink = gameHeader.getByRole('link', { name: 'News', exact: true })
  await expect(gameHeader).toBeVisible()
  await expect(gameHeader.locator('.brand__wordmark small')).toHaveText(
    'Persistent tactical fantasy',
  )
  const gameHeaderStyle = await gameHeader.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderBottomColor,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
    }
  })
  const gameNewsStyle = await gameNewsLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      minHeight: style.minHeight,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
    }
  })

  const accountButton = page.getByRole('button', { name: 'Account', exact: true })
  await expect(accountButton).toBeVisible()
  const accountStyle = await accountButton.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      minHeight: style.minHeight,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      borderRadius: style.borderRadius,
      borderColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
    }
  })

  await page.goto('/manual')
  await expect(page).toHaveURL(/\/manual$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Manual' })).toBeVisible()
  await expect(page.getByLabel('Current screen: Manual')).toHaveCount(0)

  const publicHeader = page.getByTestId('public-information-shell').locator(':scope > header')
  const publicNewsLink = publicHeader.getByRole('link', { name: 'News', exact: true })
  await expect(publicHeader.locator('.brand__wordmark small')).toHaveText(
    'Persistent tactical fantasy',
  )
  const publicHeaderStyle = await publicHeader.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      height: rect.height,
      backgroundColor: style.backgroundColor,
      borderBottomColor: style.borderBottomColor,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
    }
  })
  const publicNewsStyle = await publicNewsLink.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      minHeight: style.minHeight,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
    }
  })
  expect(publicHeaderStyle).toEqual(gameHeaderStyle)
  expect(publicNewsStyle).toEqual(gameNewsStyle)

  const returnToGame = page.getByRole('link', { name: 'Return to Game', exact: true })
  await expect(returnToGame).toBeVisible()
  const returnStyle = await returnToGame.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      minHeight: style.minHeight,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      borderRadius: style.borderRadius,
      borderColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
    }
  })
  expect(returnStyle).toEqual(accountStyle)
})
