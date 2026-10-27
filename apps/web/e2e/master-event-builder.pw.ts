import { execFileSync } from 'node:child_process'

import { expect, test, type Page, type Response } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'
import { createEventPageAccessFixture } from './event-page-access-fixture'

let eventPageAccess: ReturnType<typeof createEventPageAccessFixture> | undefined
test.afterEach(() => {
  eventPageAccess?.restore()
  eventPageAccess = undefined
})

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

function grantLocalEventStaff(email: string): void {
  const userId = localUserId(email)
  queryLocalDatabase(`
    insert into app_private.master_panel_character_access(character_id,user_id,roles,special_capabilities,updated_by)
      select c.id,c.user_id,array['event-staff'],array[]::text[],c.user_id from public.characters c
      where c.user_id='${userId}'::uuid order by c.slot_index limit 1
      on conflict(character_id) do update set roles=excluded.roles,special_capabilities=excluded.special_capabilities,enabled=true,access_version=app_private.master_panel_character_access.access_version+1;
  `)
}

function eventRunCount(eventKey: string): number {
  const value = queryLocalDatabase(`
    select count(*)::text
    from app_private.event_runs
    where event_key = '${escapeSqlLiteral(eventKey)}';
  `)
  return Number(value)
}

function isEventOperationResponse(response: Response, operation: string): boolean {
  if (
    response.request().method() !== 'POST' ||
    new URL(response.url()).pathname !== '/api/master/events'
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

async function runEventOperation(
  page: Page,
  operation: string,
  buttonName: string,
): Promise<Record<string, unknown>> {
  const pending = page.waitForResponse((response) => isEventOperationResponse(response, operation))
  const controls = ['preview', 'schedule'].includes(operation)
    ? page.locator('#event-controls')
    : page
  await controls.getByRole('button', { name: buttonName, exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  return (await response.json()) as Record<string, unknown>
}

test('Event Staff uses structured Event Builder without preview state leakage', async ({
  page,
}, testInfo) => {
  test.slow()
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'One authenticated desktop Chromium proof covers the protected Event Builder workflow.',
  )

  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('Event Builder E2E requires disposable local Supabase.')
  }

  const now = Date.now()
  const email = `event-staff-${now}@example.com`
  await createAccountAndEnterCharacter({
    page,
    email,
    password: 'Event-staff-browser-2026!',
    characterName: `Event ${String(now).replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)))}`,
  })

  grantLocalEventStaff(email)
  eventPageAccess = createEventPageAccessFixture(queryLocalDatabase)
  eventPageAccess.set(true)

  await page.goto('/master/events')
  await expect(page.getByRole('heading', { name: 'Persistent Event Definition' })).toBeVisible()
  await expect(page.getByText('Event definition', { exact: true })).toBeVisible()

  const publishButton = page.getByRole('button', { name: 'Publish', exact: true })
  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Schedule', exact: true })
    .click()
  await expect(publishButton).toBeDisabled()
  await expect(page.getByText(/Production publication is disabled/)).not.toBeVisible()

  const eventKey = `event.browser-${now}`
  await page.getByLabel('Event key').fill(eventKey)
  await page.getByRole('button', { name: 'Setup', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'Title', exact: true })
    .fill('Browser Event Builder Verification')

  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Phases', exact: true })
    .click()
  await page.getByRole('button', { name: 'Add objective', exact: true }).click()
  await expect(page.getByLabel('Objective type')).toHaveValue('community-threshold')
  await page.getByLabel('Objective reference').fill('objective.browser-community')
  await page.getByLabel('Objective target').fill('10')

  await page.getByLabel('Show this objective on the map').check()
  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Preview', exact: true })
    .click()

  await runEventOperation(page, 'validate', 'Validate')
  await expect(page.getByText('Definition is valid.')).toBeVisible()

  const runCountBeforePreview = eventRunCount(eventKey)
  const preview = await runEventOperation(page, 'preview', 'Preview')
  expect(preview.preview).toBeTruthy()
  expect(eventRunCount(eventKey)).toBe(runCountBeforePreview)
  await expect(page.getByText('Preview ready. No Event Run was created.')).toBeVisible()

  await runEventOperation(page, 'save-draft', 'Save draft')
  await expect(page.getByText(/Draft v\d+ saved\./)).toBeVisible()

  // Revoke the page behind the open editor: its current controls cannot bypass live access.
  eventPageAccess.set(false)
  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Schedule', exact: true })
    .click()
  await page.getByLabel('Confirm publication or schedule for this audience').check()
  const deniedPublication = page.waitForResponse((response) =>
    isEventOperationResponse(response, 'publish'),
  )
  await publishButton.click()
  expect((await deniedPublication).status()).toBe(403)
  eventPageAccess.set(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Persistent Event Definition' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Schedule', exact: true })
    .click()
  await expect(publishButton).toBeDisabled()

  await page.getByLabel('Event key').fill(eventKey)
  await runEventOperation(page, 'load', 'Load')
  await expect(page.getByLabel('Event key')).toHaveValue(eventKey)
  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Phases', exact: true })
    .click()
  await expect(page.getByLabel('Objective reference')).toHaveValue('objective.browser-community')

  await page
    .getByRole('navigation', { name: 'Event authoring sections' })
    .getByRole('button', { name: 'Schedule', exact: true })
    .click()
  await page.getByLabel('Confirm publication or schedule for this audience').check()
  await expect(publishButton).toBeEnabled()

  const published = await runEventOperation(page, 'publish', 'Publish')
  expect(published.published).toBeTruthy()
  await expect(page.getByText(/Published Event definition v\d+\./)).toBeVisible()
  await expect(
    page.getByLabel('Confirm publication or schedule for this audience'),
  ).not.toBeChecked()

  const start = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16)
  const end = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16)
  await page.getByRole('textbox', { name: 'Start', exact: true }).fill(start)
  await page.getByRole('textbox', { name: 'End', exact: true }).fill(end)
  await page.getByLabel('Confirm publication or schedule for this audience').check()

  await runEventOperation(page, 'schedule', 'Schedule')
  await expect(page.getByText(/Scheduled run [0-9a-f-]+\./)).toBeVisible()
  expect(eventRunCount(eventKey)).toBe(runCountBeforePreview + 1)
  await expect(
    page.getByLabel('Confirm publication or schedule for this audience'),
  ).not.toBeChecked()

  await page.getByLabel('Confirm publication or schedule for this audience').check()
  await runEventOperation(page, 'cancel-scheduled', 'Unschedule')
  await expect(page.getByText('Scheduled run is now cancelled.')).toBeVisible()
})
