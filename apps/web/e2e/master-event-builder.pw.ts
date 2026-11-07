import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { WorldView } from '../src/world/types'
import { itemFixture } from '../../../packages/game-core/src/content/items-test-fixtures'

import { expect, test, type Page, type Response, type TestInfo } from '@playwright/test'

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

async function completeAuthoredStoryJourney(
  page: Page,
  info: TestInfo,
  kind: 'travel-and-report' | 'item-exchange',
) {
  test.skip(info.project.name !== 'desktop-chromium', 'Requires a disposable local staff account.')
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error('The Story Campaign browser fixture requires disposable local Supabase.')
  }

  const token = randomUUID().replaceAll('-', '')
  const email = `story-staff-${token}@example.com`
  const title = `Watch ${kind} ${token.slice(0, 8)}`
  const seedId = `fixture.emberseed-${token}`
  const keyId = `fixture.realm-key-${token}`
  const eventKey = `event.browser-story-${token}`
  await createAccountAndEnterCharacter({
    page,
    email,
    password: 'Story-staff-browser-2026!',
    characterName: `Story ${token.slice(0, 12).replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)))}`,
  })
  grantLocalEventStaff(email)
  const userId = localUserId(email)
  eventPageAccess = createEventPageAccessFixture(queryLocalDatabase)
  eventPageAccess.set(true)

  await page.goto('/master/events')
  const sections = page.getByRole('navigation', { name: 'Event authoring sections' })
  const section = (name: string) => sections.getByRole('button', { name, exact: true }).click()
  await section('Setup')
  await page.getByLabel('Category', { exact: true }).selectOption('story-campaigns')
  await page.getByLabel('Region audience', { exact: true }).selectOption('verdant-expanse')
  await page.getByLabel('Title', { exact: true }).fill(title)
  await section('Journey')
  await page.getByLabel('Enable a personal quest').check()
  if (kind === 'item-exchange') {
    const seed = itemFixture({
      id: seedId,
      name: 'Emberseeds',
      inventoryCategory: 'materials',
      itemClass: 'material',
      maximumStack: 5,
      equipment: null,
      qualityPoints: 0,
    })
    const key = itemFixture({
      id: keyId,
      name: 'Realm key',
      inventoryCategory: 'event',
      itemClass: 'event',
      equipment: null,
      qualityPoints: 0,
    })
    queryLocalDatabase(
      `select public.seed_runtime_item_sources_v1('${escapeSqlLiteral(JSON.stringify([seed, key]))}'::jsonb)`,
    )
    await page.getByLabel('Quest type').selectOption(kind)
    await page.getByLabel('Item to hand in').fill(seedId)
    await page.getByLabel('Quantity to hand in').fill('7')
    await page.getByLabel('Item to receive').fill(keyId)
    await page.getByLabel('Offer the quest').fill('The key opens the sealed realm.')
    await page.getByLabel('Explain which items to bring').fill('Bring seven emberseeds.')
    await page.getByLabel('Ask for the items').fill('Hand over seven emberseeds for the key.')
    await page.getByLabel('Confirm completion').fill('The sealed realm is open to you.')
  } else {
    await page.getByLabel('Cell X', { exact: true }).fill('3')
    await page.getByLabel('Offer the quest').fill('Check the nearby path and report to the Watch.')
    await page.getByLabel('Explain where to travel').fill('Reach the next cell along the path.')
    await page.getByLabel('Ask for the report').fill('What did you see on the path?')
    await page.getByLabel('Confirm completion').fill('The Watch recorded your report.')
  }
  await section('Schedule')
  await page.getByLabel('Event key').fill(eventKey)
  await page.getByLabel('Confirm publication or schedule for this audience').check()
  await runEventOperation(page, 'publish', 'Publish')
  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  const end = new Date(Date.now() + 120 * 60 * 1000).toISOString().slice(0, 16)
  await page.getByRole('textbox', { name: 'Start', exact: true }).fill(start)
  await page.getByRole('textbox', { name: 'End', exact: true }).fill(end)
  await page.getByLabel('Confirm publication or schedule for this audience').check()
  await runEventOperation(page, 'schedule', 'Schedule')

  const readWorld = async (): Promise<WorldView> => {
    const response = await page.request.get('/api/world')
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const characterId = (await readWorld()).characterId
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)
  const runId = queryLocalDatabase(
    `select id from app_private.event_runs where event_key='${eventKey}'`,
  )
  expect(runId).toMatch(/^[0-9a-f-]{36}$/)
  // Bring the disposable occurrence due without waiting an hour. Start still uses
  // the production operation RPC and character-specific staff authorization.
  queryLocalDatabase(`
  update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id='${runId}';
  select * from public.operate_event_run_v2('${userId}','${characterId}','${runId}',1,gen_random_uuid(),'start',null,true);
`)

  if (kind === 'item-exchange') {
    queryLocalDatabase(`
    select public.grant_character_items_v1('${userId}','${characterId}',
      (public.read_character_item_inventory_v1('${userId}','${characterId}')->>'revision')::bigint,
      'fixture:seeds:${token}',jsonb_build_array(jsonb_build_object('itemId','${seedId}','quantity',14)));
  `)
  }
  await page.goto('/world')
  const openMissions = async () => {
    const details = page.getByRole('button', { name: 'Details', exact: true })
    if (await details.isVisible()) await details.click()
    await page.getByRole('tab', { name: /Missions/ }).click()
  }
  const move = async (x: number) => {
    const state = await readWorld()
    const response = await page.request.post('/api/world', {
      data: {
        characterId,
        expectedVersion: state.version,
        commandId: randomUUID(),
        intent: { kind: 'walk', destination: { sectorId: 'verdant-expanse', x, y: 4 } },
      },
    })
    expect(response.ok()).toBe(true)
    await page.reload()
    await expect.poll(async () => (await readWorld()).position.x, { timeout: 15_000 }).toBe(x)
    await openMissions()
  }
  await expect(page.locator('[data-world-workspace]')).toBeVisible()
  expect((await readWorld()).interactions.some((entry) => entry.title === title)).toBe(false)
  await move(2)
  const interaction = page
    .getByRole('region', { name: 'Local interaction' })
    .getByRole('heading', { name: title, exact: true })
    .locator('..')
  const talk = () => interaction.getByRole('button', { name: 'Talk to Watch officer' }).click()
  const dialogue = page.getByRole('dialog', { name: 'Watch officer' })
  const progress = async () =>
    (await readWorld()).objectives.find((entry) => entry.name === title)?.progress
  await talk()
  await expect(dialogue.getByRole('heading', { name: title, exact: true })).toBeVisible()
  await dialogue.getByRole('button', { name: 'Accept quest', exact: true }).click()
  if (kind === 'item-exchange') {
    await expect.poll(progress).toBe('ready')
    await expect(dialogue.getByRole('button', { name: 'Hand over 7 Emberseeds' })).toBeVisible()
    const state = await readWorld()
    const exchange = () =>
      page.request.post('/api/world', {
        data: {
          characterId,
          expectedVersion: state.version,
          commandId: randomUUID(),
          intent: {
            kind: 'interact',
            interactionId: `quest-run-${runId}`,
            actionId: 'hand-over',
          },
        },
      })
    const replies = await Promise.all([exchange(), exchange()])
    expect(replies.map((response) => response.status()).sort()).toEqual([200, 409])
    const receipt = queryLocalDatabase(`
    select jsonb_build_object(
      'seed', (select sum(quantity) from app_private.character_item_stacks where character_id='${characterId}' and item_id='${seedId}'),
      'key', (select sum(quantity) from app_private.character_item_stacks where character_id='${characterId}' and item_id='${keyId}'),
      'access', app_private.has_personal_exchange_access_v1('${userId}','${characterId}','${eventKey}')
    );
  `)
    expect(JSON.parse(receipt)).toEqual({ seed: 7, key: 1, access: true })
    await page.reload()
    await openMissions()
    await talk()
    await expect(
      dialogue.getByText('The sealed realm is open to you.', { exact: true }),
    ).toBeVisible()
  } else {
    await expect.poll(progress).toBe('active')
    await dialogue.getByRole('button', { name: 'End conversation' }).click()
    await move(3)
    await expect.poll(progress).toBe('ready')
    await move(2)
    await talk()
    await dialogue.getByRole('button', { name: 'Report back', exact: true }).click()
    await expect.poll(progress).toBe('completed')
    await expect(
      dialogue.getByText('The Watch recorded your report.', { exact: true }).first(),
    ).toBeVisible()
  }
  await page.screenshot({
    path: info.outputPath(`authored-watch-${kind}-complete.png`),
    animations: 'disabled',
  })
  await page.reload()
  await expect.poll(progress).toBe('completed')
}

test('an authored Story Campaign persists accept, confirmed travel and report in the World', async ({
  page,
}, info) => completeAuthoredStoryJourney(page, info, 'travel-and-report'))

test('an authored item exchange settles once when two World requests race', async ({
  page,
}, info) => completeAuthoredStoryJourney(page, info, 'item-exchange'))
