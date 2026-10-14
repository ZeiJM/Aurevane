import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { expect, test, type APIResponse, type Page, type TestInfo } from '@playwright/test'
import type { SetPracticePlanRequest } from '@aurevane/validation/player/wayfarers-practice'
import { provisionAccountAndEnterCharacter, openOfflineTraining } from './pv1f-test-helpers'
import { GRID_WIDTH, GRID_HEIGHT, STEP_MS, WORLD_REGIONS } from '../src/world/catalog'
import { newWorldState } from '../src/world/travel'
import type { WorldView } from '../src/world/types'
import { verifyWorldPresentation, registerWorldInputCases } from './world-presentation-case'
import { verifyWorldScenePresence, verifyWorldInstantActions } from './world-presence-case'
import { sectorMapOrigin, wrappedMapX } from '../src/world/topology'
import { projectMapPoint } from '../src/components/world/map-projection'
import { registerWorldLandscapeCases } from './world-landscape-case'
import type { CharacterBuildContext } from '../src/server/character/character-build-service'

const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page) ?? []).toEqual([])
})

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

async function openJournal(page: Page) {
  // The Missions tab of the right-hand panel shows the former Journal.
  const details = page.getByRole('button', { name: 'Details', exact: true })
  if (await details.isVisible()) await details.click()
  await page.getByRole('tab', { name: /Missions/ }).click()
  await expect(page.getByRole('tabpanel', { name: /Missions/ })).toBeVisible()
}
async function reloadWorld(page: Page) {
  await page.reload()
  await openJournal(page)
}
async function expectLocation(page: Page, name: string) {
  await expect(page.getByRole('button', { name: /Open world atlas/ })).toContainText(name, {
    timeout: 15000,
  })
}
// Exercise actual canvas picking or the globe's charted-destination controls.
async function stageWalk(page: Page, destination: { sectorId: string; x: number; y: number }) {
  const current = await world(page)
  const sector = current.sectors.find((s) => s.id === destination.sectorId)
  if (!sector) {
    await page.getByRole('button', { name: /Open world atlas/ }).click()
    await page.getByText('Known Lands', { exact: true }).click()
    await page.getByLabel('Charted sector', { exact: true }).selectOption(destination.sectorId)
    await page.getByRole('button', { name: 'Travel here', exact: true }).click()
    return
  }
  const canvas = page.locator('canvas[data-world-stage]')
  await expect(canvas).toHaveAttribute('data-tile-size', /\d/)
  const box = (await canvas.boundingBox())!
  const metrics = await canvas.evaluate((el) => ({
    x: Number(el.dataset.cameraX),
    y: Number(el.dataset.cameraY),
    tile: Number(el.dataset.tileSize),
  }))
  const dx =
    wrappedMapX((sector.atlasColumn ?? 0) * GRID_WIDTH + destination.x + 0.5, metrics.x) - metrics.x
  const dy = (sector.atlasRow ?? 0) * GRID_HEIGHT + destination.y + 0.5 - metrics.y
  const x = box.width / 2 + (dx - dy) * metrics.tile * 0.85
  const y = box.height / 2 + (dx + dy) * metrics.tile * 0.44
  if (x <= 0 || x >= box.width || y <= 0 || y >= box.height) {
    await page.getByRole('button', { name: /Open world atlas/ }).click()
    await page.getByText('Known Lands', { exact: true }).click()
    await page.getByLabel('Charted sector', { exact: true }).selectOption(destination.sectorId)
    await page.getByRole('button', { name: 'Travel here', exact: true }).click()
    return
  }
  expect(x).toBeGreaterThan(0)
  expect(x).toBeLessThan(box.width)
  expect(y).toBeGreaterThan(0)
  expect(y).toBeLessThan(box.height)
  // The camera follows the traveller every frame. Locator.click's actionability
  // wait can age these measured coordinates by several tiles during a replan.
  // The canvas is already visible/bounded above; send the real mouse click now.
  await page.mouse.click(box.x + x, box.y + y)
}

