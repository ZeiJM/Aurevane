import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('training centers one active panel within the desktop viewport', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host))
    throw new Error('Training layout review requires disposable local Supabase.')
  const mobile = testInfo.project.name === 'mobile-chromium'
  await page.setViewportSize({
    width: mobile ? 390 : testInfo.project.name === 'laptop-chromium' ? 1366 : 1728,
    height: mobile ? 844 : 768,
  })
  const nameSuffix = String(Date.now())
    .slice(-7)
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  await provisionAccountAndEnterCharacter({
    page,
    email: `training-concept-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-layout-review-2026!',
    characterName: `Lyra ${nameSuffix}`,
  })
  await page.goto('/game/training')
  const frame = page.locator('[data-training-concept]')
  const planner = page.getByTestId('practice-plan-card')
  const current = page.getByRole('region', { name: 'Current training activity' })
  await expect(frame).toBeVisible()
  await expect(page.locator('[data-av-game-rail]')).toBeVisible()
  await expect(planner).toBeVisible()
  await expect(current).toHaveCount(0)
  const report = page.getByRole('complementary', { name: 'Training report workspace' })
  await expect(report).toHaveCount(0)
  await expect(frame.locator('details, [role="dialog"]')).toHaveCount(0)
  await expect(page.getByRole('radio')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Start Training', exact: true })).toBeEnabled()
  await expect(page.getByRole('radio', { name: 'Short Plan', exact: true })).toBeChecked()
  let starts = 0
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().endsWith('/api/wayfarers-practice/plan')) starts++
  })
  await page.getByRole('radio', { name: 'Medium Plan', exact: true }).check()
  await expect(page.getByRole('radio', { name: 'Medium Plan', exact: true })).toBeChecked()
  expect(starts).toBe(0)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
  if (!mobile) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 1536, height: 614 },
    ]) {
      await page.setViewportSize(viewport)
      const planBox = (await planner.boundingBox())!
      const workspaceBox = (await page.locator('[data-training-workspace]').boundingBox())!
      expect(
        Math.abs(planBox.x + planBox.width / 2 - workspaceBox.x - workspaceBox.width / 2),
      ).toBeLessThanOrEqual(1)
      expect(await planner.evaluate((e) => e.scrollHeight - e.clientHeight)).toBeLessThanOrEqual(1)
      await expect(planner).toBeInViewport({ ratio: 1 })
      expect(
        await page.locator('#game-main').evaluate((e) => e.scrollHeight - e.clientHeight),
      ).toBeLessThanOrEqual(1)
    }
  }
  await expect(page.getByRole('navigation', { name: 'Training sections' })).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Load Preset|Apply Plan|View History/ }),
  ).toHaveCount(0)
})
