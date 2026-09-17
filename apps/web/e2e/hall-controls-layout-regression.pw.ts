import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

async function expectControlsInsidePanel(page: Page, section: 'ai' | 'pvp') {
  const metrics = await page.locator(`[data-hall-workspace="${section}"]`).evaluate((panel) => {
    const body = panel.querySelector('[data-hall-scroll-body]')!
    const area = body.getBoundingClientRect()
    return [...body.querySelectorAll<HTMLElement>('select, input, button')]
      .filter((element) => element.getClientRects().length > 0)
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          name: element.getAttribute('aria-label') || element.id || element.textContent?.trim(),
          visible: rect.top >= area.top - 1 && rect.bottom <= area.bottom + 1,
          height: rect.height,
          fontSize: parseFloat(getComputedStyle(element).fontSize),
        }
      })
  })
  expect(metrics.length).toBeGreaterThan(3)
  for (const control of metrics) {
    expect.soft(control.visible, `${section}: ${control.name} is not clipped`).toBe(true)
    expect.soft(control.height, `${section}: usable control height`).toBeGreaterThanOrEqual(40)
    expect.soft(control.fontSize, `${section}: readable controls`).toBeGreaterThanOrEqual(12)
  }
}

test('desktop Hall keeps arena, difficulty and every PvP setting visible without scrolling', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'mobile-chromium', 'Mobile uses natural document scrolling.')
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Hall controls review requires disposable local Supabase.')
  }
  const suffix = `${Date.now()}`
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await page.setViewportSize({
    width: testInfo.project.name === 'laptop-chromium' ? 1366 : 1728,
    height: testInfo.project.name === 'laptop-chromium' ? 768 : 887,
  })
  await provisionAccountAndEnterCharacter({
    page,
    email: `hall-controls-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-hall-controls-2026!',
    characterName: `Tarin ${suffix}`,
  })
  await page.goto('/game/battle')
  for (const mode of ['recruit-sparring', 'mastery-trial']) {
    await page.getByLabel('Battle mode').selectOption(mode)
    await expectControlsInsidePanel(page, 'ai')
  }
  await page
    .getByRole('navigation', { name: 'Battle Hall sections' })
    .getByRole('button', { name: /Player vs Player/ })
    .click()
  for (const mode of ['1v1', 'flex-teams']) {
    await page.locator('#pvp-mode').selectOption(mode)
    await expectControlsInsidePanel(page, 'pvp')
  }
})