test('the World page is the scenic map stage inside the shared shell, with Missions panel and globe', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const name = await enter(page)
  const initial = await world(page)
  expect(initial.sectors.length).toBeLessThanOrEqual(25)
  expect(initial.atlas!.length).toBeGreaterThan(150)
  for (const region of WORLD_REGIONS)
    expect(initial.atlas!.some((s) => s.id === region.id)).toBe(true)
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
  await expectLocation(page, 'Verdant Expanse')
  await expect(page.locator('canvas[data-world-stage]')).toBeVisible()
  await expect(page.locator('[data-world-workspace] header')).toContainText('UTC')
  if (info.project.name === 'mobile-chromium')
    await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('tab', { name: /^Nearby/ })).toBeVisible()
  await expect(page.getByText('Protected settlement', { exact: true })).toHaveCount(0)
  await expect(page.locator('[data-world-workspace] footer')).toHaveCount(0)
  if (info.project.name === 'mobile-chromium')
    await page.getByRole('button', { name: 'Close details', exact: true }).click()
  const stageBox = (await page.locator('[data-world-stage]').boundingBox())!
  expect(stageBox.height).toBeGreaterThan(300)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 &&
        document.documentElement.scrollHeight <= window.innerHeight + 1,
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
  await page.getByRole('button', { name: /Open world atlas|Return to local map/ }).click()
  await expect(page.getByRole('group', { name: /World globe/ })).toBeVisible()
  await capture(page, info, 'world-globe')
  await page.getByRole('button', { name: /Open world atlas|Return to local map/ }).click()
  await expect(page.getByRole('group', { name: /World globe/ })).toBeHidden()
  if (info.project.name === 'desktop-chromium') {
    for (const region of WORLD_REGIONS) {
      place(initial.characterId, region.id, 5, 4)
      await page.reload()
      await expectLocation(page, region.name)
      await capture(page, info, `sector-${region.id}`)
    }
  }
})

test('World controls keep the map continuous, panels fitted and errors visible', async ({
  page,
}, info) => {
  await verifyWorldPresentation(page, info, { enter, world, place, capture })
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
  await page.getByRole('button', { name: 'Complete quest' }).click()
  const reportCommand = (await reportRequest).postDataJSON()
  await page.getByRole('tab', { name: 'Completed', exact: true }).click()
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
  await expect(page.getByRole('button', { name: 'Complete quest' })).toHaveCount(0)
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
  await page.getByRole('button', { name: 'Complete quest' }).click()
  const reportCommand = (await reportRequest).postDataJSON()
  await page.getByRole('tab', { name: 'Completed', exact: true }).click()
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
  await expect(page.getByRole('button', { name: 'Complete quest' })).toHaveCount(0)
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
  await expect(page.locator('[data-world-workspace]').getByRole('alert')).toContainText(
    'Stop Passive Training',
  )
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
  const walkReceipt = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/world' &&
      response.request().method() === 'POST' &&
      response.request().postDataJSON()?.intent?.kind === 'walk',
  )
  await stageWalk(page, { sectorId: road.id, x: 7, y: 4 })
  // The first full 200ms step is confirmed by one deadline-driven tick.
  const planned: WorldView = await (await walkReceipt).json()
  expect(planned.route[0]?.durationMs).toBe(STEP_MS)
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
  test(`${journey.name} is a persistent journey with stopping, globe location and its own surroundings`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop-chromium',
      'Full elapsed-time journey is viewport independent.',
    )
    test.setTimeout(150000)
    await enter(page)
    // Towns now sit well apart behind generated trail sectors, so start on the road itself.
    place((await world(page)).characterId, journey.id, 6, 4)
    await reloadWorld(page)
    await openJournal(page)
    await expectLocation(page, journey.name)
    await expect(page.locator('canvas[data-world-stage]')).toBeVisible()
    await capture(page, info, `${journey.id}-sector`)
    await page.getByRole('button', { name: /Open world atlas|Return to local map/ }).click()
    await expect(page.getByRole('group', { name: /World globe/ })).toBeVisible()
    await capture(page, info, `${journey.id}-globe`)
    await page.getByRole('button', { name: /Open world atlas|Return to local map/ }).click()
    await expect(page.getByRole('group', { name: /World globe/ })).toBeHidden()
    const arrival = { sectorId: journey.destinationId, x: 6, y: 4 }
    await stageWalk(page, arrival)
    await expect(page.getByRole('button', { name: 'Stop travel', exact: true })).toHaveCount(0)
    // Steps are fast now, so poll tightly and stop before the walk leaves the road sector.
    await expect
      .poll(async () => (await world(page)).position, { timeout: 12000, intervals: [40] })
      .not.toEqual({ sectorId: journey.id, x: 6, y: 4 })
    const stopResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/world' &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.intent?.kind === 'stop',
      { timeout: 15000 },
    )
    await page.locator('canvas[data-world-stage]').press('Escape')
    const committedStop = await stopResponse
    expect(committedStop.status()).toBe(200)
    const stopReceipt: WorldView = await committedStop.json()
    expect(stopReceipt.route).toHaveLength(0)
    const stopped = await world(page)
    expect(stopped.route).toHaveLength(0)
    expect(stopped.position).toEqual(stopReceipt.position)
    // At the faster pace a stop can land just past the road in a neighbouring trail sector.
    expect(stopped.position.sectorId).not.toBe(journey.destinationId)
    await reloadWorld(page)
    expect((await world(page)).position).toEqual(stopped.position)
    await stageWalk(page, arrival)
    await expect
      .poll(async () => (await world(page)).position.sectorId, { timeout: 85000 })
      .toBe(journey.destinationId)
    await expectLocation(page, journey.destinationName)
    // The route now ends at a tile inside the destination, a few steps after crossing into it.
    await expect.poll(async () => (await world(page)).route.length, { timeout: 30000 }).toBe(0)
    expect((await world(page)).position).toEqual(arrival)
    await capture(page, info, `${journey.id}-arrival`)
  })

