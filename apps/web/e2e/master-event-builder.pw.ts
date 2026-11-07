import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { WorldView } from '../src/world/types'
import { itemFixture } from '../../../packages/game-core/src/content/items-test-fixtures'
import { defaultBasicSkills } from '../../../packages/game-core/src/combat/combat-basic-actions'
import { PV1F_ACTION_ECONOMY_RESOURCE_KEY } from '@aurevane/game-core/combat/pv1f-action-economy'
import { PV1F_BASIC_ATTACK_COST } from '@aurevane/game-core/combat/pv1f-skills'
import { parseRuntimeItemDefinition } from '@aurevane/game-core/content/items'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'

import { expect, test, type Page, type Response, type TestInfo } from '@playwright/test'

import { createAccountAndEnterCharacter } from './pv1f-test-helpers'
import { createEventPageAccessFixture } from './event-page-access-fixture'

let eventPageAccess: ReturnType<typeof createEventPageAccessFixture> | undefined
let fixtureWorldNpc: string | undefined
let fixtureTrialNpc: string | undefined
let fixtureStoryEvent: { eventKey: string; userId: string } | undefined
let fixtureEventOwner: string | undefined
test.afterEach(() => {
  try {
    if (fixtureStoryEvent) {
      const { eventKey, userId } = fixtureStoryEvent
      queryLocalDatabase(`
        do $$
        declare
          run app_private.event_runs%rowtype;
          actor_character_id uuid;
          expected_version bigint;
        begin
          select id into strict actor_character_id from public.characters where user_id='${userId}';
          select * into run from app_private.event_runs where event_key='${eventKey}' for update;
          if run.lifecycle_status = 'scheduled' then
            perform public.cancel_scheduled_event_run_v2('${userId}',actor_character_id,run.id,
              run.state_version,gen_random_uuid(),null,true);
          elsif run.lifecycle_status in ('live','paused','resolving') then
            expected_version := run.state_version;
            if run.lifecycle_status <> 'resolving' then
              select operation.state_version into strict expected_version
              from public.operate_event_run_v2('${userId}',actor_character_id,run.id,
                expected_version,gen_random_uuid(),'stop',null,true) as operation;
            end if;
            perform public.operate_event_run_v2('${userId}',actor_character_id,run.id,
              expected_version,gen_random_uuid(),'end',null,true);
          end if;
        end $$;
      `)
    }
  } finally {
    fixtureStoryEvent = undefined
    eventPageAccess?.restore()
    eventPageAccess = undefined
    if (fixtureEventOwner) {
      queryLocalDatabase(
        `delete from app_private.master_panel_role_assignments where user_id='${fixtureEventOwner}' and role='game-owner'`,
      )
      fixtureEventOwner = undefined
    }
    for (const npcId of [fixtureWorldNpc, fixtureTrialNpc]) {
      if (npcId)
        queryLocalDatabase(`update app_private.npc_designs set world=null where id='${npcId}'`)
    }
    fixtureWorldNpc = undefined
    fixtureTrialNpc = undefined
  }
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
  const result = (await response.json()) as Record<string, unknown>
  expect(response.status(), `${operation}: ${JSON.stringify(result.error ?? null)}`).toBe(200)
  return result
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
  kind: 'travel-and-report' | 'item-exchange' | 'sealed-realm',
) {
  const realm = kind === 'sealed-realm'
  const exchange = kind !== 'travel-and-report'
  test.skip(
    info.project.name !== 'desktop-chromium' && (!realm || info.project.name !== 'mobile-chromium'),
    'Requires a disposable local staff account.',
  )
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
  const joe = randomUUID()
  const guardian = randomUUID()
  const reward = `reward.browser-realm-${token}`
  const budget = `budget.browser-realm-${token}`
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

  if (realm) {
    // Fixtures are confined to disposable Supabase. The player and Event UI
    // still use real session authorization, command RPCs and combat admission.
    fixtureWorldNpc = joe
    queryLocalDatabase(`
      insert into app_private.event_reward_budget_policies values('${budget}','character-xp',100,'${userId}',now());
      insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
        values('${reward}',1,'character-xp',25,'${userId}','${budget}');
      insert into app_private.npc_designs(id,revision,draft,world,story) values
        ('${joe}',1,'{"name":"Farmer Joe","portraitRef":null,"uses":["world","story"],"arena":null}',
         '{"id":"${joe}","revision":1,"name":"Farmer Joe","portraitRef":null,"sectorId":"verdant-expanse","x":2,"y":4,"radius":1,"greeting":"Welcome to the farm."}',
         '{"id":"${joe}","revision":1,"name":"Farmer Joe","portraitRef":null}'),
        ('${guardian}',1,'{"name":"Aurevane","portraitRef":null,"uses":["story"],"arena":null}',null,
         '{"id":"${guardian}","revision":1,"name":"Aurevane","portraitRef":null}');
    `)
  }

  await page.goto('/master/events')
  const sections = page.getByRole('navigation', { name: 'Event authoring sections' })
  const section = (name: string) => sections.getByRole('button', { name, exact: true }).click()
  await section('Setup')
  await page
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption('story-campaigns')
  await page
    .getByRole('combobox', { name: 'Region audience', exact: true })
    .selectOption('verdant-expanse')
  await page.getByLabel('Title', { exact: true }).fill(title)
  await section('Journey')
  await page.getByLabel('Enable a personal quest').check()
  if (exchange) {
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
    await page
      .getByRole('combobox', { name: 'Quest type', exact: true })
      .selectOption('item-exchange')
    await page.getByLabel('Item to hand in').fill(seedId)
    await page.getByLabel('Quantity to hand in').fill('7')
    await page.getByLabel('Item to receive').fill(keyId)
    await page.getByLabel('Offer the quest').fill('The key opens the sealed realm.')
    await page.getByLabel('Explain which items to bring').fill('Bring seven emberseeds.')
    await page.getByLabel('Ask for the items').fill('Hand over seven emberseeds for the key.')
    await page.getByLabel('Confirm completion').fill('The sealed realm is open to you.')
    if (realm) {
      await page.getByLabel('Add a sealed realm and guardian').check()
      await page.getByRole('combobox', { name: 'Quest giver', exact: true }).selectOption(joe)
      await page.getByRole('combobox', { name: 'Guardian', exact: true }).selectOption(guardian)
      await page
        .getByLabel('Explain the sealed realm', { exact: true })
        .fill('The harvest charm opens the old lock.')
      await page
        .getByLabel('Confirm access after hand-in')
        .fill('You have the key. Travel when ready.')
      await page.getByLabel('Introduce the guardian challenge').fill('The guardian waits inside.')
      await page
        .getByLabel('Offer a retry after battle')
        .fill('The key still works. Try again when ready.')
      await section('Rewards')
      await page.getByRole('listbox', { name: 'Reward packages', exact: true }).selectOption(reward)
    }
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
  fixtureStoryEvent = { eventKey, userId }
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

  if (exchange) {
    queryLocalDatabase(`
    select public.grant_character_items_v1('${userId}','${characterId}',
      (public.read_character_item_inventory_v1('${userId}','${characterId}')->>'revision')::bigint,
      'fixture:seeds:${token}',jsonb_build_array(jsonb_build_object('itemId','${seedId}','quantity',14)));
  `)
  }
  await page.goto('/game/world')
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
  const giver = realm ? 'Farmer Joe' : 'Watch officer'
  const talk = () => interaction.getByRole('button', { name: `Talk to ${giver}` }).click()
  const dialogue = page.getByRole('dialog', { name: giver })
  const progress = async () =>
    (await readWorld()).objectives.find((entry) => entry.name === title)?.progress
  await talk()
  await expect(dialogue.getByRole('heading', { name: title, exact: true })).toBeVisible()
  if (realm) {
    const before = (await readWorld()).version
    await dialogue.getByRole('button', { name: 'About the sealed realm' }).click()
    await expect(
      dialogue.getByText('The harvest charm opens the old lock.', { exact: true }),
    ).toBeVisible()
    expect((await readWorld()).version).toBe(before)
    await dialogue.getByRole('button', { name: 'Not now' }).click()
    await talk()
  }
  await dialogue.getByRole('button', { name: 'Accept quest', exact: true }).click()
  if (exchange) {
    await expect.poll(progress).toBe('ready')
    const handOverButton = dialogue.getByRole('button', { name: 'Hand over 7 Emberseeds' })
    await expect(handOverButton).toBeVisible()
    const interactionId = `quest-run-${runId}`
    if (realm) {
      const completed = page.waitForResponse((response) => {
        const request = response.request()
        if (request.method() !== 'POST' || new URL(response.url()).pathname !== '/api/world')
          return false
        const intent = request.postDataJSON()?.intent
        return intent?.interactionId === interactionId && intent.actionId === 'hand-over'
      })
      await handOverButton.click()
      expect((await completed).status()).toBe(200)
    } else {
      const state = await readWorld()
      const handOver = () =>
        page.request.post('/api/world', {
          data: {
            characterId,
            expectedVersion: state.version,
            commandId: randomUUID(),
            intent: { kind: 'interact', interactionId, actionId: 'hand-over' },
          },
        })
      const replies = await Promise.all([handOver(), handOver()])
      expect(replies.map((response) => response.status()).sort()).toEqual([200, 409])
    }
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
    if (realm) {
      await expect(
        dialogue.getByRole('button', { name: 'Travel to the realm', exact: true }),
      ).toBeVisible()
      expect((await readWorld()).position.sectorId).toBe('verdant-expanse')
      await dialogue.getByRole('button', { name: "I'll return later" }).click()
      await talk()
      await dialogue.getByRole('button', { name: 'Travel to the realm', exact: true }).click()
      await expect.poll(async () => (await readWorld()).position.sectorId).toMatch(/^sealed-realm:/)
      await page.reload()
      await openMissions()
      const gate = page.getByRole('button', { name: 'Talk to Sealed realm gate' })
      await gate.click()
      const realmDialog = page.getByRole('dialog', { name: 'Sealed realm gate' })
      const challenge = realmDialog.getByRole('button', { name: 'Challenge the guardian' })
      await expect(challenge).toBeVisible()
      await expect(realmDialog.getByRole('button', { name: 'Leave the realm' })).toBeVisible()
      expect((await readWorld()).battleSessionId).toBeNull()
      await page.screenshot({
        path: info.outputPath('sealed-realm-challenge.png'),
        animations: 'disabled',
      })
      await challenge.click()
      await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}\?returnTo=world/)
      const battle = page.locator('main[data-unified-battle="true"]')
      await expect(battle).toHaveAttribute('data-local-turn', 'true', { timeout: 20_000 })
      await expect(battle).not.toHaveAttribute('aria-busy', 'true')
      await page.getByRole('button', { name: 'Surrender', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm Surrender' }).click()
      await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible()
      await page.goto('/game/world')
      await openMissions()
      await gate.click()
      await expect(
        realmDialog.getByText('The key still works. Try again when ready.', { exact: true }),
      ).toBeVisible()
      await expect(challenge).toBeEnabled()
      await expect.poll(progress).toBe('active')
      return
    }
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

test('Farmer Joe dialogue, realm travel and guardian challenge are separate World actions', async ({
  page,
}, info) => completeAuthoredStoryJourney(page, info, 'sealed-realm'))

async function winRestorationBattle(
  page: Page,
  battleId: string,
  characterId: string,
  weaponName: string,
) {
  const endpoint = `/api/battles/${battleId}`
  const battlefield = page.locator('main[data-unified-battle="true"]')
  const finish = battlefield.getByRole('button', { name: /^End Turn,/ })
  const readBattle = async () => {
    const response = await page.request.get(endpoint)
    expect(response.ok()).toBe(true)
    return ((await response.json()) as { battle: BattleSessionView }).battle.snapshot.tactical
  }
  const commit = async (target: ReturnType<Page['getByRole']>) => {
    const pending = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `${endpoint}/intents`,
    )
    await target.click()
    const response = await pending
    expect(response.ok(), await response.text()).toBe(true)
  }

  await expect(battlefield).toBeVisible()
  const attack = battlefield.locator('[data-battle-command="attack"]')
  await expect(attack).toHaveAccessibleName(new RegExp(`^${weaponName},`))
  for (let command = 0; command < 30; command++) {
    if ((await readBattle()).battle.lifecycle !== 'active') break
    await expect(finish).toBeEnabled({ timeout: 20_000 })
    const state = await readBattle()
    const player = state.battle.combatants.find((unit) => unit.id === `character:${characterId}`)!
    const enemy = state.battle.combatants.find((unit) => unit.teamId === 'opponents')!
    const from = state.placements.find((entry) => entry.combatantId === player.id)!.position
    const to = state.placements.find((entry) => entry.combatantId === enemy.id)!.position
    const ap = player.temporaryResources.find(
      (entry) => entry.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
    )!.current
    const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y)
    await expect(
      battlefield.getByRole('progressbar', { name: 'Action Economy remaining' }),
    ).toHaveAttribute('aria-valuenow', String(ap))
    if (distance === 1 && ap >= PV1F_BASIC_ATTACK_COST) {
      await attack.click()
      const target = battlefield.getByRole('button', {
        name: new RegExp(`^Tile ${to.x + 1}, ${to.y + 1};.*occupied by`),
      })
      await expect(target).toHaveAttribute('data-target', 'enemy')
      await commit(target)
      continue
    }
    if (distance > 1 && ap >= 20 && state.battle.currentTurn!.movementRemaining > 0) {
      await battlefield.locator('[data-battle-command="move"]').click()
      const nearer = await battlefield
        .locator('button[data-reachable]')
        .evaluateAll((tiles, enemyPosition) => {
          return (
            tiles
              .flatMap((tile) => {
                const label = tile.getAttribute('aria-label') ?? ''
                const coordinates = label.match(/^Tile (\d+), (\d+)/)
                if (!coordinates || label.includes('occupied by')) return []
                return [
                  {
                    label,
                    distance:
                      Math.abs(Number(coordinates[1]) - 1 - enemyPosition.x) +
                      Math.abs(Number(coordinates[2]) - 1 - enemyPosition.y),
                  },
                ]
              })
              .sort((left, right) => left.distance - right.distance)[0] ?? null
          )
        }, to)
      if (nearer && nearer.distance < distance) {
        await commit(battlefield.getByRole('button', { name: nearer.label, exact: true }))
        continue
      }
    }
    const ended = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith(`${endpoint}/final-turn`),
    )
    const opponentTurn = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`${endpoint}/recruit-turn`),
    )
    await finish.click()
    await finish.press('KeyD')
    expect((await ended).ok()).toBe(true)
    expect((await opponentTurn).ok()).toBe(true)
  }
  await expect(
    page
      .getByTestId('battle-result-overlay')
      .getByRole('heading', { name: 'Victory', exact: true }),
  ).toBeVisible()
}

