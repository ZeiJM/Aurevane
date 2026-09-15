import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('training uses the approved dark three-panel composition without losing mobile access', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Training layout review requires disposable local Supabase.')
  }
  const mobile = testInfo.project.name === 'mobile-chromium'
  const width = mobile ? 390 : testInfo.project.name === 'laptop-chromium' ? 1366 : 1728
  await page.setViewportSize({ width, height: mobile ? 844 : 887 })
  await provisionAccountAndEnterCharacter({
    page,
    email: `training-concept-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-layout-review-2026!',
    characterName: mobile ? 'Lyra Dawn' : width === 1366 ? 'Lyra Reed' : 'Lyra Vale',
  })
  await page.goto('/game/training')
  await expect(page.getByTestId('practice-plan-card')).toBeVisible()
  const metrics = await page.locator('[data-training-concept]').evaluate((element) => {
    const bounds = (node: Element | null) => {
      if (!node) return null
      const r = node.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right }
    }
    const planner = element.querySelector('[data-testid="practice-plan-card"]')!
    const status = element.querySelector('[aria-label="Current training activity"]')
    const report = element.querySelector('[aria-label="Training report workspace"]')
    return {
      planner: bounds(planner)!,
      status: bounds(status),
      report: bounds(report),
      plannerColor: getComputedStyle(planner).color,
      plannerBackground: getComputedStyle(planner).backgroundColor,
      context: bounds(document.querySelector('[data-av-context-strip]'))!,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    }
  })
  expect.soft(metrics.status, 'current activity has its own permanent panel').not.toBeNull()
  const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  expect.soft(Math.max(...rgb(metrics.plannerBackground)), 'dark ink planner').toBeLessThan(65)
  expect.soft(Math.min(...rgb(metrics.plannerColor)), 'readable light text').toBeGreaterThan(150)
  expect.soft(metrics.overflowX, 'no sideways page clipping').toBeLessThanOrEqual(1)
  if (!mobile) {
    expect.soft(metrics.context.height, 'workspace strip does not consume the page').toBeLessThan(65)
    if (metrics.status && metrics.report) {
      expect.soft(metrics.status.x).toBeGreaterThanOrEqual(metrics.planner.right)
      expect.soft(metrics.report.x).toBeGreaterThanOrEqual(metrics.status.right)
      expect.soft(Math.abs(metrics.status.y - metrics.planner.y)).toBeLessThanOrEqual(2)
      expect.soft(Math.abs(metrics.report.y - metrics.planner.y)).toBeLessThanOrEqual(2)
    }
  }
  await expect(page.getByRole('navigation', { name: 'Training sections' })).toBeVisible()
  const reportLink = page.getByRole('link', { name: 'Training Report', exact: true })
  await reportLink.click()
  const target = page.locator('#training-report-workspace')
  await expect(target).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Start Short', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: /Load Preset|Apply Plan|View History/ })).toHaveCount(0)
})