test('a proximity attack reaches both authenticated players', async ({ page, browser }, info) => {
  test.skip(
    info.project.name !== 'desktop-chromium',
    'Two-account authority is viewport independent.',
  )
  test.setTimeout(90000)
  await enter(page)
  const opponentContext = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const opponent = await opponentContext.newPage()
    await enter(opponent)
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
    const attackButton = page
      .locator(`[data-world-player="${target.characterId}"]`)
      .getByRole('button', {
        name: 'Attack',
        exact: true,
      })
    await expect(attackButton).toBeEnabled({ timeout: 15000 })
    // An idle read must never make a real encounter command wait for that read.
    let releaseRead!: () => void,
      heldRead = false
    const slowRead = new Promise<void>((resolve) => {
      releaseRead = resolve
    })
    const holdRefresh = async (route: import('@playwright/test').Route) => {
      if (
        route.request().method() === 'GET' &&
        new URL(route.request().url()).searchParams.has('presenceVersion') &&
        !heldRead
      ) {
        heldRead = true
        await slowRead
        await route.continue().catch(() => {}) // Expected if user input aborts the held GET.
      } else await route.continue()
    }
    await page.route('**/api/world*', holdRefresh)
    try {
      await expect.poll(() => heldRead, { timeout: 10000 }).toBe(true)
      const dispatched = page.waitForRequest(
        (request) =>
          new URL(request.url()).pathname === '/api/world' &&
          request.method() === 'POST' &&
          request.postDataJSON()?.intent?.kind === 'attack',
        { timeout: 1500 },
      )
      await attackButton.click()
      await dispatched
    } finally {
      releaseRead()
      await page.unroute('**/api/world*', holdRefresh)
    }
    await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}\?returnTo=world$/, {
      timeout: 15000,
    })
    // The target automatically receives the confirmed encounter, without clicking refresh.
    await expect(opponent).toHaveURL(page.url(), { timeout: 10000 })
    // Re-entering World must retain the same preference through the server redirect too.
    await opponent.goto('/game/world')
    await expect(opponent).toHaveURL(page.url(), { timeout: 15000 })
    const battleId = new URL(page.url()).pathname.split('/').at(-1)!
    expect(battleId).toMatch(/^[0-9a-f-]{36}$/)
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
    const field = page.locator('main[data-unified-battle="true"][data-battle-kind="pvp"]')
    await expect(field).not.toHaveAttribute('aria-busy', 'true')
    await field.getByRole('button', { name: 'Surrender', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Surrender this battle?' })
    await expect(dialog).toBeVisible()
    const surrendered = page.waitForResponse(
      (response) => response.url().endsWith('/surrender') && response.request().method() === 'POST',
    )
    await dialog.getByRole('button', { name: 'Confirm Surrender' }).click()
    expect((await surrendered).status()).toBe(200)
    for (const participant of [page, opponent]) {
      await expect(participant.getByTestId('pvp-battle-result-overlay')).toBeVisible({
        timeout: 20000,
      })
      await participant.reload()
      const result = participant.getByTestId('pvp-battle-result-overlay')
      await expect(
        result.getByRole('button', { name: 'Return to World', exact: true }),
      ).toBeVisible()
      await expect(
        result.getByRole('button', { name: 'Return to Battle Hall', exact: true }),
      ).toHaveCount(0)
      await result.getByRole('button', { name: 'Return to World', exact: true }).click()
      await expect(participant).toHaveURL(/\/game\/world$/)
      await expect(participant.locator('canvas[data-world-stage]')).toBeVisible()
    }
    expect((await world(page)).position).toEqual({ sectorId: 'crown-road', x: 5, y: 4 })
    expect((await world(opponent)).position).toEqual({ sectorId: 'crown-road', x: 6, y: 4 })
    await capture(page, info, 'world-battle-return-after-reload')
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

test('rapid ground clicks settle at the last legal tile and keyboard movement crosses seamlessly', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Input authority is viewport independent.')
  test.setTimeout(60000)
  await enter(page)
  const initial = await world(page)
  place(initial.characterId, 'atlas:58:28', 6, 4)
  await page.reload()
  await expect(page.locator('canvas[data-world-stage]')).toBeVisible()
  await stageWalk(page, { sectorId: 'atlas:58:28', x: 7, y: 4 })
  await stageWalk(page, { sectorId: 'atlas:58:28', x: 5, y: 4 })
  const final = { sectorId: 'atlas:58:28', x: 10, y: 4 }
  await stageWalk(page, final)
  await expect
    .poll(
      async () => ({
        position: (await world(page)).position,
        remaining: (await world(page)).route.length,
      }),
      { timeout: 12000 },
    )
    .toEqual({ position: final, remaining: 0 })
  const canvas = page.locator('canvas[data-world-stage]')
  await canvas.press('ArrowRight')
  await expect.poll(async () => (await world(page)).position).toEqual({ ...final, x: 11 })
  await canvas.press('ArrowRight')
  await expect.poll(async () => (await world(page)).position).toEqual({ ...final, x: 12 })
  await canvas.press('ArrowRight')
  await expect.poll(async () => (await world(page)).position.sectorId).not.toBe('atlas:58:28')
  await capture(page, info, 'seamless-edge-crossing')
  await page.reload()
  await expect(canvas).toBeVisible()
  expect((await world(page)).position.sectorId).not.toBe('atlas:58:28')
})

test('a synthetic population of 100 has bounded rendering at high DPI and lower CPU speed', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Exercise constrained mobile rendering once.')
  test.setTimeout(90000)
  await enter(page)
  const initial = await world(page)
  const canvas = page.locator('canvas[data-world-stage]')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await page.getByRole('slider', { name: 'Zoom level', exact: true }).press('Home')
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await page.getByRole('button', { name: 'Close details', exact: true }).click()
  await expect.poll(() => canvas.evaluate((el) => Number(el.dataset.tileSize))).toBe(48 * 0.35)
  const viewport = await canvas.evaluate((el) => ({
    width: el.clientWidth,
    height: el.clientHeight,
    tile: Number(el.dataset.tileSize),
    camera: { x: Number(el.dataset.cameraX), y: Number(el.dataset.cameraY) },
  }))
  // Skip the owner and any coincident sector aliases: each peer must really draw.
  const occupied = new Set([`${viewport.camera.x}:${viewport.camera.y}`])
  const ground = initial.sectors.flatMap((sector) => {
    const origin = sectorMapOrigin(sector, viewport.camera.x)
    return sector.cells
      .filter((cell) => cell.walkable)
      .flatMap((cell) => {
        const worldPoint = { x: origin.x + cell.x + 0.5, y: origin.y + cell.y + 0.5 }
        const key = `${worldPoint.x}:${worldPoint.y}`
        if (occupied.has(key)) return []
        const point = projectMapPoint(
          worldPoint,
          viewport.camera,
          { x: 0, y: 0 },
          viewport.tile,
          viewport.width,
          viewport.height,
        )
        const visible =
          point.x > 20 &&
          point.x < viewport.width - 20 &&
          point.y > 40 &&
          point.y < viewport.height - 22
        if (!visible) return []
        occupied.add(key)
        return [{ sectorId: sector.id, x: cell.x, y: cell.y }]
      })
  })
  expect(ground.length).toBeGreaterThanOrEqual(100)
  const players = Array.from({ length: 100 }, (_, i) => ({
    characterId: `synthetic-${i}`,
    name: `Traveller ${i + 1}`,
    level: 10,
    portraitRef: '',
    imageUrl: `/api/media/starter-portrait/portrait.starter.wayfarer-01?syntheticPortrait=${i}`,
    online: true,
    attackable: false,
    position: ground[i]!,
  }))
  const identity = page.locator('canvas[data-world-identity]')
  await identity.evaluate((el) => {
    const context = (el as HTMLCanvasElement).getContext('2d')!,
      original = context.drawImage.bind(context),
      clear = context.clearRect.bind(context),
      sources = new Set<string>()
    let paints = 0
    context.clearRect = (x, y, width, height) => {
      el.dataset.testIdentityPaints = String(++paints)
      clear(x, y, width, height)
    }
    context.drawImage = (image: CanvasImageSource, ...args: number[]) => {
      if (image instanceof HTMLImageElement && image.src.includes('syntheticPortrait=')) {
        sources.add(image.src)
        el.dataset.testPortraitSources = String(sources.size)
        el.dataset.testPortraitMinimumWidth = String(
          Math.min(Number(el.dataset.testPortraitMinimumWidth ?? Infinity), image.naturalWidth),
        )
      }
      Reflect.apply(original, context, [image, ...args])
    }
  })
  await page.route('**/api/world*', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch(),
      body = await response.json()
    await route.fulfill({ response, json: { ...body, players } })
  })
  await expect(canvas).toHaveAttribute('data-visible-players', '101', { timeout: 25000 })
  await expect(identity).toHaveAttribute('data-test-portrait-sources', '100', { timeout: 25000 })
  await expect(identity).toHaveAttribute('data-test-portrait-minimum-width', '400')
  const density = await identity.evaluate((el) => ({
    width: (el as HTMLCanvasElement).width,
    height: (el as HTMLCanvasElement).height,
    expectedWidth: Math.round(el.clientWidth * window.devicePixelRatio),
    expectedHeight: Math.round(el.clientHeight * window.devicePixelRatio),
  }))
  expect(density.width).toBe(density.expectedWidth)
  expect(density.height).toBe(density.expectedHeight)
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const before = Number(await canvas.getAttribute('data-render-frames'))
  const readMetrics = () =>
    canvas.evaluate((el) => ({
      sampledAt: performance.now(),
      renderFrames: Number(el.dataset.renderFrames),
      frameP95Ms: Number(el.dataset.frameP95),
      cachedSectors: Number(el.dataset.cachedSectors),
      cachedPixels: Number(el.dataset.cachedPixels),
      visibleScenery: Number(el.dataset.visibleScenery),
      waterCells: Number(el.dataset.waterCells),
      canvasPixels: (el as HTMLCanvasElement).width * (el as HTMLCanvasElement).height,
      identityPixels: (() => {
        const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
        return identity.width * identity.height
      })(),
      identityPaints: Number(
        document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!.dataset
          .testIdentityPaints ?? 0,
      ),
      players: Number(el.dataset.visiblePlayers),
      deviceRatio: window.devicePixelRatio,
    }))
  const baseline = await readMetrics()
  const costPath = info.outputPath('synthetic-world-render-cost.json')
  writeFileSync(costPath, JSON.stringify({ baseline }, null, 2))
  let metrics = baseline
  try {
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-render-frames')), { timeout: 15000 })
      .toBeGreaterThan(before + 120)
  } finally {
    metrics = await readMetrics()
    writeFileSync(costPath, JSON.stringify({ ...metrics, baseline }, null, 2))
    await info.attach('synthetic-world-render-cost', {
      path: costPath,
      contentType: 'application/json',
    })
  }
  expect(metrics.cachedPixels).toBeLessThanOrEqual(8_000_000)
  expect(metrics.visibleScenery).toBeLessThanOrEqual(180)
  expect(metrics.waterCells).toBeLessThanOrEqual(60)
  expect(metrics.frameP95Ms).toBeLessThan(80)
  await capture(page, info, 'synthetic-100-mobile')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Places', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Places', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Places', exact: true })).toContainText(
    'Marketplace',
  )
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1),
  ).toBe(true)
  await capture(page, info, 'mobile-places-panel')
  await page.getByRole('button', { name: 'Close details', exact: true }).click()
  await page.getByRole('button', { name: /Open world atlas/ }).click()
  await expect(page.getByRole('group', { name: /World globe/ })).toBeVisible()
  await capture(page, info, 'mobile-globe')
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 })
})

