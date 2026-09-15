import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

test('training composition preserves idle, active, report and claim flows', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Training layout review requires disposable local Supabase.')
  }
  const mobile = testInfo.project.name === 'mobile-chromium'
  const viewport = mobile
    ? { width: 390, height: 844 }
    : testInfo.project.name === 'laptop-chromium'
      ? { width: 1366, height: 768 }
      : { width: 1728, height: 887 }
  await page.setViewportSize(viewport)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await provisionAccountAndEnterCharacter({
    page,
    email: `training-layout-${testInfo.project.name}-${Date.now()}@example.test`,
    password: 'Disposable-layout-review-2026!',
    characterName: mobile
      ? 'Eira Dawn'
      : testInfo.project.name === 'laptop-chromium'
        ? 'Eira Reed'
        : 'Eira Vale',
  })
  await page.goto('/game/training')
  await expect(page.getByRole('heading', { name: 'Passive Training', exact: true })).toBeVisible()

  async function capture(state: string) {
    const frame = page.locator('[data-training-concept]')
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document.getElementById('game-main')?.scrollTo(0, 0)
    })
    const metrics = await frame.evaluate((element) => {
      const bounds = (node: Element) => {
        const r = node.getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }
      }
      const scene = element.querySelector('[data-training-scene]')!
      const planner = element.querySelector('[data-testid="practice-plan-card"]')!
      const actions = [
        ...planner.querySelectorAll<HTMLButtonElement>(
          '[aria-label="Passive Training durations"] button',
        ),
      ]
      const report = element.querySelector('[aria-label="Training report workspace"]')
      return {
        countdownSize: (() => {
          const clock = [...element.querySelectorAll('#training-current strong')].find((node) =>
            /^\d{2}:\d{2}:\d{2}$/.test(node.textContent?.trim() ?? ''),
          )
          return clock ? parseFloat(getComputedStyle(clock).fontSize) : null
        })(),
        durationActionsInPanel: actions.every((button) => {
          const rect = button.getBoundingClientRect()
          return (
            rect.y >= planner.getBoundingClientRect().y &&
            rect.bottom <= planner.getBoundingClientRect().bottom
          )
        }),
        stopActionInPanel: (() => {
          const activity = element.querySelector('#training-current')!
          const button = activity.querySelector('button')
          return (
            !button ||
            button.getBoundingClientRect().bottom <= activity.getBoundingClientRect().bottom
          )
        })(),
        frame: bounds(element),
        scene: bounds(scene),
        planner: bounds(planner),
        overflowX: document.documentElement.scrollWidth - innerWidth,
        plannerOverflowX: planner.scrollWidth - planner.clientWidth,
        hasReportWorkspace: report !== null,
        minActionHeight: Math.min(
          ...actions.map((button) => button.getBoundingClientRect().height),
        ),
        descriptionSize: parseFloat(
          getComputedStyle(planner.querySelector('[aria-label="Passive Training durations"] p')!)
            .fontSize,
        ),
      }
    })
    const label = `training-${state}-${viewport.width}x${viewport.height}`
    const output = process.env.LAYOUT_REVIEW_OUTPUT
    if (output) {
      await mkdir(output, { recursive: true })
      await writeFile(path.join(output, `${label}.json`), JSON.stringify(metrics, null, 2))
      await page.screenshot({ path: path.join(output, `${label}.png`), fullPage: true })
      await page.screenshot({ path: path.join(output, `${label}-viewport.png`) })
      if (mobile && state === 'report') {
        await page.locator('#training-report-workspace').scrollIntoViewIfNeeded()
        await page.screenshot({ path: path.join(output, `${label}-claim.png`) })
      }
    }
    expect
      .soft(metrics.overflowX, `${label}: document stays inside viewport`)
      .toBeLessThanOrEqual(1)
    expect
      .soft(metrics.plannerOverflowX, `${label}: planner never clips controls`)
      .toBeLessThanOrEqual(1)
    expect
      .soft(metrics.hasReportWorkspace, `${label}: dedicated real report/empty state`)
      .toBe(true)
    expect
      .soft(metrics.minActionHeight, `${label}: usable duration actions`)
      .toBeGreaterThanOrEqual(40)
    expect
      .soft(metrics.descriptionSize, `${label}: readable option descriptions`)
      .toBeGreaterThanOrEqual(12)
    if (state === 'active') {
      expect
        .soft(metrics.countdownSize, `${label}: readable live countdown`)
        .toBeGreaterThanOrEqual(28)
    }
    if (!mobile) {
      expect
        .soft(
          metrics.durationActionsInPanel,
          `${label}: all duration actions visible without scrolling`,
        )
        .toBe(true)
      expect
        .soft(metrics.stopActionInPanel, `${label}: stop action visible without scrolling`)
        .toBe(true)
      expect
        .soft(metrics.scene.width, `${label}: wide scenic header`)
        .toBeGreaterThan(metrics.frame.width * 0.9)
      expect
        .soft(metrics.scene.height, `${label}: scenery leaves room for actions`)
        .toBeLessThan(viewport.height * 0.4)
      expect
        .soft(metrics.planner.y, `${label}: planner below scene`)
        .toBeGreaterThanOrEqual(metrics.scene.bottom - 1)
    }
  }

  await capture('idle')
  await expect(page.locator('[aria-label="Passive Training durations"] button')).toHaveCount(3)
  await submit(page, 'Start Short', '/api/wayfarers-practice/plan')
  await expect(page.getByTestId('passive-training-active')).toBeVisible()
  for (const action of await page
    .locator('[aria-label="Passive Training durations"] button')
    .all()) {
    await expect(action).toBeDisabled()
  }
  await capture('active')

  await submit(page, 'Stop Training', '/api/wayfarers-practice/stop')
  await expect(page.getByTestId('training-report')).toBeVisible()
  await expect(page.getByTestId('passive-training-active')).toHaveCount(0)
  await capture('report')
  await submit(page, 'Claim Training', '/api/wayfarers-practice/claim')
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start Short', exact: true })).toBeEnabled()
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 740 })
    await expect(page.getByRole('button', { name: 'Start Extended' })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([])
})

async function submit(page: Page, name: string, endpoint: string) {
  const response = page.waitForResponse(
    (item) => new URL(item.url()).pathname === endpoint && item.request().method() === 'POST',
  )
  await page.getByRole('button', { name, exact: true }).click()
  expect((await response).ok()).toBe(true)
}
