import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter, openOfflineTraining } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Practice ${letters}`
}

test('sets one authoritative Practice plan and freezes overflow as Balanced fallback', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `p16-plan-${projectSlug}-${Date.now()}@example.com`
  const password = 'P16-browser-practice-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await openOfflineTraining(page)

  const planner = page.getByTestId('practice-plan-card')
  await expect(planner).toBeVisible()
  await expect(planner).toContainText('Offline Training')
  await expect(planner).toContainText('Balanced default')
  await expect(planner).toContainText('Short')
  await expect(planner).toContainText('3h 0m')
  await expect(planner).toContainText('Overnight')
  await expect(planner).toContainText('8h 0m')
  await expect(planner).toContainText('Extended')
  await expect(planner).toContainText('1d 0h')
  await expect(page.getByText('Until I Return')).toHaveCount(0)

  let planPayload: Record<string, unknown> | null = null
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/wayfarers-practice/plan')) {
      planPayload = request.postDataJSON() as Record<string, unknown>
    }
  })

  await page.getByRole('button', { name: 'Set Overnight' }).click()
  await expect(planner).toContainText('Plan set')
  await expect(planner).toContainText('Overnight · 8h 0m')
  await expect(page.getByRole('button', { name: 'Overnight set' })).toBeVisible()

  expect(planPayload).toMatchObject({
    version: 1,
    plannedWindow: 'overnight',
  })
  expect(Object.keys(planPayload ?? {}).sort()).toEqual(
    ['characterId', 'idempotencyKey', 'plannedWindow', 'version'].sort(),
  )
  expect(planPayload).not.toHaveProperty('plannedWindowSeconds')
  expect(planPayload).not.toHaveProperty('planSetAt')
  expect(planPayload).not.toHaveProperty('requestedCharacterXp')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Offline Training' })).toBeVisible()
  await expect(page.getByTestId('practice-plan-card')).toContainText('Overnight · 8h 0m')
  expect(await hasHorizontalOverflow(page)).toBe(false)

  const characterId = queryLocalDatabase(`
    select character.id::text
    from public.characters character
    join auth.users account on account.id = character.user_id
    where account.email = '${escapeSqlLiteral(email)}'
    limit 1;
  `)
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)

  const storedPlan = queryLocalDatabase(`
    select planned_window || '|' || planned_window_config_version::text || '|' || planned_window_seconds::text
    from app_private.wayfarers_practice_state
    where character_id = '${characterId}'::uuid;
  `)
  expect(storedPlan).toBe('overnight|1|28800')

  queryLocalDatabase(`
    with boundary as (
      select clock_timestamp() - interval '12 hours' as at
    )
    update app_private.wayfarers_practice_state practice_state
    set
      last_active_at = boundary.at,
      practice_claimed_through_at = boundary.at,
      updated_at = clock_timestamp()
    from boundary
    where practice_state.character_id = '${characterId}'::uuid;
  `)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Offline Training' })).toBeVisible()

  const trainingReport = page.getByTestId('training-report')
  await expect(trainingReport).toBeVisible()
  await expect(trainingReport).toContainText('Planned Overnight')
  await expect(trainingReport).toContainText('+88')
  await expect(trainingReport).toContainText('+0')
  const provenance = page.getByTestId('practice-plan-provenance')
  await expect(provenance).toContainText('Your Overnight plan covered 8h 0m')
  await expect(provenance).toContainText(
    '4h 0m beyond the plan continued automatically as Balanced Practice',
  )
  await expect(provenance).toContainText('explicit plan is now consumed')

  const consumedPlanner = page.getByTestId('practice-plan-card')
  await expect(consumedPlanner).toContainText('Balanced default')
  await expect(consumedPlanner).toContainText('Automatic Balanced Practice')
  expect(await hasHorizontalOverflow(page)).toBe(false)

  await page.reload()
  await expect(page.getByTestId('training-report')).toContainText('Planned Overnight')
  await expect(page.getByTestId('practice-plan-provenance')).toContainText(
    '4h 0m beyond the plan continued automatically as Balanced Practice',
  )
})

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  )
}

function queryLocalDatabase(sql: string): string {
  const dbContainer = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]

  if (!dbContainer) {
    throw new Error('Local Supabase database container is unavailable.')
  }

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

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}