test('the mobile map stays usable after rotating to landscape', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-chromium', 'Exercise touch orientation once.')
  test.setTimeout(90000)
  await enter(page)
  await page.setViewportSize({ width: 915, height: 412 })
  const navigation = page.getByRole('navigation', { name: 'Primary game navigation', exact: true })
  const links = navigation.getByRole('link')
  await expect(links).toHaveCount(6)
  for (const link of await links.all()) {
    await expect(link).toBeInViewport({ ratio: 1 })
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
  const stage = page.locator('canvas[data-world-stage]')
  await expect(stage).toBeVisible()
  const bounds = (await stage.boundingBox())!
  expect(bounds.width).toBeGreaterThan(300)
  expect(bounds.height).toBeGreaterThan(180)
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth + 1 &&
        document.documentElement.scrollHeight <= window.innerHeight + 1,
    ),
  ).toBe(true)
  await capture(page, info, 'mobile-landscape-map')
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await page.getByRole('tab', { name: 'Places', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Places', exact: true })).toContainText(
    'Marketplace',
  )
  await capture(page, info, 'mobile-landscape-places')
  const close = page.getByRole('button', { name: 'Close details', exact: true })
  await expect(close).toBeInViewport({ ratio: 1 })
  const closeBounds = (await close.boundingBox())!,
    headerBounds = (await page.locator('[data-world-workspace] > header').boundingBox())!
  expect(closeBounds.x + closeBounds.width).toBeLessThanOrEqual(headerBounds.x + headerBounds.width)
  await close.click()
  await page.getByRole('button', { name: /Open world atlas/ }).click()
  await expect(page.getByRole('group', { name: /World globe/ })).toBeVisible()
  await capture(page, info, 'mobile-landscape-globe')
  await page.getByRole('button', { name: /Return to local map/ }).click()
  await expect(stage).toBeVisible()
})