async function completeSanalexRestoration(page: Page, info: TestInfo, route: 'recovery' | 'trial') {
  test.skip(info.project.name !== 'desktop-chromium', 'Requires the disposable Owner fixture.')
  test.setTimeout(180_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host))
    throw new Error('Sanalex browser verification requires disposable local Supabase.')

  const token = randomUUID().replaceAll('-', '')
  const email = `restoration-owner-${token}@example.test`
  const title = `Sanalex ${route} ${token.slice(0, 8)}`
  const eventKey = `event.browser-restoration-${token}`
  const giver = randomUUID()
  const opponent = randomUUID()
  const smith = 'Restoration smith'
  const challenger = 'Trial challenger'
  const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
  const checkpoint = { ...position, x: 3 }
  const encounterPosition = { ...position, x: 5 }
  const recoveryReward = `reward.browser-recovery-${token}`
  const trialReward = `reward.browser-trial-${token}`
  const rewardBudget = `budget.browser-restoration-${token}`
  const chosenXp = route === 'recovery' ? 7 : 13
  const first = itemFixture({
    id: `fixture.restoration-first-${token}`,
    name: 'Forge fragment',
    itemClass: 'general',
    inventoryCategory: 'general',
    equipment: null,
    qualityPoints: 0,
  })
  const second = { ...first, id: `fixture.restoration-second-${token}`, name: 'Hilt fragment' }
  const basic = defaultBasicSkills().find((skill) => skill.id === 'unarmed.basic')!.ability!
  // Strong fixture weapons keep the real browser fights bounded without
  // modifying the admitted battle state or bypassing its normal controls.
  const ability = {
    ...basic,
    behaviors: basic.behaviors.map((behavior) => ({
      ...behavior,
      effects: behavior.effects.flatMap((effect) =>
        effect.payload.type === 'damage'
          ? Array.from({ length: 8 }, (_, index) => ({
              ...effect,
              id: `${effect.id}-${index + 1}`,
              payload: { ...effect.payload, amount: 20 },
            }))
          : [effect],
      ),
    })),
  }
  const sword = itemFixture({
    id: `fixture.restoration-sword-${token}`,
    name: 'Mythical Lava Golem Sword of Sanalex',
    itemClass: 'weapon',
    equipment: { slot: 'hand', hands: 1 },
    media: { artworkId: 'item.iron-shortsword.art.v1' },
    ability,
    actions: { attack: { behaviorId: ability.behaviors[0]!.id, name: 'Restored Cut' } },
  })
  const trialWeapon = itemFixture({
    ...sword,
    id: `fixture.trial-weapon-${token}`,
    name: 'Trial fixture blade',
    actions: { attack: { behaviorId: ability.behaviors[0]!.id, name: 'Fixture Trial Cut' } },
  })
  parseRuntimeItemDefinition(sword)
  parseRuntimeItemDefinition(trialWeapon)
  const filler = itemFixture({ id: `fixture.restoration-gear-${token}`, name: 'Spare forge helm' })
  await createAccountAndEnterCharacter({
    page,
    email,
    password: 'Restoration-browser-2026!',
    characterName: `Forge ${token.slice(0, 12).replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)))}`,
  })
  const userId = localUserId(email)
  fixtureEventOwner = userId
  fixtureWorldNpc = giver
  fixtureTrialNpc = opponent
  const draft = {
    name: smith,
    portraitRef: null,
    uses: ['world', 'story'],
    arena: null,
    world: { ...position, radius: 1, greeting: 'Welcome to the forge.' },
  }
  const encounterDraft = {
    name: challenger,
    portraitRef: null,
    uses: ['world'],
    arena: null,
    world: {
      ...encounterPosition,
      radius: 1,
      greeting: 'Enter the trial when ready.',
      encounter: { arenaId: 'duel-yard', aiDifficulty: 'easy', tags: [] },
    },
  }
  queryLocalDatabase(`
    begin;
    insert into app_private.master_panel_role_assignments(user_id,role) values('${userId}','game-owner');
    select public.write_master_npc_design_v1('${userId}',null,'${giver}',0,'save',
      '${escapeSqlLiteral(JSON.stringify(draft))}'::jsonb);
    select public.write_master_npc_design_v1('${userId}',null,'${giver}',1,'commit-story',null);
    select public.write_master_npc_design_v1('${userId}',null,'${giver}',2,'commit-world',null);
    select public.write_master_npc_design_v1('${userId}',null,'${opponent}',0,'save',
      '${escapeSqlLiteral(JSON.stringify(encounterDraft))}'::jsonb);
    select public.write_master_npc_design_v1('${userId}',null,'${opponent}',1,'commit-world',null);
    insert into app_private.event_reward_budget_policies values('${rewardBudget}','character-xp',20,'${userId}',now());
    insert into app_private.event_reward_packages(reward_package_ref,package_version,reward_kind,amount,published_by,budget_ref)
      values('${recoveryReward}',1,'character-xp',7,'${userId}','${rewardBudget}'),
        ('${trialReward}',1,'character-xp',13,'${userId}','${rewardBudget}');
    select public.seed_runtime_item_sources_v1('${escapeSqlLiteral(JSON.stringify([first, second, sword, filler, trialWeapon]))}'::jsonb);
    commit;
  `)
  const readWorld = async (): Promise<WorldView> => {
    const response = await page.request.get('/api/world')
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const characterId = (await readWorld()).characterId
  expect(characterId).toMatch(/^[0-9a-f-]{36}$/)
  expect((await page.request.get('/api/character/items')).ok()).toBe(true)
  queryLocalDatabase(`
    select public.grant_character_items_v1('${userId}','${characterId}',
      (public.read_character_item_inventory_v1('${userId}','${characterId}')->>'revision')::bigint,
      'fixture:restoration:${token}', jsonb_build_array(
        jsonb_build_object('itemId','${first.id}','quantity',1),
        jsonb_build_object('itemId','${second.id}','quantity',1),
        jsonb_build_object('itemId','${filler.id}','quantity',${route === 'trial' ? 39 : 40}-(select count(*)
          from app_private.character_item_stacks where character_id='${characterId}' and inventory_category='gear'))
      ) ${route === 'trial' ? `|| jsonb_build_array(jsonb_build_object('itemId','${trialWeapon.id}','quantity',1))` : ''});
  `)
  const stock = () =>
    JSON.parse(
      queryLocalDatabase(`
        select jsonb_build_object(
          'fragments', coalesce(sum(quantity) filter (where item_id in ('${first.id}','${second.id}')),0),
          'swords', coalesce(sum(quantity) filter (where item_id='${sword.id}'),0),
          'gear', count(*) filter (where inventory_category='gear'))
        from app_private.character_item_stacks where character_id='${characterId}';
      `),
    )
  expect(stock()).toEqual({ fragments: 2, swords: 0, gear: 40 })

  await page.goto('/master/events')
  await page
    .getByRole('navigation', { name: 'Event categories' })
    .getByRole('button', { name: 'Hidden Discoveries', exact: true })
    .click()
  const sections = page.getByRole('navigation', { name: 'Event authoring sections' })
  const section = (name: string) => sections.getByRole('button', { name, exact: true }).click()
  await section('Setup')
  await page
    .getByRole('combobox', { name: 'Category', exact: true })
    .selectOption('hidden-discoveries')
  await page.getByLabel(/^Family/).selectOption('lore-revelation')
  await page.getByLabel(/^Scope/).selectOption('global')
  await page.getByLabel('Title', { exact: true }).fill(title)
  await section('Discovery')
  await page.getByLabel('Enable a carried Item discovery').check()
  await page.getByLabel('First carried Item ID').fill(first.id)
  await page.getByLabel('Second carried Item ID').fill(second.id)
  const clue = 'Two carried fragments fit the empty forge mould.'
  await page.getByLabel('Revealed clue').fill(clue)
  await page.getByLabel('Enable a recovery route').check()
  await page.getByRole('combobox', { name: 'Restoration giver', exact: true }).selectOption(giver)
  await page.getByLabel('Restored weapon Item ID').fill(sword.id)
  const coordinates = page.getByRole('group', { name: 'Restoration checkpoint' })
  await coordinates.getByLabel('Sector', { exact: true }).selectOption(checkpoint.sectorId)
  await coordinates.getByLabel('Cell X', { exact: true }).fill(String(checkpoint.x))
  await coordinates.getByLabel('Cell Y', { exact: true }).fill(String(checkpoint.y))
  await page.getByLabel('Recovery offer', { exact: true }).fill('Visit the forge checkpoint.')
  await page
    .getByLabel('Recovery guidance', { exact: true })
    .fill('Reach the checkpoint and return.')
  await page
    .getByLabel('Ready to restore', { exact: true })
    .fill('Bring both fragments to the forge.')
  await page
    .getByLabel('Restoration completion', { exact: true })
    .fill('The fixture blade is restored.')
  await page.getByLabel('Enable a combat trial').check()
  await page.getByLabel('Trial sector', { exact: true }).selectOption(encounterPosition.sectorId)
  await page.getByLabel('Trial encounter NPC', { exact: true }).selectOption(opponent)
  await page
    .getByLabel('Recovery Character XP package', { exact: true })
    .selectOption(recoveryReward)
  await page.getByLabel('Trial Character XP package', { exact: true }).selectOption(trialReward)
  await page.getByLabel('Trial offer', { exact: true }).fill('Or choose the combat trial.')
  await page
    .getByLabel('Trial guidance', { exact: true })
    .fill('Defeat the challenger in the World.')
  await page
    .getByLabel('Trial ready to restore', { exact: true })
    .fill('The trial is won. Bring both fragments to the forge.')
  await page.screenshot({
    path: info.outputPath(`sanalex-${route}-authoring.png`),
    animations: 'disabled',
  })
  await section('Schedule')
  await page.getByLabel('Event key').fill(eventKey)
  await page.getByLabel('Confirm publication or schedule for this audience').check()
  await runEventOperation(page, 'publish', 'Publish')
  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)
  const end = new Date(Date.now() + 120 * 60 * 1000).toISOString().slice(0, 16)
  await page.getByRole('textbox', { name: 'Start', exact: true }).fill(start)
  await page.getByRole('textbox', { name: 'End', exact: true }).fill(end)
  await page.getByLabel('Confirm publication or schedule for this audience').check()
  fixtureStoryEvent = { eventKey, userId }
  await runEventOperation(page, 'schedule', 'Schedule')
  const runId = queryLocalDatabase(
    `select id from app_private.event_runs where event_key='${eventKey}'`,
  )
  expect(runId).toMatch(/^[0-9a-f-]{36}$/)
  expect((await readWorld()).objectives.some((entry) => entry.name === title)).toBe(false)
  queryLocalDatabase(`
    begin;
    update app_private.event_runs set scheduled_start_at=clock_timestamp()-interval '1 second' where id='${runId}';
    select * from public.operate_event_run_v2('${userId}','${characterId}','${runId}',1,gen_random_uuid(),'start',null,true);
    commit;
  `)

  const openMissions = async () => {
    const details = page.getByRole('button', { name: 'Details', exact: true })
    if (await details.isVisible()) await details.click()
    await page.getByRole('tab', { name: /Missions/ }).click()
  }
  const move = async (destination: typeof position) => {
    const state = await readWorld()
    const response = await page.request.post('/api/world', {
      data: {
        characterId,
        expectedVersion: state.version,
        commandId: randomUUID(),
        intent: { kind: 'walk', destination },
      },
    })
    expect(response.ok()).toBe(true)
    await page.reload()
    await expect
      .poll(async () => (await readWorld()).position, { timeout: 15_000 })
      .toEqual(destination)
    await openMissions()
  }
  const talk = () =>
    page
      .getByRole('region', { name: 'Local interaction' })
      .getByRole('heading', { name: title, exact: true })
      .locator('..')
      .getByRole('button', { name: `Talk to ${smith}` })
      .click()
  const challenge = async (weaponName: string) => {
    await page.goto('/game/world')
    await move(encounterPosition)
    await page
      .getByRole('region', { name: 'Local interaction' })
      .getByRole('heading', { name: 'Challenge', exact: true })
      .locator('..')
      .getByRole('button', { name: `Talk to ${challenger}`, exact: true })
      .click()
    await page
      .getByRole('dialog', { name: challenger })
      .getByRole('button', { name: 'Start battle', exact: true })
      .click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}\?returnTo=world/)
    const battleId = new URL(page.url()).pathname.split('/').at(-1)!
    await winRestorationBattle(page, battleId, characterId, weaponName)
    expect(
      queryLocalDatabase(
        `select outcome from app_private.world_npc_terminal_receipts where battle_session_id='${battleId}'`,
      ),
    ).toBe('victory')
  }
  const dialogue = page.getByRole('dialog', { name: smith })
  await page.goto('/game/world')
  await openMissions()
  await expect(page.getByText(clue)).toBeVisible()
  expect(stock()).toEqual({ fragments: 2, swords: 0, gear: 40 })
  await move(position)
  await talk()
  await expect(dialogue.getByText('Or choose the combat trial.').first()).toBeVisible()
  const chosenLabel = route === 'trial' ? 'Choose trial route' : 'Choose recovery route'
  await dialogue.getByRole('button', { name: chosenLabel, exact: true }).click()
  await dialogue.getByRole('button', { name: 'End conversation' }).click()
  await move(checkpoint)
  await move(position)
  await talk()
  if (route === 'trial') {
    await expect(
      dialogue.getByRole('button', { name: `Restore ${sword.name}`, exact: true }),
    ).toHaveCount(0)
    await expect(
      dialogue.getByRole('button', { name: 'Choose recovery route', exact: true }),
    ).toHaveCount(0)
    await page.goto('/game/loadout/items')
    await page.getByRole('button', { name: /Slot \d+: Trial fixture blade/ }).click()
    await page
      .getByRole('dialog', { name: trialWeapon.name })
      .getByRole('button', { name: 'Equip', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: `Main Hand: ${trialWeapon.name}`, exact: true }),
    ).toBeVisible()
    await challenge(trialWeapon.name)
    await page.screenshot({
      path: info.outputPath('sanalex-trial-victory.png'),
      animations: 'disabled',
    })
    await page.getByRole('button', { name: 'Return to World', exact: true }).click()
    await expect(page).toHaveURL(/\/game\/world/)
    await move(position)
    await talk()
    await expect(
      dialogue
        .getByText('The trial is won. Bring both fragments to the forge.', { exact: true })
        .first(),
    ).toBeVisible()
  }
  const characterXp = () =>
    Number(queryLocalDatabase(`select xp from public.characters where id='${characterId}'`))
  const xpBeforeExchange = characterXp()
  await dialogue.getByRole('button', { name: `Restore ${sword.name}`, exact: true }).click()
  await expect(
    dialogue.getByText(`Hand over 1 ${first.name} and 1 ${second.name} to restore ${sword.name}?`, {
      exact: true,
    }),
  ).toBeVisible()
  expect(stock()).toEqual({ fragments: 2, swords: 0, gear: 40 })
  await dialogue.getByRole('button', { name: 'Keep them for now', exact: true }).click()
  expect(stock()).toEqual({ fragments: 2, swords: 0, gear: 40 })
  await dialogue.getByRole('button', { name: `Restore ${sword.name}`, exact: true }).click()
  await dialogue.getByRole('button', { name: 'Confirm restoration', exact: true }).click()
  await expect.poll(stock).toEqual({ fragments: 0, swords: 0, gear: 40 })
  await expect(dialogue.getByText(/You need an open Gear slot/)).toBeVisible()
  expect(characterXp() - xpBeforeExchange).toBe(chosenXp)
  await page.screenshot({
    path: info.outputPath(`sanalex-${route}-owed.png`),
    animations: 'disabled',
  })

  await page.goto('/game/loadout/items')
  await page
    .getByRole('button', { name: /Slot \d+: Spare forge helm/ })
    .first()
    .click()
  const discard = page.getByRole('dialog', { name: filler.name })
  await discard.getByRole('button', { name: 'Discard stack', exact: true }).click()
  await discard.getByRole('button', { name: 'Confirm discard', exact: true }).click()
  await expect.poll(stock).toEqual({ fragments: 0, swords: 0, gear: 39 })
  await page.goto('/game/world')
  await openMissions()
  await talk()
  const submittedClaim = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/world' &&
      request.postDataJSON()?.intent?.actionId === 'claim-restoration',
  )
  await dialogue.getByRole('button', { name: `Collect ${sword.name}`, exact: true }).click()
  await expect.poll(stock).toEqual({ fragments: 0, swords: 1, gear: 40 })
  await move(checkpoint)
  const replay = await page.request.post('/api/world', {
    data: (await submittedClaim).postDataJSON(),
  })
  expect(replay.ok()).toBe(true)
  expect((await replay.json()).position).toEqual(checkpoint)
  expect(stock()).toEqual({ fragments: 0, swords: 1, gear: 40 })
  expect(characterXp() - xpBeforeExchange).toBe(chosenXp)

  await page.goto('/game/loadout/items')
  await page.getByRole('button', { name: new RegExp(`^Slot \\d+: ${sword.name}`) }).click()
  await page
    .getByRole('dialog', { name: sword.name })
    .getByRole('button', { name: 'Equip', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: `Main Hand: ${sword.name}`, exact: true }),
  ).toBeVisible()
  const equipped = queryLocalDatabase(`
    select slot->'item'->'actions'->'attack'->>'name'
    from jsonb_array_elements(public.read_character_battle_equipment_v1('${userId}','${characterId}')->'equipment') equipped(slot)
    where slot->'item'->>'id'='${sword.id}';
  `)
  expect(equipped).toBe('Restored Cut')
  await page.screenshot({
    path: info.outputPath(`sanalex-${route}-equipped.png`),
    animations: 'disabled',
  })
  if (route === 'recovery') {
    await challenge(sword.name)
    expect(characterXp() - xpBeforeExchange).toBe(chosenXp)
    expect(stock()).toEqual({ fragments: 0, swords: 1, gear: 40 })
    await page.screenshot({
      path: info.outputPath('sanalex-recovery-restored-sword-victory.png'),
      animations: 'disabled',
    })
  }
}

