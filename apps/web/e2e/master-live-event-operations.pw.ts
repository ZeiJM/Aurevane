import { execFileSync } from 'node:child_process'

import { expect, test, type Page, type Response } from '@playwright/test'

import { createVerifiedAccountAndSignIn } from './pv1f-test-helpers'

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''")
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

function localUserId(email: string): string {
  const userId = queryLocalDatabase(`
    select id::text
    from auth.users
    where email = '${escapeSqlLiteral(email)}'
    limit 1;
  `)
  if (!/^[0-9a-f-]{36}$/.test(userId)) {
    throw new Error('Disposable Event Staff account was not found in local Supabase.')
  }
  return userId
}

function grantEventStaff(email: string): string {
  const userId = localUserId(email)
  queryLocalDatabase(`
    insert into app_private.master_panel_role_assignments (
      user_id, role, enabled, note
    ) values (
      '${userId}'::uuid,
      'event-staff',
      true,
      'P4.14 local browser verification'
    )
    on conflict (user_id, role) do update
    set enabled = true,
        updated_at = clock_timestamp(),
        note = excluded.note;

    insert into app_private.master_panel_access_versions (user_id, access_version)
    values ('${userId}'::uuid, 1)
    on conflict (user_id) do update
    set access_version = app_private.master_panel_access_versions.access_version + 1,
        updated_at = clock_timestamp();
  `)
  return userId
}

function grantEmergencyStop(userId: string): void {
  queryLocalDatabase(`
    insert into app_private.master_panel_capability_grants (
      user_id, capability, enabled, note
    ) values (
      '${userId}'::uuid,
      'events.emergency_stop',
      true,
      'P4.14 local emergency-stop verification'
    )
    on conflict (user_id, capability) do update
    set enabled = true,
        updated_at = clock_timestamp(),
        note = excluded.note;

    update app_private.master_panel_access_versions
    set access_version = access_version + 1,
        updated_at = clock_timestamp()
    where user_id = '${userId}'::uuid;
  `)
}

function createScheduledRun(userId: string, eventKey: string): string {
  const escapedKey = escapeSqlLiteral(eventKey)
  const versionId = queryLocalDatabase(`
    insert into app_private.event_templates (event_key, event_family, created_by)
    values ('${escapedKey}','regional-event','${userId}'::uuid);

    insert into app_private.event_definition_versions (
      event_key, definition_version, definition, published_by
    ) values (
      '${escapedKey}',
      1,
      jsonb_build_object(
        'schemaVersion',1,
        'eventKey','${escapedKey}',
        'templateKey','template.browser-ops',
        'contentVersion',1,
        'title','Browser Live Operations',
        'summary','Browser verification fixture.',
        'internalNotes','CI only.',
        'family','regional-event',
        'scope',jsonb_build_object('type','region','key','region.frostmere'),
        'phases',jsonb_build_array(
          jsonb_build_object(
            'id','mobilization',
            'name','Mobilization',
            'objectives',jsonb_build_array(
              jsonb_build_object(
                'id','community',
                'type','community-threshold',
                'referenceKey','objective.browser-ops',
                'target',10
              )
            ),
            'effects',jsonb_build_array(
              jsonb_build_object(
                'type','world-pulse',
                'referenceKey','announcement.browser-ops',
                'enabled',true
              )
            ),
            'cleanupEffects',jsonb_build_array(
              jsonb_build_object(
                'type','event-node',
                'referenceKey','node.browser-ops',
                'enabled',false
              )
            ),
            'transition',jsonb_build_object('type','manual')
          )
        ),
        'rewardPackageRefs',jsonb_build_array(),
        'aftermathRefs',jsonb_build_array()
      ),
      '${userId}'::uuid
    )
    returning id::text;
  `)
  if (!/^[0-9a-f-]{36}$/.test(versionId)) throw new Error('Event version fixture failed.')

  const runId = queryLocalDatabase(`
    insert into app_private.event_runs (
      event_key,
      definition_version_id,
      run_mode,
      lifecycle_status,
      scope_type,
      scope_key,
      scheduled_start_at,
      current_phase_id,
      created_by
    ) values (
      '${escapedKey}',
      '${versionId}'::uuid,
      'production',
      'scheduled',
      'region',
      'region.frostmere',
      clock_timestamp() - interval '1 minute',
      'mobilization',
      '${userId}'::uuid
    )
    returning id::text;
  `)
  if (!/^[0-9a-f-]{36}$/.test(runId)) throw new Error('Event Run fixture failed.')

  queryLocalDatabase(`
    insert into app_private.event_run_phases (
      run_id, phase_id, ordinal, phase_status
    ) values (
      '${runId}'::uuid,'mobilization',0,'pending'
    );

    insert into app_private.event_run_objectives (
      run_id, phase_id, objective_id, objective_status, progress, target
    ) values (
      '${runId}'::uuid,'mobilization','community','inactive',0,10
    );
  `)

  return runId
}