test('the globe rotates by dragging and has a usable charted fallback without WebGL', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Shared globe input and fallback.')
  test.setTimeout(90000)
  await enter(page)
  await page.getByRole('button', { name: /Open world atlas/ }).click()
  const globe = page.getByRole('group', { name: /World globe/ }),
    pin = page.getByLabel('Your current position', { exact: true })
  await expect(pin).toBeVisible()
  const style = await pin.getAttribute('style'),
    box = (await globe.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => pin.getAttribute('style')).not.toBe(style)
  await expect(page.getByRole('button', { name: 'Travel here', exact: true })).toHaveCount(0)
  await capture(page, info, 'rotated-globe')
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (kind === 'webgl') return null
      return original.apply(this, [kind, ...args] as never)
    } as typeof original
  })
  await page.reload()
  await page.getByRole('button', { name: /Open world atlas/ }).click()
  await expect(page.getByLabel('Charted world atlas', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Your current position', { exact: true })).toBeVisible()
  await expect(page.getByText('Verdant Expanse', { exact: true }).first()).toBeVisible()
  const fallback = page.locator('canvas[data-globe-fallback]')
  const beforeRotation = await fallback.screenshot()
  await globe.press('ArrowRight')
  await expect.poll(async () => (await fallback.screenshot()).equals(beforeRotation)).toBe(false)
  await capture(page, info, 'detailed-fallback-globe')
  await page.getByText('Known Lands', { exact: true }).click()
  await page.getByLabel('Charted sector', { exact: true }).selectOption('frostmere')
  await page.getByRole('button', { name: 'Travel here', exact: true }).click()
  await expect.poll(async () => (await world(page)).route.length).toBeGreaterThan(0)
  await page.locator('canvas[data-world-stage]').press('Escape')
  await expect.poll(async () => (await world(page)).route.length).toBe(0)
  await capture(page, info, 'fallback-route-return')
})

