import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { createAccountAndEnterCharacter, openOfflineTraining } from './pv1f-test-helpers'

function uniqueCharacterName(): string {
  const letters = Date.now()
    .toString()
    .split('')
    .map((digit) => String.fromCharCode(65 + Number(digit)))
    .join('')
  return `Training ${letters}`
}

test('Passive Training requires an explicit plan and freezes a server-timed reward', async ({
  page,
}, testInfo) => {
  test.slow()

  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const email = `a2-training-${projectSlug}-${Date.now()}@example.com`
  const password = 'A2-browser-training-2026!'
  const characterName = uniqueCharacterName()

  await createAccountAndEnterCharacter({ page, email, password, characterName })
  await openOfflineTraining(page)

  const planner = page.getByTestId('practice-plan-card')
  await expect(planner).toBeVisible()
  await expect(planner).toContainText('Training Plan')
  await expect(planner).toContainText('Idle')
  await expect(planner).toContainText('Short')
  await expect(planner).toContainText('3h 0m')
  await expect(planner).toContainText('10 XP/hr')
  await expect(planner).toContainText('+30 XP')
  await expect(planner).toContainText('Medium')
  await expect(planner).toContainText('8h 0m')
  await expect(planner).toContainText('7 XP/hr')
  await expect(planner).toContainText('+56 XP')
  await expect(planner).toContainText('Extended')
  await expect(planner).toContainText('1d 0h')
  await expect(planner).toContainText('4 XP/hr')
  await expect(planner).toContainText('+96 XP')
  await expect(planner).not.toContainText('Automatic Balanced Practice')
  await expect(page.getByTestId('training-report')).toHaveCount(0)
  expect(await hasHorizontalOverflow(page)).toBe(false)

  const characterId = queryLocalDatabase(`
    select character.id::text
    from public.characters character
    join auth.users account on account.id = character.user_id
    where account.email = '${escapeSqlLiteral(email)}'
    limit 1;
  `)
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)

  const idleState = queryLocalDatabase(`
    select coalesce(planned_window, 'none')
    from app_private.wayfarers_practice_state
    where character_id = '${characterId}'::uuid;
  `)
  expect(idleState).toBe('none')

  let planPayload: Record<string, unknown> | null = null
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/wayfarers-practice/plan')) {
      planPayload = request.postDataJSON() as Record<string, unknown>
    }
  })

  await page.getByRole('button', { name: 'Start Medium' }).click()
  await expect(planner).toContainText('Training active')
  await expect(page.getByTestId('passive-training-active')).toContainText('Medium')
  await expect(page.getByTestId('passive-training-active')).toContainText('+56 XP')
  await expect(page.getByRole('button', { name: 'Stop Training' })).toBeVisible()

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

  const storedPlan = queryLocalDatabase(`
    select planned_window || '|' || planned_window_config_version::text || '|' || planned_window_seconds::text
    from app_private.wayfarers_practice_state
    where character_id = '${characterId}'::uuid;
  `)
  expect(storedPlan).toBe('overnight|1|28800')

  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Battle Hall/ }).click()
  await expect(page.getByRole('heading', { name: 'Choose a battle.' })).toBeVisible()
  await expect(page.getByText('No mode selected')).toBeVisible()
  await page.getByRole('button', { name: /AI Sparring/ }).click()
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(
    page.getByText('Finish or stop Passive Training before starting a new Battle Hall fight.', {
      exact: true,
    }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Navigation' }).click()
  await page.getByRole('link', { name: /Passive Training/ }).click()
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()

  queryLocalDatabase(`
    update app_private.wayfarers_practice_state
    set
      plan_set_at = clock_timestamp() - interval '9 hours',
      updated_at = clock_timestamp()
    where character_id = '${characterId}'::uuid;
  `)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Passive Training' })).toBeVisible()

  const trainingReport = page.getByTestId('training-report')
  await expect(trainingReport).toBeVisible()
  await expect(trainingReport).toContainText('Training Complete')
  await expect(trainingReport).toContainText('Medium complete')
  await expect(trainingReport).toContainText('8h 0m')
  await expect(trainingReport).toContainText('+56')
  await expect(trainingReport).not.toContainText('Balanced Training')

  const consumedPlanner = page.getByTestId('practice-plan-card')
  await expect(consumedPlanner).toContainText('Idle')
  await expect(consumedPlanner).not.toContainText('Training active')
  expect(await hasHorizontalOverflow(page)).toBe(false)

  const frozenReport = queryLocalDatabase(`
    select practice_source || '|' || planned_window || '|' || elapsed_seconds::text || '|' || requested_character_xp::text
    from app_private.training_reports
    where character_id = '${characterId}'::uuid and status = 'pending'
    order by created_at desc
    limit 1;
  `)
  expect(frozenReport).toBe('passive_training|overnight|28800|56')

  await page.reload()
  await expect(page.getByTestId('training-report')).toContainText('Medium complete')
  await expect(page.getByTestId('training-report')).toContainText('+56')

  await page.getByRole('button', { name: 'Claim Training' }).click()
  await expect(page.getByTestId('training-report')).toHaveCount(0)

  const claimedCount = queryLocalDatabase(`
    select count(*)::text
    from app_private.training_report_claims
    where character_id = '${characterId}'::uuid;
  `)
  expect(claimedCount).toBe('1')
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

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
}
