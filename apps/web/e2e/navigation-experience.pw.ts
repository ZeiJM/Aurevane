import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

function identity(prefix: string) {
  const seed = `${Date.now()}${Math.floor(Math.random() * 100_000)}`
  const letters = seed
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return {
    email: `${prefix}.${seed}@example.com`,
    characterName: `Navigator ${letters}`,
    password: 'ExperienceTest!42',
  }
}

test('keeps a pending navigation visible and uses a client transition, not a full reload', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === 'laptop-chromium',
    'Desktop and phone exercise the same navigation lifecycle.',
  )
  test.slow()
  await provisionAccountAndEnterCharacter({ page, ...identity('nav-feedback') })

  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let documentRequests = 0
  await page.route('**/game/battle*', async (route) => {
    if (new URL(route.request().url()).pathname !== '/game/battle') return route.continue()
    if (route.request().isNavigationRequest()) documentRequests += 1
    await gate
    await route.continue()
  })

  try {
    const trigger = page.getByRole('button', { name: 'Navigation', exact: true })
    await trigger.click()
    const menu = page.getByRole('navigation', { name: 'Game navigation' })
    const destination = menu.getByRole('link', { name: /Battle Hall/ })
    await destination.focus()
    await page.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await expect(destination.locator('[role="status"]')).toHaveAttribute('data-pending', 'true')
    await expect(destination.locator('[role="status"]')).toHaveText('Opening page…')

    if (testInfo.project.name === 'desktop-chromium') {
      const fonts = await destination.evaluate((link) => ({
        label: parseFloat(getComputedStyle(link.querySelector('strong')!).fontSize),
        detail: parseFloat(getComputedStyle(link.querySelector('small')!).fontSize),
      }))
      expect(fonts.label).toBeGreaterThanOrEqual(14)
      expect(fonts.detail).toBeGreaterThanOrEqual(13)
    }
    release()
    await expect(page).toHaveURL(/\/game\/battle$/)
    await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
    await expect(menu).toBeHidden()
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(documentRequests).toBe(0)
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})

test('presence never blocks the page, overlaps requests or polls a hidden tab', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One deterministic heartbeat lifecycle check.',
  )
  test.slow()
  await provisionAccountAndEnterCharacter({ page, ...identity('presence-feedback') })
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route('**/api/presence', async (route) => {
    requests += 1
    await gate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ count: 7 }),
    })
  })

  await page.clock.install()
  try {
    await page.goto('/game/battle')
    await expect(page.getByRole('heading', { name: 'Choose your arena.' })).toBeVisible()
    const presence = page.getByRole('link', { name: /Online Users/ })
    await expect(presence).toContainText('—')
    await expect.poll(() => requests).toBe(1)
    await page.clock.runFor(120_000)
    // The first request is deliberately unresolved; a second heartbeat must not overlap it.
    expect(requests).toBe(1)
    release()
    await expect(presence).toContainText('7')

    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.clock.runFor(120_000)
    expect(requests).toBe(1)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect.poll(() => requests).toBe(2)
    await expect(presence).toContainText('7')
  } finally {
    release()
    await page.unrouteAll({ behavior: 'wait' })
  }
})
