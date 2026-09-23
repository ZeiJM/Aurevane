import { expect, test } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('training uses the approved character rail and parchment three-workspace composition', async ({
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

  const frame = page.locator('[data-training-concept]')
  const identity = page.getByTestId('character-profile')
  const planner = page.getByTestId('practice-plan-card')
  const current = page.getByRole('region', { name: 'Current training activity' })
  const report = page.getByRole('complementary', { name: 'Training report workspace' })

  await expect(frame).toBeVisible()
  await expect(identity).toBeVisible()
  await expect(planner).toBeVisible()
  await expect(current).toBeVisible()
  await expect(report).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Training sections' })).toHaveCount(0)

  const metrics = await frame.evaluate((element) => {
    const bounds = (node: Element | null) => {
      if (!node) return null
      const rect = node.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
      }
    }
    const plannerNode = element.querySelector('[data-testid="practice-plan-card"]')!
    const currentNode = element.querySelector('[aria-label="Current training activity"]')
    const reportNode = element.querySelector('[aria-label="Training report workspace"]')
    const identityNode = element.querySelector('[data-testid="character-profile"]')
    return {
      identity: bounds(identityNode),
      planner: bounds(plannerNode)!,
      current: bounds(currentNode),
      report: bounds(reportNode),
      plannerColor: getComputedStyle(plannerNode).color,
      plannerBackground: getComputedStyle(plannerNode).backgroundColor,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    }
  })

  const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
  expect
    .soft(Math.min(...rgb(metrics.plannerBackground)), 'light parchment planner')
    .toBeGreaterThan(180)
  expect
    .soft(Math.max(...rgb(metrics.plannerColor)), 'dark readable planner text')
    .toBeLessThan(100)
  expect.soft(metrics.overflowX, 'no sideways page clipping').toBeLessThanOrEqual(1)

  if (!mobile && metrics.identity && metrics.current && metrics.report) {
    expect.soft(metrics.planner.x).toBeGreaterThanOrEqual(metrics.identity.right)
    expect.soft(metrics.current.x).toBeGreaterThanOrEqual(metrics.planner.right - 1)
    expect.soft(metrics.report.x).toBeGreaterThanOrEqual(metrics.current.right - 1)
    expect.soft(Math.abs(metrics.current.y - metrics.planner.y)).toBeLessThanOrEqual(2)
    expect.soft(Math.abs(metrics.report.y - metrics.planner.y)).toBeLessThanOrEqual(2)
  }

  await expect(page.getByRole('button', { name: 'Start Short', exact: true })).toBeEnabled()
  const durationCards = page.locator('[aria-label="Passive Training durations"] article')
  await expect(durationCards).toHaveCount(3)
  const durationImages = durationCards.locator('img')
  const durationImageSources = await durationImages.evaluateAll((images) =>
    images.map((image) => image.getAttribute('src')),
  )
  expect(new Set(durationImageSources).size).toBe(3)
  const durationImageShapes = await durationImages.evaluateAll((images) =>
    images.map((image) => {
      const bounds = image.getBoundingClientRect()
      return { width: bounds.width, height: bounds.height }
    }),
  )
  for (const shape of durationImageShapes) {
    expect(Math.abs(shape.width - shape.height)).toBeLessThanOrEqual(1)
  }
  for (const number of ['01', '02', '03']) {
    await expect(durationCards.getByText(number, { exact: true })).toHaveCount(0)
  }

  const rewardValues = page.locator('[aria-label="Passive Training durations"] dd')
  await expect(rewardValues).toHaveCount(6)
  expect(
    await rewardValues.first().evaluate((element) =>
      Number.parseInt(getComputedStyle(element).fontWeight, 10),
    ),
  ).toBeLessThanOrEqual(600)
  await expect(
    page.getByRole('button', { name: /Load Preset|Apply Plan|View History/ }),
  ).toHaveCount(0)
  await expect(page.getByText('How Passive Training works', { exact: true })).toBeVisible()
})