test('an authored Sanalex recovery consumes the fragments and lets a full Gear player wield the owed sword', async ({
  page,
}, info) => completeSanalexRestoration(page, info, 'recovery'))

test('an authored Sanalex combat trial settles only after the canonical NPC victory and awards the trial package', async ({
  page,
}, info) => completeSanalexRestoration(page, info, 'trial'))

test('an authored World NPC challenge admits a battle only within reach', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Uses a disposable World NPC publication.')
  test.setTimeout(90_000)
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host))
    throw new Error('The World NPC browser fixture requires disposable local Supabase.')

  const npcId = randomUUID()
  const token = npcId.replaceAll('-', '')
  const email = `world-opponent-${token}@example.com`
  const name = 'Field opponent'
  const position = { sectorId: 'verdant-expanse', x: 2, y: 4 }
  await createAccountAndEnterCharacter({
    page,
    email,
    password: 'World-opponent-browser-2026!',
    characterName: `Field ${token.slice(0, 12).replace(/\d/g, (d) => String.fromCharCode(65 + Number(d)))}`,
  })
  const userId = localUserId(email)
  fixtureWorldNpc = npcId
  const draft = {
    name,
    portraitRef: null,
    uses: ['world'],
    arena: null,
    world: {
      ...position,
      radius: 1,
      greeting: 'The challenger is waiting.',
      encounter: { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: ['wolf'] },
    },
  }
  queryLocalDatabase(`
    begin;
    insert into app_private.master_panel_role_assignments(user_id,role)
      values('${userId}','game-owner');
    select public.write_master_npc_design_v1('${userId}',null,'${npcId}',0,'save',
      '${escapeSqlLiteral(JSON.stringify(draft))}'::jsonb);
    select public.write_master_npc_design_v1('${userId}',null,'${npcId}',1,'commit-world',null);
    delete from app_private.master_panel_role_assignments
      where user_id='${userId}' and role='game-owner';
    commit;
  `)

  const readWorld = async (): Promise<WorldView> => {
    const response = await page.request.get('/api/world')
    expect(response.ok()).toBe(true)
    return response.json()
  }
  const start = await readWorld()
  const command = (intent: unknown) =>
    page.request.post('/api/world', {
      data: {
        characterId: start.characterId,
        expectedVersion: start.version,
        commandId: randomUUID(),
        intent,
      },
    })
  const interactionId = `npc-challenge-${npcId}`
  const denied = await command({ kind: 'interact', actionId: 'challenge-npc', interactionId })
  expect(denied.status()).toBe(400)
  expect((await denied.json()).error.message).toBe(
    'Stop moving within reach of the NPC before challenging them.',
  )
  expect((await readWorld()).battleSessionId).toBeNull()
  expect(
    queryLocalDatabase(`
      select count(*) from app_private.world_npc_battles
      where character_id='${start.characterId}' and npc_id='${npcId}';
    `),
  ).toBe('0')
  expect((await command({ kind: 'walk', destination: position })).ok()).toBe(true)

  await page.goto('/game/world')
  await expect.poll(async () => (await readWorld()).position, { timeout: 15_000 }).toEqual(position)
  await expect
    .poll(async () =>
      (await readWorld()).interactions.some(
        (row) => row.id === interactionId && row.actionId === 'challenge-npc',
      ),
    )
    .toBe(true)
  await page.reload()
  await page.getByRole('tab', { name: /Missions/ }).click()
  await page
    .getByRole('region', { name: 'Local interaction' })
    .getByRole('heading', { name: 'Challenge', exact: true })
    .locator('..')
    .getByRole('button', { name: `Talk to ${name}` })
    .click()
  const dialogue = page.getByRole('dialog', { name })
  await expect(dialogue.getByRole('button', { name: 'Start battle', exact: true })).toBeVisible()
  await page.screenshot({
    path: info.outputPath('authored-world-npc-challenge.png'),
    animations: 'disabled',
  })
  await dialogue.getByRole('button', { name: 'Start battle', exact: true }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}\?returnTo=world/)
  const battle = page.locator('main[data-unified-battle="true"]')
  await expect(battle).toHaveAttribute('data-local-turn', 'true', { timeout: 20_000 })
  await expect(battle).not.toHaveAttribute('aria-busy', 'true')
  const captured = queryLocalDatabase(`
    select jsonb_build_object('placement',b.placement,'tags',b.tags,'arenaOnly',n.arena is not null)
    from app_private.world_npc_battles b join app_private.npc_designs n on n.id=b.npc_id
    where b.character_id='${start.characterId}' and b.npc_id='${npcId}';
  `)
  expect(JSON.parse(captured)).toEqual({ placement: position, tags: ['wolf'], arenaOnly: false })
  await page.getByRole('button', { name: 'Surrender', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm Surrender' }).click()
  const returnToWorld = page.getByRole('button', { name: 'Return to World', exact: true })
  await expect(returnToWorld).toBeVisible()
  expect(
    queryLocalDatabase(`
      select receipt.outcome
      from app_private.world_npc_terminal_receipts receipt
      join app_private.world_npc_battles battle using (battle_session_id)
      where battle.character_id='${start.characterId}' and battle.npc_id='${npcId}';
    `),
  ).toBe('surrender')
  await expect(page.getByRole('button', { name: /Rematch/ })).toHaveCount(0)
  await returnToWorld.click()
  await expect(page).toHaveURL(/\/game\/world(?:\?|$)/)
})
