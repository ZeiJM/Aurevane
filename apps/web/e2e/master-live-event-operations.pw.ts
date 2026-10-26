import { execFileSync } from 'node:child_process'

import { expect, test, type Page, type Response } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'

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
    insert into app_private.master_panel_character_access(character_id,user_id,roles,special_capabilities,updated_by)
      select c.id,c.user_id,array['event-staff'],array[]::text[],c.user_id from public.characters c
      where c.user_id='${userId}'::uuid order by c.slot_index limit 1
      on conflict(character_id) do update set roles=excluded.roles,enabled=true,access_version=app_private.master_panel_character_access.access_version+1;
  `)
  return userId
}

function grantEmergencyStop(userId: string): void {
  queryLocalDatabase(`
    update app_private.master_panel_character_access
      set special_capabilities=array['events.emergency_stop'],access_version=access_version+1
      where user_id='${userId}'::uuid;
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

async function confirmOperation(page: Page): Promise<void> {
  await page.getByLabel('Confirm the live action below').check()
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
  await createAccountAndEnterCharacter({
    page,
    email,
    password: 'Event-ops-browser-2026!',
    characterName: `Event ${String(now).replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)))}`,
  })

  const userId = grantEventStaff(email)
  const eventKey = `event.browser-ops-${now}`
  const runId = createScheduledRun(userId, eventKey)

  await page.goto('/master')
  const masterNavigation = page.getByRole('navigation', { name: 'Master Panel navigation' })
  await expect(masterNavigation.getByRole('link', { name: /Live Event Ops/ })).toBeVisible()
  await masterNavigation.getByRole('link', { name: /Live Event Ops/ }).click()

  await expect(page.getByRole('heading', { name: 'Event runs', exact: true })).toBeVisible()
  await expect(page.getByText('Operations console', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Event Run').locator(`option[value="${runId}"]`)).toHaveCount(1)
  await page.getByLabel('Event Run').selectOption(runId)

  const runHeader = page
    .locator('header')
    .filter({ has: page.getByText('Authoritative Event Run', { exact: true }) })
  const runStatus = runHeader.locator('[data-status]')
  async function expectRunStatus(status: string) {
    await expect(runHeader.locator('code')).toHaveText(runId)
    await expect(runStatus).toHaveText(status)
    await expect(runStatus).toBeVisible()
  }

  await expectRunStatus('scheduled')
  await expect(page.getByRole('button', { name: 'Emergency stop', exact: true })).toHaveCount(0)

  await confirmOperation(page)
  await clickOperation(page, 'operate', 'Start due run')
  await expectRunStatus('live')
  await expect(page.getByText('announcement.browser-ops')).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Live Event workspace' })
    .getByRole('button', { name: 'Phases', exact: true })
    .click()
  await expect(page.getByText('community')).toBeVisible()

  await confirmOperation(page)
  await clickOperation(page, 'operate', 'Pause')
  await expectRunStatus('paused')

  await confirmOperation(page)
  await clickOperation(page, 'operate', 'Resume')
  await expectRunStatus('live')

  grantEmergencyStop(userId)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Event runs', exact: true })).toBeVisible()
  await page.getByLabel('Event Run').selectOption(runId)
  await expect(page.getByRole('button', { name: 'Emergency stop', exact: true })).toBeVisible()

  await confirmOperation(page)
  await clickOperation(page, 'operate', 'Emergency stop')
  await expectRunStatus('emergency-stopped')
  await page
    .getByRole('navigation', { name: 'Live Event workspace' })
    .getByRole('button', { name: 'Closure', exact: true })
    .click()
  await expect(page.getByText('node.browser-ops')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeDisabled()

  await confirmOperation(page)
  await clickOperation(page, 'complete-cleanup', 'Record manual cleanup acknowledgement')
  await expect(page.getByText(/node\.browser-ops · completed/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeDisabled()

  await confirmOperation(page)
  await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeEnabled()
  await clickOperation(page, 'operate', 'Archive')
  await expectRunStatus('archived')
  await expect(page.getByRole('heading', { name: 'Chronicle snapshot' })).toBeVisible()
  await expect(page.getByText(/"terminalStatus": "emergency-stopped"/)).toBeVisible()
})