function isOperationResponse(response: Response, operation: string): boolean {
  if (
    response.request().method() !== 'POST' ||
    new URL(response.url()).pathname !== '/api/master/event-operations'
  ) {
    return false
  }
  try {
    const body = response.request().postDataJSON() as { operation?: unknown }
    return body.operation === operation
  } catch {
    return false
  }
}

async function confirmOperation(page: Page, reason: string): Promise<void> {
  await page.getByLabel('Operation reason').fill(reason)
  await page.getByLabel('Confirm live operation').check()
}

async function clickOperation(page: Page, operation: string, buttonName: string): Promise<void> {
  const pending = page.waitForResponse((response) => isOperationResponse(response, operation))
  await page.getByRole('button', { name: buttonName, exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
}

test('Event Staff operates a run, completes cleanup and archives Chronicle safely', async ({
  page,
}, testInfo) => {
  test.slow()
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated desktop Chromium proof covers P4.14 live Event operations.',
  )

  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Live Event operations E2E requires disposable local Supabase.')
  }

  const now = Date.now()
  const email = `event-ops-${now}@example.com`
  await createVerifiedAccountAndSignIn({
    page,
    email,
    password: 'Event-ops-browser-2026!',
  })

  const userId = grantEventStaff(email)
  const eventKey = `event.browser-ops-${now}`
  const runId = createScheduledRun(userId, eventKey)

  await page.goto('/master')
  await expect(page.getByRole('link', { name: /Live Event Operations/ })).toBeVisible()
  await page.getByRole('link', { name: /Live Event Operations/ }).click()

  await expect(page.getByRole('heading', { name: 'Event runs', exact: true })).toBeVisible()
  await expect(page.getByText('Operations console', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Event Run').locator('option', { hasText: eventKey })).toHaveCount(1)
  await page.getByLabel('Event Run').selectOption(runId)

  await expect(page.getByText('scheduled', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Emergency stop', exact: true })).toHaveCount(0)

  await confirmOperation(page, 'Start browser-verified Event run')
  await clickOperation(page, 'operate', 'Start due run')
  await expect(page.getByText('live', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('announcement.browser-ops')).toBeVisible()
  await expect(page.getByText('community')).toBeVisible()

  await confirmOperation(page, 'Pause browser-verified Event run')
  await clickOperation(page, 'operate', 'Pause')
  await expect(page.getByText('paused', { exact: true }).first()).toBeVisible()

  await confirmOperation(page, 'Resume browser-verified Event run')
  await clickOperation(page, 'operate', 'Resume')
  await expect(page.getByText('live', { exact: true }).first()).toBeVisible()

  grantEmergencyStop(userId)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Event runs', exact: true })).toBeVisible()
  await page.getByLabel('Event Run').selectOption(runId)
  await expect(page.getByRole('button', { name: 'Emergency stop', exact: true })).toBeVisible()

  await confirmOperation(page, 'Emergency stop browser-verified Event run')
  await clickOperation(page, 'operate', 'Emergency stop')
  await expect(page.getByText('emergency-stopped', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('node.browser-ops')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeDisabled()

  await confirmOperation(page, 'Confirm browser-verified typed cleanup')
  await clickOperation(page, 'complete-cleanup', 'Confirm cleanup completed')
  await expect(page.getByText(/node\.browser-ops · completed/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeDisabled()

  await confirmOperation(page, 'Archive browser-verified Event run')
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeEnabled()
  await clickOperation(page, 'operate', 'Archive')
  await expect(page.getByText('archived', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Chronicle snapshot' })).toBeVisible()
  await expect(page.getByText(/"terminalStatus": "emergency-stopped"/)).toBeVisible()
})
