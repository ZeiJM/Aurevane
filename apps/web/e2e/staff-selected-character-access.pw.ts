import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

// Real signed-in local authority/UI harness. No product fixture route or hosted writes.
function sql(query: string): string {
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!container) throw new Error('Task 8 browser acceptance requires disposable local Supabase.')
  return execFileSync(
    'docker',
    [
      'exec',
      container,
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      query,
    ],
    { encoding: 'utf8' },
  ).trim()
}

test('selected-character Staff & Access keeps authority, UTC duration, focus and responsive controls coherent', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000)
  test.skip(
    info.project.name !== 'desktop-chromium',
    'This single native proof explicitly inspects desktop, 320px and 200% layout.',
  )
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname,
  )
  const suffix = String(Date.now()).replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)))
  const ownerEmail = `staff-owner-${Date.now()}@example.test`
  const targetEmail = `staff-long-verified-identity-${Date.now()}@example.test`
  const targetContext = await browser.newContext()
  const target = await targetContext.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let ownerId = ''
  try {
    await provisionAccountAndEnterCharacter({
      page: target,
      email: targetEmail,
      password: 'Disposable-staff-layout-2026!',
      characterName: `Aurelia ${suffix}`,
    })
    await provisionAccountAndEnterCharacter({
      page,
      email: ownerEmail,
      password: 'Disposable-staff-owner-2026!',
      characterName: `Owner ${suffix}`,
    })
    ownerId = sql(`select id from auth.users where email='${ownerEmail}'`)
    sql(
      `insert into app_private.master_panel_role_assignments(user_id,role) values('${ownerId}','game-owner')`,
    )
    await page.goto('/master/staff')
    await expect(page.getByRole('heading', { name: 'Staff & Access', exact: true })).toBeVisible()
    await expect(
      page.getByTestId('authenticated-shell').locator('[data-av-game-rail]'),
    ).toBeVisible()
    await page.getByLabel('Character name or verified email').fill(targetEmail)
    await page.getByRole('button', { name: 'Find identity' }).click()
    await expect(page.getByRole('heading', { name: 'Character access', exact: true })).toBeFocused()
    await page
      .getByLabel('Linked character · choose exactly one')
      .selectOption({ label: `Aurelia ${suffix}` })
    await page.getByLabel('Content Staff').check()
    await page.getByLabel('Duration', { exact: true }).selectOption('days')
    for (const invalid of ['0', '-1', '0.5', '1000000000', '']) {
      await page.getByLabel('Days', { exact: true }).fill(invalid)
      await expect(page.getByRole('button', { name: 'Save character access' })).toBeDisabled()
      await expect(page.getByText('Enter a positive whole number of days (1–36500).')).toBeVisible()
    }
    await page.getByLabel('Days', { exact: true }).fill('7')
    await expect(page.getByText(/Expiry on save:.*UTC/)).toBeVisible()
    await page.getByLabel(/Confirm access change for/).check()
    for (const [label, width, height, zoom] of [
      ['desktop', 1440, 900, '1'],
      ['laptop', 1366, 768, '1'],
      ['mobile', 390, 844, '1'],
      ['narrow-mobile', 320, 740, '1'],
      ['200-percent-layout', 720, 450, '2'],
    ] as const) {
      await page.setViewportSize({ width, height })
      // CSS zoom tests actual 2x component layout; physical browser UI zoom remains manual acceptance.
      await page.locator('[data-testid="master-panel-shell"]').evaluate((node, value) => {
        ;(node as HTMLElement).style.zoom = value
      }, zoom)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
      await page.getByRole('button', { name: 'Save character access' }).scrollIntoViewIfNeeded()
      await expect(page.getByRole('button', { name: 'Save character access' })).toBeVisible()
      await page.screenshot({ path: info.outputPath(`staff-${label}.png`), fullPage: true })
    }
    await page.locator('[data-testid="master-panel-shell"]').evaluate((node) => {
      ;(node as HTMLElement).style.zoom = '1'
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.getByRole('button', { name: 'Save character access' }).click()
    await expect(page.getByRole('status')).toContainText('access saved')
    expect((await target.request.get('/api/master/access')).status()).toBe(200)
    expect(await (await target.request.get('/api/master/access')).json()).toMatchObject({
      hasAccess: true,
    })
    await target.goto('/master/combat-content')
    await expect(target.getByTestId('master-panel-shell')).toBeVisible()
    const row = page
      .locator('article')
      .filter({ has: page.getByText(targetEmail, { exact: true }) })
    await row.getByRole('button', { name: 'Edit', exact: true }).click()
    await page.getByLabel(/Confirm access change for/).check()
    await page.getByRole('button', { name: 'Revoke access', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('access revoked')
    expect(await (await target.request.get('/api/master/access')).json()).toMatchObject({
      hasAccess: false,
    })
    const denied = await target.request.post('/api/master/combat-content', {
      data: {
        operation: 'save-draft',
        skillId: 'vanguard.forceful-strike',
        expectedDraftVersion: null,
        baseVersion: 1,
        definition: {},
      },
    })
    expect(denied.status()).toBe(403)
    expect(errors).toEqual([])
  } finally {
    if (ownerId)
      sql(
        `update app_private.master_panel_role_assignments set enabled=false where user_id='${ownerId}' and role='game-owner'`,
      )
    await targetContext.close()
  }
})