test('ambient clouds, water and wildlife remain alive with bounded effects and can be paused', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Inspect ambient movement once.')
  test.setTimeout(90000)
  await enter(page)
  const initial = await world(page)
  place(initial.characterId, 'verdant-expanse', 8, 4)
  await page.reload()
  const canvas = page.locator('canvas[data-world-stage]')
  await expect.poll(async () => Number(await canvas.getAttribute('data-clouds'))).toBeGreaterThan(0)
  await expect
    .poll(async () => Number(await canvas.getAttribute('data-water-cells')))
    .toBeGreaterThan(0)
  const before = await canvas.screenshot()
  await page.waitForTimeout(2000)
  expect((await canvas.screenshot()).equals(before)).toBe(false)
  for (let i = 0; i < 12; i++) {
    await canvas.screenshot({
      path: info.outputPath(`ambient-motion-${String(i).padStart(2, '0')}.png`),
    })
    await page.waitForTimeout(500)
  }
  await capture(page, info, 'alive-map-clouds-water')
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(canvas).toHaveAttribute('data-clouds', '0')
  await page.waitForTimeout(300)
  const frames = await canvas.getAttribute('data-render-frames')
  await page.waitForTimeout(1200)
  expect(await canvas.getAttribute('data-render-frames')).toBe(frames)
  await page.getByRole('button', { name: 'Map settings', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).check()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect.poll(async () => Number(await canvas.getAttribute('data-clouds'))).toBeGreaterThan(0)
})

