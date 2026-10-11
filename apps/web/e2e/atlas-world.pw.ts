import { randomUUID } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { expect, test, type APIResponse, type Page, type TestInfo } from '@playwright/test'
import type { SetPracticePlanRequest } from '@aurevane/validation/player/wayfarers-practice'
import { provisionAccountAndEnterCharacter, openOfflineTraining } from './pv1f-test-helpers'
import { STEP_MS, WORLD_REGIONS } from '../src/world/catalog'
import { newWorldState } from '../src/world/travel'
import type { WorldView } from '../src/world/types'
import type { CharacterBuildContext } from '../src/server/character/character-build-service'

function localDatabase(): string {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid').hostname
  if (!['127.0.0.1', 'localhost'].includes(host))
    throw new Error('Atlas acceptance requires disposable local Supabase.')
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!container) throw new Error('Local test database is unavailable.')
  return container
}
function sql(query: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      localDatabase(),
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
// Hold only these disposable accounts' mutation locks until the real HTTP
// requests are demonstrably waiting in Postgres. This tests contention rather
// than relying on Promise.all happening to overlap on a fast runner.
async function contend(
  characterIds: string[],
  send: () => Promise<APIResponse>[],
  whileBlocked?: () => Promise<void>,
) {
  for (const id of characterIds) expect(id).toMatch(/^[0-9a-f-]{36}$/)
  const application = `atlas-gate-${randomUUID()}`
  const gate = spawn(
    'docker',
    [
      'exec',
      '-e',
      `PGAPPNAME=${application}`,
      localDatabase(),
      'psql',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      `begin; select pg_advisory_xact_lock(hashtextextended(user_id::text,1)) from public.characters where id in (${characterIds.map((id) => `'${id}'::uuid`).join(',')}) order by user_id; select pg_sleep(45); rollback;`,
    ],
    { stdio: 'ignore' },
  )
  const closed = new Promise<void>((resolve) => {
    gate.once('exit', () => resolve())
    gate.once('error', () => resolve())
  })
  let pending: Promise<APIResponse>[] = []
  try {
    await expect
      .poll(
        () =>
          sql(
            `select count(*) from pg_stat_activity where application_name='${application}' and wait_event='PgSleep'`,
          ),
        { timeout: 10000 },
      )
      .toBe('1')
    pending = send()
    // Register rejection handlers immediately while the requests are blocked.
    const completed = Promise.allSettled(pending)
    await expect
      .poll(
        () =>
          Number(
            sql(
              `select count(distinct waiter.pid) from pg_locks waiter join pg_locks holder on waiter.locktype=holder.locktype and waiter.database=holder.database and waiter.classid=holder.classid and waiter.objid=holder.objid and waiter.objsubid=holder.objsubid join pg_stat_activity activity on activity.pid=holder.pid where holder.granted and not waiter.granted and holder.locktype='advisory' and activity.application_name='${application}'`,
            ),
          ),
        { timeout: 10000 },
      )
      .toBe(pending.length)
    await whileBlocked?.()
    sql(
      `select pg_terminate_backend(pid) from pg_stat_activity where application_name='${application}'`,
    )
    await completed
    return await Promise.all(pending)
  } finally {
    // Terminate only the uniquely named test-owned connection, even on failure.
    sql(
      `select pg_terminate_backend(pid) from pg_stat_activity where application_name='${application}'`,
    )
    await Promise.allSettled(pending)
    await closed
  }
}

async function enter(page: Page) {
  const name = `Atlas ${randomUUID()
    .replaceAll('-', '')
    .slice(0, 12)
    .replace(/[0-9]/g, (d) => String.fromCharCode(65 + Number(d)))}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `atlas-${randomUUID()}@example.com`,
    password: 'Atlas-browser-2026!',
    characterName: name,
  })
  // Exercise the real SQL schema as well as HTTP; a missing column should produce
  // its actual database error here instead of only a generic recovery-page timeout.
  sql(
    `select public.read_world_state_v1(c.user_id,c.id,'${JSON.stringify({ ...newWorldState(), safe: false })}'::jsonb) from public.characters c where c.name='${name}';`,
  )
  await page
    .getByRole('navigation', { name: 'Primary game navigation', exact: true })
    .getByRole('link', { name: /Travel/ })
    .click()
  await expect(page.locator('[data-world-workspace]')).toBeVisible()
  return name
}
async function world(page: Page): Promise<WorldView> {
  const response = await page.request.get('/api/world')
  expect(response.ok()).toBe(true)
  return response.json()
}
function place(characterId: string, sectorId: string, x: number, y: number, safe = false) {
  // Fixture setup only; all exercised commands still pass through real auth and server authority.
  sql(
    `update app_private.character_world_state set state = state || '${JSON.stringify({ position: { sectorId, x, y }, safe, route: [], nextStepAt: null, routeObjectiveId: null })}'::jsonb where character_id='${characterId}'::uuid;`,
  )
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

const stageOf = (page: Page) => page.frameLocator('[data-world-stage]')
async function openJournal(page: Page) {
  const toggle = page.getByRole('button', { name: /Journal/ })
  await expect(toggle).toBeVisible()
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(page.getByRole('complementary', { name: 'Journal' })).toBeVisible()
}
async function reloadWorld(page: Page) {
  await page.reload()
  await openJournal(page)
}
async function expectLocation(page: Page, name: string) {
  await expect(stageOf(page).locator('#loc-title')).toContainText(name, { timeout: 15000 })
}
// Simulates the stage posting a walk intent, exactly as a map click does.
async function stageWalk(page: Page, destination: { sectorId: string; x: number; y: number }) {
  const stage = page.frames().find((f) => f.url().includes('/world-stage/'))!
  await stage.evaluate(
    (d) => parent.postMessage({ av: 'world-stage', type: 'walk', destination: d }, location.origin),
    destination,
  )
}

test('the World page is the scenic map stage inside the shared shell, with Journal, globe and 360 view', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const name = await enter(page)
  const initial = await world(page)
  for (const id of [
    ...WORLD_REGIONS.map((region) => region.id),
    'crown-road',
    'coastal-road',
    'ember-road',
    'southern-caravan-road',
    'highland-road',
    'northern-pass',
    'eastern-march-road',
    'old-coast-road',
  ])
    expect(initial.sectors.find((sector) => sector.id === id)).toBeDefined()
  expect(JSON.stringify(initial)).not.toContain('survey-01')
  const rail = page.locator('[data-av-game-rail]')
  await expect(rail).toBeVisible()
  const railBox = (await rail.boundingBox())!
  if (info.project.name === 'mobile-chromium') {
    await expect(
      page.getByRole('navigation', { name: 'Primary game navigation', exact: true }),
    ).toBeVisible()
    expect(railBox.height).toBeLessThan(100)
  } else {
    const identity = page.getByTestId('authenticated-shell').getByTestId('character-rail-profile')
    await expect(identity).toBeVisible()
    const identityBox = (await identity.boundingBox())!
    for (const content of [
      identity.locator('[data-character-identity-copy] > strong').filter({ hasText: name }),
      identity.locator('[data-character-resource="hp"]'),
      identity.locator('[data-character-resource="mp"]'),
    ]) {
      const bounds = (await content.boundingBox())!
      expect(bounds.x).toBeGreaterThanOrEqual(identityBox.x)
      expect(bounds.y).toBeGreaterThanOrEqual(identityBox.y)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(identityBox.x + identityBox.width)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(identityBox.y + identityBox.height)
    }
    expect(railBox.width).toBe(190)
  }
  const frame = stageOf(page)
  await expectLocation(page, 'Verdant Expanse')
  await expect(frame.locator('#nav-svg')).toBeVisible()
  await expect(frame.locator('#sb-time')).toContainText('UTC')
  await expect(frame.locator('#sb-wx')).not.toBeEmpty()
  await expect(frame.locator('#tab-nb')).toBeVisible()
  await expect(frame.locator('#zone-badge')).toBeVisible()
  const stageBox = (await page.locator('[data-world-stage]').boundingBox())!
  expect(stageBox.height).toBeGreaterThan(300)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
  expect(name).toBeTruthy()
  await capture(page, info, 'world-stage')
  await openJournal(page)
  await page
    .getByRole('button', { name: /Start Auto-path/ })
    .first()
    .click()
  await expect(page.getByRole('button', { name: /Stop Auto-path/ })).toBeVisible()
  await expect.poll(async () => (await world(page)).position.x).toBeGreaterThan(5)
  await page.getByRole('button', { name: /Stop Auto-path/ }).click()
  await expect.poll(async () => (await world(page)).route.length).toBe(0)
  const stopped = await world(page)
  const command = {
    characterId: stopped.characterId,
    expectedVersion: stopped.version,
    commandId: randomUUID(),
    intent: { kind: 'stop' },
  }
  const first = await page.request.post('/api/world', { data: command })
  expect(first.ok()).toBe(true)
  const replay = await page.request.post('/api/world', { data: command })
  expect(replay.ok()).toBe(true)
  expect((await replay.json()).version).toBe((await first.json()).version)
  const conflict = await page.request.post('/api/world', {
    data: { ...command, intent: { kind: 'cross' } },
  })
  expect(conflict.status()).toBe(409)
  await page.getByRole('button', { name: 'Close' }).click()
  await frame.locator('#v-toggle').click()
  await expect(frame.locator('#stage-world')).toBeVisible()
  await expect(frame.locator('#globe-svg')).toBeVisible()
  await capture(page, info, 'world-globe')
  await frame.locator('#v-toggle').click()
  await expect(frame.locator('#stage-world')).toBeHidden()
  await page.getByRole('button', { name: /View 360/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Verdant Expanse' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Look right' }).click()
  await capture(page, info, 'world-surroundings')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: /View 360/ })).toBeFocused()
  if (info.project.name === 'desktop-chromium') {
    for (const region of WORLD_REGIONS) {
      place(initial.characterId, region.id, 5, 4)
      await page.reload()
      await expectLocation(page, region.name)
      await capture(page, info, `sector-${region.id}`)
      const loaded = page.waitForResponse(
        // A previously viewed panorama may be revalidated from the browser cache.
        (r) =>
          r.url().endsWith(`/${region.id}-panorama-v01.webp`) && (r.ok() || r.status() === 304),
        { timeout: 15000 },
      )
      await page.getByRole('button', { name: /View 360/ }).click()
      await loaded
      await expect(dialog.locator('canvas')).toBeVisible()
      await dialog.getByRole('button', { name: 'Look right' }).click()
      await capture(page, info, `panorama-${region.id}`)
      await page.keyboard.press('Escape')
    }
  }
})

test('Eastern Watch objective persists accept, inspect and idempotent return completion', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Objective authority is viewport independent.',
  )
  test.setTimeout(60000)
  await enter(page)
  const initial = await world(page)
  place(initial.characterId, 'verdant-expanse', 2, 4, true)
  await reloadWorld(page)

  const interaction = page.getByRole('region', { name: 'Local interaction' })
  await expect(interaction.getByRole('heading', { name: 'The Eastern Watch' })).toBeVisible()
  await expect(interaction).toContainText('Watch officer')
  await page.getByRole('button', { name: 'Accept objective' }).click()
  await expect(page.getByText('Reach the eastern watchtower across the river.')).toBeVisible()
  let state = await world(page)
  expect(state.objectives.find((objective) => objective.id === 'eastern-watch')).toMatchObject({
    progress: 'active',
    completed: false,
  })

  await reloadWorld(page)
  await expect(page.getByText('Reach the eastern watchtower across the river.')).toBeVisible()
  place(initial.characterId, 'verdant-expanse', 12, 4, false)
  await reloadWorld(page)
  state = await world(page)
  const inspect = await page.request.post('/api/world', {
    data: {
      characterId: state.characterId,
      expectedVersion: state.version,
      commandId: randomUUID(),
      intent: { kind: 'tick' },
    },
  })
  expect(inspect.ok()).toBe(true)
  await reloadWorld(page)
  await expect(
    page.getByText('Return to the protected settlement and report to the watch officer.'),
  ).toBeVisible()
  expect(
    (await world(page)).objectives.find((objective) => objective.id === 'eastern-watch'),
  ).toMatchObject({
    progress: 'ready',
    completed: false,
  })

  place(initial.characterId, 'verdant-expanse', 2, 4, true)
  await reloadWorld(page)
  const reportRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/world' &&
      request.method() === 'POST' &&
      request.postDataJSON()?.intent?.kind === 'interact',
  )
  await page.getByRole('button', { name: 'Report back' }).click()
  const reportCommand = (await reportRequest).postDataJSON()
  await expect(page.getByText('The eastern route has been verified.')).toBeVisible()
  state = await world(page)
  const completed = state.objectives.find((objective) => objective.id === 'eastern-watch')!
  expect(completed).toMatchObject({ progress: 'completed', completed: true, destination: null })
  expect(state.interactions[0]).toMatchObject({ progress: 'completed', actionLabel: null })
  const version = state.version

  const replay = await page.request.post('/api/world', { data: reportCommand })
  expect(replay.ok()).toBe(true)
  expect((await replay.json()).version).toBe(version)
  await reloadWorld(page)
  await expect(page.getByRole('button', { name: 'Report back' })).toHaveCount(0)
  expect((await world(page)).version).toBe(version)
})

test('Crown Hinterland patrol persists accept, field check and idempotent return completion', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Objective authority is viewport independent.',
  )
  test.setTimeout(60000)
  await enter(page)
  const initial = await world(page)
  place(initial.characterId, 'aureth-crown', 2, 4, true)
  await reloadWorld(page)

  const interaction = page.getByRole('region', { name: 'Local interaction' })
  await expect(interaction.getByRole('heading', { name: 'Hinterland Patrol' })).toBeVisible()
  await expect(interaction).toContainText('Watch officer')
  await page.getByRole('button', { name: 'Accept objective' }).click()
  await expect(page.getByText('Reach the central road in Crown Hinterland.')).toBeVisible()
  let state = await world(page)
  expect(
    state.objectives.find((objective) => objective.id === 'crown-hinterland-patrol'),
  ).toMatchObject({
    progress: 'active',
    completed: false,
  })

  await reloadWorld(page)
  await expect(page.getByText('Reach the central road in Crown Hinterland.')).toBeVisible()
  place(initial.characterId, 'crown-hinterland', 6, 4, false)
  await reloadWorld(page)
  state = await world(page)
  const inspect = await page.request.post('/api/world', {
    data: {
      characterId: state.characterId,
      expectedVersion: state.version,
      commandId: randomUUID(),
      intent: { kind: 'tick' },
    },
  })
  expect(inspect.ok()).toBe(true)
  await reloadWorld(page)
  await expect(
    page.getByText('Return to the Aureth Crown settlement and report to the watch officer.'),
  ).toBeVisible()
  expect(
    (await world(page)).objectives.find((objective) => objective.id === 'crown-hinterland-patrol'),
  ).toMatchObject({
    progress: 'ready',
    completed: false,
  })

  place(initial.characterId, 'aureth-crown', 2, 4, true)
  await reloadWorld(page)
  const reportRequest = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === '/api/world' &&
      request.method() === 'POST' &&
      request.postDataJSON()?.intent?.kind === 'interact',
  )
  await page.getByRole('button', { name: 'Report back' }).click()
  const reportCommand = (await reportRequest).postDataJSON()
  await expect(page.getByText('The Crown Hinterland patrol has been recorded.')).toBeVisible()
  state = await world(page)
  const completed = state.objectives.find(
    (objective) => objective.id === 'crown-hinterland-patrol',
  )!
  expect(completed).toMatchObject({ progress: 'completed', completed: true, destination: null })
  expect(state.interactions[0]).toMatchObject({ progress: 'completed', actionLabel: null })
  const version = state.version

  const replay = await page.request.post('/api/world', { data: reportCommand })
  expect(replay.ok()).toBe(true)
  expect((await replay.json()).version).toBe(version)
  await reloadWorld(page)
  await expect(page.getByRole('button', { name: 'Report back' })).toHaveCount(0)
  expect((await world(page)).version).toBe(version)
})

test('expired training releases travel without claiming XP and frontier discovery stays private', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Authority is viewport independent.')
  test.setTimeout(90000)
  await enter(page)
  const initial = await world(page)
  await openOfflineTraining(page)
  await page.getByRole('radio', { name: 'Medium Plan', exact: true }).check()
  await page.getByRole('button', { name: 'Start Training', exact: true }).click()
  await expect(page.getByTestId('passive-training-active')).toBeVisible()
  await page.goto('/game/world')
  await expect(page.getByRole('status')).toContainText('Stop Passive Training')
  sql(
    `update app_private.wayfarers_practice_state set plan_set_at=clock_timestamp()-interval '9 hours' where character_id='${initial.characterId}'::uuid`,
  )
  await expect.poll(async () => (await world(page)).movementBlocked).toBeNull()
  await world(page)
  expect(
    sql(
      `select count(*) from app_private.training_reports where character_id='${initial.characterId}'::uuid and status='pending'`,
    ),
  ).toBe('1')
  expect(
    sql(
      `select count(*) from app_private.training_report_claims where character_id='${initial.characterId}'::uuid`,
    ),
  ).toBe('0')
  place(initial.characterId, 'umbral-march', 6, 0)
  await reloadWorld(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cross into uncharted territory' }).click()
  await expectLocation(page, 'Beyond the Last Map')
  const surveyed = await world(page)
  const survey = surveyed.sectors.find((s) => !s.charted)!
  expect(survey.cells.length).toBeLessThan(117)
  expect(JSON.stringify(surveyed)).not.toContain('Weathered Observatory')
  const forged = await page.request.post('/api/world', {
    data: {
      characterId: initial.characterId,
      expectedVersion: surveyed.version,
      commandId: randomUUID(),
      intent: { kind: 'walk', destination: { sectorId: survey.id, x: 11, y: 1 } },
    },
  })
  expect(forged.ok()).toBe(false)

  place(initial.characterId, survey.id, 11, 1, false)
  await reloadWorld(page)
  const observation = await world(page)
  expect(observation.archive).toEqual([])
  expect(observation.anchors).toEqual([])
  const recordObservation = await page.request.post('/api/world', {
    data: {
      characterId: initial.characterId,
      expectedVersion: observation.version,
      commandId: randomUUID(),
      intent: { kind: 'tick' },
    },
  })
  expect(recordObservation.ok()).toBe(true)
  await reloadWorld(page)
  const archive = page.getByRole('region', { name: 'Archive' })
  await expect(archive).toContainText('Weathered Observatory')
  await expect(archive).toContainText('Field Observation')
  const archived = await world(page)
  expect(archived.archive).toEqual([
    expect.objectContaining({
      id: 'field-observation-first-observation',
      provenance: 'Direct field observation',
    }),
  ])
  expect(archived.anchors).toEqual([
    expect.objectContaining({
      id: 'first-observation',
      name: 'Weathered Observatory',
    }),
  ])
  const anchors = page.getByRole('region', { name: 'Frontier Anchors' })
  await expect(anchors).toContainText('Weathered Observatory')
  await expect(anchors).toContainText('persists in frontier history')
  const archivedVersion = archived.version
  await reloadWorld(page)
  expect((await world(page)).version).toBe(archivedVersion)
  await expect(page.getByRole('region', { name: 'Archive' })).toContainText('Weathered Observatory')
  await expect(page.getByRole('region', { name: 'Frontier Anchors' })).toContainText(
    'Weathered Observatory',
  )

  const archivedCells = archived.sectors.find((s) => !s.charted)!.cells
  await capture(page, info, 'world-frontier')
  await reloadWorld(page)
  expect((await world(page)).sectors.find((s) => !s.charted)?.cells).toEqual(archivedCells)
})

test('Crown Road advances one authoritative ordinary step with one due client tick', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Tick scheduling is viewport independent; exercise one authoritative desktop journey.',
  )
  test.setTimeout(60_000)
  await enter(page)
  const initial = await world(page)
  place(initial.characterId, 'crown-road', 6, 4)
  await reloadWorld(page)

  const placed = await world(page)
  const road = placed.sectors.find((sector) => sector.id === 'crown-road')!
  let tickPosts = 0
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/world')) return
    try {
      const payload = request.postDataJSON() as { intent?: { kind?: string } }
      if (payload.intent?.kind === 'tick') tickPosts++
    } catch {
      // Ignore non-JSON requests; World commands are JSON by contract.
    }
  })

  expect((await world(page)).route).toHaveLength(0)
  await stageWalk(page, { sectorId: road.id, x: 7, y: 4 })
  await expect(page.locator('[data-world-travel-status]')).toContainText('1 steps remaining')
  expect((await world(page)).route[0]?.durationMs).toBe(STEP_MS)
  await expect.poll(async () => (await world(page)).position.x, { timeout: 4_000 }).toBe(7)
  expect(tickPosts).toBe(1)
})

for (const journey of [
  {
    id: 'eastern-march-road',
    name: 'Eastern March Road',
    destinationId: 'umbral-march',
    destinationName: 'Umbral March',
    entranceX: 0,
    startSector: 'emberreach',
  },
  {
    id: 'old-coast-road',
    name: 'Old Coast Road',
    destinationId: 'umbral-march',
    destinationName: 'Umbral March',
    entranceX: 0,
    startSector: 'hollow-coast',
  },
  {
    id: 'highland-road',
    name: 'Highland Road',
    destinationId: 'starfall-highlands',
    destinationName: 'Starfall Highlands',
    entranceX: 0,
    startSector: 'aureth-crown',
  },
  {
    id: 'northern-pass',
    name: 'Northern Pass',
    destinationId: 'frostmere',
    destinationName: 'Frostmere',
    entranceX: 0,
    startSector: 'starfall-highlands',
  },
  {
    id: 'crown-road',
    name: 'Crown Road',
    destinationId: 'aureth-crown',
    destinationName: 'Aureth Crown',
    entranceX: 12,
    startSector: 'verdant-expanse',
  },
  {
    id: 'coastal-road',
    name: 'Coastal Road',
    destinationId: 'hollow-coast',
    destinationName: 'Hollow Coast',
    entranceX: 0,
    startSector: 'verdant-expanse',
  },
  {
    id: 'ember-road',
    name: 'Ember Road',
    destinationId: 'emberreach',
    destinationName: 'Emberreach',
    entranceX: 0,
    startSector: 'verdant-expanse',
  },
  {
    id: 'southern-caravan-road',
    name: 'Southern Caravan Road',
    destinationId: 'glasswind-desert',
    destinationName: 'Glasswind Desert',
    entranceX: 0,
    startSector: 'aureth-crown',
  },
])
  test(`${journey.name} is a persistent journey with exits, stopping, globe location and its own surroundings`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop-chromium',
      'Full elapsed-time journey is viewport independent.',
    )
    test.setTimeout(150000)
    await enter(page)
    if (journey.startSector !== 'verdant-expanse') {
      place((await world(page)).characterId, journey.startSector, 5, 4)
      await reloadWorld(page)
    }
    await openJournal(page)
    await page.getByRole('button', { name: `Travel to ${journey.name}`, exact: false }).click()
    await expect(page.locator('[data-world-travel-status]')).toContainText(journey.name)
    await expect
      .poll(async () => (await world(page)).position.sectorId, { timeout: 20000 })
      .toBe(journey.id)
    await expectLocation(page, journey.name)
    await expect(stageOf(page).locator('#nav-svg')).toBeVisible()
    await capture(page, info, `${journey.id}-sector`)
    const panorama = (await world(page)).sectors.find(
      (sector) => sector.id === journey.id,
    )!.panorama!
    const loaded = page.waitForResponse(
      (response) =>
        response.url().endsWith(panorama) && (response.ok() || response.status() === 304),
      { timeout: 15000 },
    )
    await page.getByRole('button', { name: /View 360/ }).click()
    await (await loaded).finished()
    await expect(
      page.getByRole('dialog').getByRole('heading', { name: journey.name }),
    ).toBeVisible()
    await capture(page, info, `${journey.id}-surroundings`)
    for (let turn = 0; turn < 6; turn++)
      await page.getByRole('dialog').getByRole('button', { name: 'Look right' }).click()
    await capture(page, info, `${journey.id}-surroundings-reverse`)
    await page.keyboard.press('Escape')
    await stageOf(page).locator('#v-toggle').click()
    await expect(stageOf(page).locator('#globe-svg')).toBeVisible()
    await capture(page, info, `${journey.id}-globe`)
    await stageOf(page).locator('#v-toggle').click()
    await expect(stageOf(page).locator('#stage-world')).toBeHidden()
    await openJournal(page)
    await page
      .getByRole('button', { name: `Travel to ${journey.destinationName}`, exact: false })
      .click()
    await expect(page.locator('[data-world-travel-status]')).toContainText(journey.destinationName)
    await expect(page.locator('[data-world-travel-status]')).toContainText('About')
    await expect
      .poll(async () => (await world(page)).position.x, { timeout: 12000 })
      .not.toBe(journey.entranceX)
    const stopResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/world' &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.intent?.kind === 'stop',
      { timeout: 15000 },
    )
    const stopButton = page.getByRole('button', { name: 'Stop travel', exact: true })
    await stopButton.click()
    const committedStop = await stopResponse
    expect(committedStop.status()).toBe(200)
    const stopReceipt: WorldView = await committedStop.json()
    expect(stopReceipt.route).toHaveLength(0)
    await expect(stopButton).toBeHidden()
    const stopped = await world(page)
    expect(stopped.route).toHaveLength(0)
    expect(stopped.position).toEqual(stopReceipt.position)
    expect(stopped.position.sectorId).toBe(journey.id)
    await reloadWorld(page)
    expect((await world(page)).position).toEqual(stopped.position)
    await page
      .getByRole('button', { name: `Travel to ${journey.destinationName}`, exact: false })
      .click()
    await expect
      .poll(async () => (await world(page)).position.sectorId, { timeout: 85000 })
      .toBe(journey.destinationId)
    await expectLocation(page, journey.destinationName)
    expect((await world(page)).route).toHaveLength(0)
    await capture(page, info, `${journey.id}-arrival`)
  })

test('a proximity attack reaches both authenticated players while the target views 360', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Two-account authority is viewport independent.',
  )
  test.setTimeout(90000)
  await enter(page)
  const opponentContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const opponent = await opponentContext.newPage()
    const opponentName = await enter(opponent)
    const attacker = await world(page),
      target = await world(opponent)
    place(target.characterId, 'verdant-expanse', 4, 4, true)
    const protectedAttack = await page.request.post('/api/world', {
      data: {
        characterId: attacker.characterId,
        expectedVersion: attacker.version,
        commandId: randomUUID(),
        intent: { kind: 'attack', targetId: target.characterId },
      },
    })
    expect(protectedAttack.ok()).toBe(false)
    place(attacker.characterId, 'crown-road', 5, 4)
    place(target.characterId, 'crown-road', 6, 4)
    await page.reload()
    await opponent.reload()
    await opponent.getByRole('button', { name: /View 360/ }).click()
    await expect(opponent.getByRole('dialog')).toBeVisible()
    const attackButton = stageOf(page).getByRole('button', {
      name: `Attack ${opponentName}`,
      exact: true,
    })
    await expect(attackButton).toBeEnabled({ timeout: 15000 })
    await attackButton.click()
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]+$/, { timeout: 15000 })
    await expect(opponent).toHaveURL(page.url(), { timeout: 15000 })
    const battleId = page.url().split('/').at(-1)!
    expect(
      sql(
        `select count(*) from app_private.battle_participants where battle_session_id='${battleId}'::uuid and participant_role='player'`,
      ),
    ).toBe('2')
    expect(
      sql(
        `select count(*) from app_private.world_encounters where battle_session_id='${battleId}'::uuid`,
      ),
    ).toBe('1')
    await capture(page, info, 'world-encounter-attacker')
    await capture(opponent, info, 'world-encounter-target')
  } finally {
    await opponentContext.close()
  }
})

test('contending travel commands commit once and identical retries replay once', async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Database contention is viewport independent.',
  )
  test.setTimeout(90000)
  await enter(page)
  for (const identical of [false, true]) {
    const initial = await world(page)
    const command = {
      characterId: initial.characterId,
      expectedVersion: initial.version,
      commandId: randomUUID(),
      intent: { kind: 'stop' },
    }
    const responses = await contend([initial.characterId], () => [
      page.request.post('/api/world', { data: command, timeout: 20000 }),
      page.request.post('/api/world', {
        data: { ...command, commandId: identical ? command.commandId : randomUUID() },
        timeout: 20000,
      }),
    ])
    expect(responses.map((response) => response.status()).sort()).toEqual(
      identical ? [200, 200] : [200, 409],
    )
    const after = await world(page)
    expect(after.version).toBe(initial.version + 1)
    expect(after.position).toEqual(initial.position)
    expect(after.route).toHaveLength(0)
    if (identical)
      for (const response of responses) expect((await response.json()).version).toBe(after.version)
    else
      expect(
        (await responses.find((response) => response.status() === 409)!.json()).error.code,
      ).toBe('STALE_VERSION')
  }
})

test('simultaneous mutual attacks create one shared active encounter', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Database contention is viewport independent.',
  )
  test.setTimeout(90000)
  await enter(page)
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const opponent = await context.newPage()
    await enter(opponent)
    const first = await world(page),
      second = await world(opponent)
    place(first.characterId, 'crown-road', 5, 4)
    place(second.characterId, 'crown-road', 6, 4)
    await world(page)
    await world(opponent)
    const responses = await contend([first.characterId, second.characterId], () => [
      page.request.post('/api/world', {
        data: {
          characterId: first.characterId,
          expectedVersion: first.version,
          commandId: randomUUID(),
          intent: { kind: 'attack', targetId: second.characterId },
        },
        timeout: 20000,
      }),
      opponent.request.post('/api/world', {
        data: {
          characterId: second.characterId,
          expectedVersion: second.version,
          commandId: randomUUID(),
          intent: { kind: 'attack', targetId: first.characterId },
        },
        timeout: 20000,
      }),
    ])
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409])
    expect((await responses.find((response) => response.status() === 409)!.json()).error.code).toBe(
      'STALE_VERSION',
    )
    const one = await world(page),
      two = await world(opponent)
    expect(one.battleSessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(two.battleSessionId).toBe(one.battleSessionId)
    expect(one.route).toHaveLength(0)
    expect(two.route).toHaveLength(0)
    expect(
      sql(
        `select count(distinct b.id)||':'||count(*) from app_private.battle_sessions b join app_private.battle_participants p on p.battle_session_id=b.id join app_private.world_encounters e on e.battle_session_id=b.id where b.lifecycle='active' and p.character_id in ('${first.characterId}'::uuid,'${second.characterId}'::uuid) and p.participant_role='player'`,
      ),
    ).toBe('1:2')
  } finally {
    await context.close()
  }
})

test('a due movement step and an attack cannot both commit from the same target position', async ({
  page,
  browser,
}, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Database contention is viewport independent.',
  )
  test.setTimeout(90000)
  await enter(page)
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const opponent = await context.newPage()
    await enter(opponent)
    const attacker = await world(page),
      target = await world(opponent)
    // Stop UI polling/ticking; retain both real authenticated request contexts.
    await page.goto('about:blank')
    await opponent.goto('about:blank')
    place(attacker.characterId, 'crown-road', 5, 4)
    place(target.characterId, 'crown-road', 6, 4)
    const destination = { sectorId: 'crown-road', x: 7, y: 4 }
    sql(
      `update app_private.character_world_state set state = state || '${JSON.stringify({ route: [{ position: destination, durationMs: STEP_MS }], nextStepAt: Date.now() - 1000 })}'::jsonb where character_id='${target.characterId}'::uuid`,
    )
    await world(page)
    await world(opponent)
    const [attack, move] = await contend([attacker.characterId, target.characterId], () => [
      page.request.post('/api/world', {
        data: {
          characterId: attacker.characterId,
          expectedVersion: attacker.version,
          commandId: randomUUID(),
          intent: { kind: 'attack', targetId: target.characterId },
        },
        timeout: 20000,
      }),
      opponent.request.post('/api/world', {
        data: {
          characterId: target.characterId,
          expectedVersion: target.version,
          commandId: randomUUID(),
          intent: { kind: 'tick' },
        },
        timeout: 20000,
      }),
    ])
    expect([attack!.status(), move!.status()].sort()).toEqual([200, 409])
    const loser = attack!.ok() ? move! : attack!
    expect((await loser.json()).error.code).toBe('STALE_VERSION')
    const afterAttacker = await world(page),
      afterTarget = await world(opponent)
    expect(afterTarget.version).toBe(target.version + 1)
    expect(afterTarget.route).toHaveLength(0)
    if (attack!.ok()) {
      expect(afterAttacker.battleSessionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(afterTarget.battleSessionId).toBe(afterAttacker.battleSessionId)
      expect(afterTarget.position).toEqual({ ...destination, x: 6 })
    } else {
      expect(afterTarget.position).toEqual(destination)
      expect(afterAttacker.battleSessionId).toBeNull()
      expect(afterTarget.battleSessionId).toBeNull()
      expect(afterAttacker.version).toBe(attacker.version)
    }
  } finally {
    await context.close()
  }
})

for (const change of ['training', 'build'] as const)
  test(`encounter creation rechecks a ${change} change after preparing its snapshot`, async ({
    page,
    browser,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop-chromium',
      'Database contention is viewport independent.',
    )
    test.setTimeout(90000)
    await enter(page)
    const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
    try {
      const opponent = await context.newPage()
      await enter(opponent)
      const attacker = await world(page),
        target = await world(opponent)
      await page.goto('about:blank')
      await opponent.goto('about:blank')
      place(attacker.characterId, 'crown-road', 5, 4)
      place(target.characterId, 'crown-road', 6, 4)
      await world(page)
      await world(opponent)
      const [attack] = await contend(
        [attacker.characterId, target.characterId],
        () => [
          page.request.post('/api/world', {
            data: {
              characterId: attacker.characterId,
              expectedVersion: attacker.version,
              commandId: randomUUID(),
              intent: { kind: 'attack', targetId: target.characterId },
            },
            timeout: 20000,
          }),
        ],
        async () => {
          // The attack is now inside its mutation RPC, after its eligibility read
          // and committed-build snapshot, but before its transaction takes locks.
          if (change === 'training') {
            const response = await opponent.request.post('/api/wayfarers-practice/plan', {
              data: {
                version: 1,
                characterId: target.characterId,
                plannedWindow: 'short',
                idempotencyKey: randomUUID(),
              } satisfies SetPracticePlanRequest,
              timeout: 10000,
            })
            expect(response.status()).toBe(201)
          } else {
            const response = await opponent.request.get('/api/character/build/skills')
            expect(response.ok()).toBe(true)
            const { context: before } = (await response.json()) as {
              context: CharacterBuildContext
            }
            const equipped = before.disciplineSkills.equippedSkills.map(
              (entry) => entry.definition.id,
            )
            const skillIds = equipped.length
              ? equipped.slice(0, -1)
              : [before.disciplineSkills.learnedSkills[0]!.definition.id]
            const saved = await opponent.request.put('/api/character/build/skills', {
              data: {
                expectedBuildVersion: before.build.buildVersion,
                skillIds,
                idempotencyKey: randomUUID(),
              },
              timeout: 10000,
            })
            expect(saved.ok()).toBe(true)
            const { context: after } = (await saved.json()) as { context: CharacterBuildContext }
            expect(after.build.buildVersion).toBe(before.build.buildVersion + 1)
            expect(
              after.disciplineSkills.equippedSkills.map((entry) => entry.definition.id),
            ).toEqual(skillIds)
          }
        },
      )
      expect(attack!.status()).toBe(change === 'training' ? 400 : 409)
      expect((await attack!.json()).error.code).toBe(
        change === 'training' ? 'INVALID_REQUEST' : 'STALE_VERSION',
      )
      const afterAttacker = await world(page),
        afterTarget = await world(opponent)
      expect(afterAttacker.battleSessionId).toBeNull()
      expect(afterTarget.battleSessionId).toBeNull()
      expect(afterAttacker.version).toBe(attacker.version)
      expect(afterTarget.version).toBe(target.version)
      if (change === 'training')
        expect(afterTarget.movementBlocked).toContain('Stop Passive Training')
      expect(
        sql(
          `select count(*) from app_private.pvp_lobby_members where character_id in ('${attacker.characterId}'::uuid,'${target.characterId}'::uuid)`,
        ),
      ).toBe('0')
      expect(
        sql(
          `select count(*) from app_private.battle_participants where character_id in ('${attacker.characterId}'::uuid,'${target.characterId}'::uuid)`,
        ),
      ).toBe('0')
    } finally {
      await context.close()
    }
  })
