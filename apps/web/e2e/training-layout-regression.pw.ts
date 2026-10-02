import { execFileSync } from 'node:child_process'
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
  const email = `training-layout-${testInfo.project.name}-${Date.now()}@example.test`
  await provisionAccountAndEnterCharacter({
    page,
    email,
    password: 'Disposable-layout-review-2026!',
    characterName: mobile
      ? 'Eira Dawn'
      : testInfo.project.name === 'laptop-chromium'
        ? 'Eira Reed'
        : 'Eira Vale',
  })
  await page.goto('/game/training')
  await expect(page.getByRole('heading', { name: 'Passive Training', exact: true })).toBeVisible()
  await expect(page.locator('[data-av-game-rail]')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Training sections' })).toHaveCount(0)

  async function capture(state: string) {
    const capturedViewport = page.viewportSize()!
    const frame = page.locator('[data-training-concept]')
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      document.getElementById('game-main')?.scrollTo(0, 0)
    })
    const metrics = await frame.evaluate((element) => {
      const panel = element.querySelector(
        '[data-training-stage] > section, [data-training-stage] > aside',
      )!
      const main = document.getElementById('game-main')!
      const rect = panel.getBoundingClientRect()
      const mainRect = main.getBoundingClientRect()
      const controls = [...panel.querySelectorAll<HTMLButtonElement>('button')]
      return {
        panelCount: element.querySelectorAll(
          '[data-training-stage] > section, [data-training-stage] > aside',
        ).length,
        stage: element.querySelector('[data-training-stage]')?.getAttribute('data-training-stage'),
        overflowX: document.documentElement.scrollWidth - innerWidth,
        mainOverflowY: main.scrollHeight - main.clientHeight,
        panelOverflowY: panel.scrollHeight - panel.clientHeight,
        panelOverflowX: panel.scrollWidth - panel.clientWidth,
        panelInsideMain: rect.top >= mainRect.top && rect.bottom <= mainRect.bottom,
        panelCentered:
          Math.abs((rect.left + rect.right) / 2 - (mainRect.left + mainRect.right) / 2) <= 2,
        controlsInPanel: controls.every(
          (button) => button.getBoundingClientRect().bottom <= rect.bottom,
        ),
        minActionHeight: Math.min(
          ...controls.map((button) => button.getBoundingClientRect().height),
        ),
        reportDisclosureCount: element.querySelectorAll('details, [role="dialog"]').length,
      }
    })
    const label = `training-${state}-${capturedViewport.width}x${capturedViewport.height}`
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
    expect.soft(metrics.panelCount, `${label}: one active panel`).toBe(1)
    expect
      .soft(metrics.stage)
      .toBe(state.includes('report') ? 'report' : state === 'active' ? 'current' : 'plan')
    expect.soft(metrics.overflowX).toBeLessThanOrEqual(1)
    expect.soft(metrics.panelOverflowX).toBeLessThanOrEqual(1)
    expect.soft(metrics.reportDisclosureCount).toBe(0)
    expect.soft(metrics.minActionHeight).toBeGreaterThanOrEqual(40)
    expect.soft(metrics.controlsInPanel).toBe(true)
    if (!mobile) {
      expect.soft(metrics.mainOverflowY).toBeLessThanOrEqual(1)
      expect.soft(metrics.panelOverflowY).toBeLessThanOrEqual(1)
      expect.soft(metrics.panelInsideMain).toBe(true)
    }
  }

  await capture('idle')
  if (!mobile) {
    await page.setViewportSize({ width: 1536, height: 614 })
    await capture('compact-idle')
    await page.setViewportSize(viewport)
  }
  await expect(page.getByTestId('practice-plan-card').getByRole('radio')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Start Training', exact: true })).toBeEnabled()
  let claimRequests = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/wayfarers-practice/claim'))
      claimRequests++
  })
  // A second tab can stop and deliberately claim while this tab still shows its old active card.
  await submit(page, 'Start Training', '/api/wayfarers-practice/plan')
  await expect(page.getByTestId('passive-training-active')).toBeVisible()
  const otherTab = await page.context().newPage()
  try {
    await otherTab.goto('/game/training')
    await submit(otherTab, 'Stop Training', '/api/wayfarers-practice/stop')
    await expect(otherTab.getByTestId('training-report')).toBeVisible()
    await expect(otherTab.getByTestId('practice-plan-card')).toHaveCount(0)
    await submit(otherTab, 'Claim Training', '/api/wayfarers-practice/claim')
    await expect(otherTab.getByTestId('practice-plan-card')).toBeVisible()
    const staleStop = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/wayfarers-practice/stop' &&
        response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Stop Training', exact: true }).click()
    const staleStopResponse = await staleStop
    expect(staleStopResponse.ok()).toBe(true)
    expect((await staleStopResponse.json()).stopped).toBe(false)
    await expect(page.getByTestId('practice-plan-card')).toBeVisible()
    await expect(page.getByTestId('training-report')).toHaveCount(0)
    expect(claimRequests).toBe(0)
  } finally {
    await otherTab.close()
  }
  await submit(page, 'Start Training', '/api/wayfarers-practice/plan')
  await expect(page.getByTestId('passive-training-active')).toBeVisible()
  await expect(page.getByTestId('practice-plan-card')).toHaveCount(0)
  await capture('active')
  if (!mobile) {
    await page.setViewportSize({ width: 1536, height: 614 })
    await capture('active')
    await page.setViewportSize(viewport)
  }

  await submit(page, 'Stop Training', '/api/wayfarers-practice/stop')
  await expect(page.getByTestId('training-report')).toBeVisible()
  await expect(page.getByTestId('passive-training-active')).toHaveCount(0)
  await expect(page.getByTestId('practice-plan-card')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Claim Training', exact: true })).toBeEnabled()
  expect(claimRequests).toBe(0)
  await capture('stopped-report')
  let releaseClaim!: () => void
  const claimGate = new Promise<void>((resolve) => {
    releaseClaim = resolve
  })
  await page.route('**/api/wayfarers-practice/claim', async (route) => {
    await claimGate
    await route.continue()
  })
  let releaseRefresh!: () => void
  let blockedRefreshes = 0
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve
  })
  const refreshRoute = /\/game\/training(?:\?.*)?$/
  await page.route(refreshRoute, async (route) => {
    if (route.request().headers()['rsc'] === '1') {
      blockedRefreshes++
      await refreshGate
    }
    await route.continue()
  })
  const claimedResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/wayfarers-practice/claim' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Claim Training', exact: true }).evaluate((button) => {
    // Immediate repeated intent must still issue only one in-flight command.
    const claimButton = button as HTMLButtonElement
    claimButton.click()
    claimButton.click()
    claimButton.click()
  })
  await expect(page.getByRole('button', { name: 'Claiming…', exact: true })).toBeDisabled()
  await expect(page.getByTestId('training-report')).toBeVisible()
  await expect(page.getByTestId('practice-plan-card')).toHaveCount(0)
  expect(claimRequests).toBe(1)
  releaseClaim()
  const claimResponse = await claimedResponse
  expect(claimResponse.ok()).toBe(true)
  const claimBody = await claimResponse.json()
  const claimIntent = claimResponse.request().postDataJSON()
  expect(claimBody.claim).toMatchObject({
    reportId: claimIntent.reportId,
    characterId: claimIntent.characterId,
  })
  await page.unroute('**/api/wayfarers-practice/claim')
  try {
    await expect.poll(() => blockedRefreshes).toBeGreaterThan(0)
    // The acknowledged report clears even while the authoritative page refresh is pending.
    await expect(page.getByTestId('practice-plan-card')).toBeVisible()
    await expect(page.getByTestId('training-report')).toHaveCount(0)
  } finally {
    const refreshedResponse =
      blockedRefreshes > 0
        ? page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/game/training' &&
              response.request().headers()['rsc'] === '1',
          )
        : null
    releaseRefresh()
    if (refreshedResponse) await (await refreshedResponse).finished()
    await page.unroute(refreshRoute)
  }
  expect(claimRequests).toBe(1)
  await capture('stopped-idle')
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start Training', exact: true })).toBeEnabled()
  await submit(page, 'Start Training', '/api/wayfarers-practice/plan')
  await expect(page.getByTestId('passive-training-active')).toBeVisible()
  const claimKeys: string[] = []
  await page.route('**/api/wayfarers-practice/claim', async (route) => {
    claimKeys.push(route.request().postDataJSON().idempotencyKey)
    if (claimKeys.length === 1) {
      await route.fulfill({ status: 200, json: { claim: null } })
    } else if (claimKeys.length === 2) {
      await route.fulfill({
        status: 200,
        json: {
          claim: {
            reportId: '00000000-0000-4000-8000-000000000001',
            characterId: route.request().postDataJSON().characterId,
          },
        },
      })
    } else if (claimKeys.length === 3) {
      await route.fulfill({
        status: 503,
        json: { error: { message: 'Settlement temporarily unavailable.' } },
      })
    } else await route.continue()
  })
  await submit(page, 'Stop Training', '/api/wayfarers-practice/stop')
  await expect(page.getByTestId('training-report')).toBeVisible()
  expect(claimKeys).toHaveLength(0)
  expect(claimRequests).toBe(1)
  for (let attempt = 0; attempt < 2; attempt++) {
    await submit(page, 'Claim Training', '/api/wayfarers-practice/claim')
    await expect(
      page.getByText('The server did not confirm this Training Report. You can safely try again.'),
    ).toBeVisible()
    await expect(page.getByTestId('training-report')).toBeVisible()
    await expect(page.getByTestId('practice-plan-card')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Claim Training', exact: true })).toBeEnabled()
  }
  const failedClaim = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/wayfarers-practice/claim' &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Claim Training', exact: true }).click()
  expect((await failedClaim).status()).toBe(503)
  await expect(page.getByText('Settlement temporarily unavailable.')).toBeVisible()
  await expect(page.getByTestId('practice-plan-card')).toHaveCount(0)
  await capture('failed-report')
  await submit(page, 'Claim Training', '/api/wayfarers-practice/claim')
  await expect(page.getByTestId('practice-plan-card')).toBeVisible()
  expect(claimKeys).toHaveLength(4)
  expect(new Set(claimKeys).size).toBe(1)
  await page.unroute('**/api/wayfarers-practice/claim')
  await submit(page, 'Start Training', '/api/wayfarers-practice/plan')
  await expect(page.getByTestId('passive-training-active')).toBeVisible()
  let completionClaimRequests = 0
  const countClaims = (request: import('@playwright/test').Request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/wayfarers-practice/claim'))
      completionClaimRequests++
  }
  page.on('request', countClaims)
  queryLocalDatabase(`
    update app_private.wayfarers_practice_state
    set plan_set_at = clock_timestamp() - interval '10796 seconds', updated_at = clock_timestamp()
    where character_id = (
      select character.id from public.characters character
      join auth.users account on account.id = character.user_id
      where account.email = '${email.replaceAll("'", "''")}'
      limit 1
    );
  `)
  await page.reload()
  await expect(page.getByTestId('training-report')).toBeVisible()
  await expect(page.getByTestId('passive-training-active')).toHaveCount(0)
  expect(completionClaimRequests).toBe(0)
  await capture('report')
  if (!mobile) {
    await page.setViewportSize({ width: 1536, height: 614 })
    await capture('compact-report')
    await page.setViewportSize(viewport)
  }
  await submit(page, 'Claim Training', '/api/wayfarers-practice/claim')
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  expect(completionClaimRequests).toBe(1)
  page.off('request', countClaims)
  await expect(page.getByTestId('practice-plan-card')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Training', exact: true })).toBeEnabled()
  if (mobile) {
    await page.setViewportSize({ width: 320, height: 740 })
    await expect(page.getByRole('radio', { name: 'Extended Plan' })).toBeVisible()
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

function queryLocalDatabase(sql: string): string {
  const dbContainer = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!dbContainer) throw new Error('Local Supabase database container is unavailable.')
  return execFileSync(
    'docker',
    [
      'exec',
      dbContainer,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim()
}