test('scenic countryside has real blossom woodland, ruins, pools and open meadows', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Inspect original landscape sprites once.')
  test.setTimeout(120000)
  await enter(page)
  const initial = await world(page)
  for (const [id, name, landscape] of [
    ['atlas:62:28', 'Cherryblossom Grove', 'sakura'],
    ['atlas:58:27', 'Amberwood Glade', 'autumn'],
    ['atlas:48:22', 'Wisteria Hollow', 'wisteria'],
    ['atlas:69:36', 'Willow Cascades', 'willow'],
    ['atlas:50:34', 'Wildflower Meadow', 'wildflowers'],
  ] as const) {
    place(initial.characterId, id, 6, 4)
    await page.reload()
    await expect(page.locator('canvas[data-world-stage]')).toBeVisible()
    const scene = await world(page)
    const sector = scene.sectors.find((s) => s.id === id)!
    expect(sector.landscape).toBe(landscape)
    expect(sector.townId).toBeUndefined()
    const landmark = sector.landmarks.find((l) => l.name === name)!
    expect(landmark).toBeDefined()
    expect(sector.cells.find((c) => c.x === landmark.x && c.y === landmark.y)?.walkable).toBe(true)
    await stageWalk(page, { sectorId: id, x: landmark.x, y: landmark.y })
    await expect
      .poll(async () => (await world(page)).position, { timeout: 12000 })
      .toEqual({ sectorId: id, x: landmark.x, y: landmark.y })
    await expectLocation(page, name)
    if (landscape === 'willow')
      expect(sector.cells.some((c) => c.terrain === '~' && !c.walkable)).toBe(true)
    await capture(page, info, `countryside-${landscape}`)
  }
})

registerWorldInputCases({ enter, world, place, stageWalk, capture, openJournal })
registerWorldLandscapeCases({ enter, world, place, stageWalk, capture })

test('known neighbouring players follow the visible viewport with service-only presence authority', async ({
  page,
  browser,
}, info) => {
  await verifyWorldScenePresence(page, browser, info, {
    enter,
    world,
    place,
    sql,
    capture,
    stageWalk,
  })
})

test('approach arrival controls remain immediate with slow presentation and legal attacks keep canonical authority', async ({
  page,
  browser,
}, info) => {
  await verifyWorldInstantActions(page, browser, info, {
    enter,
    world,
    place,
    sql,
    capture,
    stageWalk,
  })
})
