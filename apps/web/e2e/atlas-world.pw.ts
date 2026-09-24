import { randomUUID } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { expect, test, type APIResponse, type Page, type TestInfo } from '@playwright/test'
import type { SetPracticePlanRequest } from '@aurevane/validation/player/wayfarers-practice'
import { provisionAccountAndEnterCharacter, openOfflineTraining } from './pv1f-test-helpers'
import { WORLD_REGIONS } from '../src/world/catalog'
import { globeSectorCenter, projectGlobePoint } from '../src/world/globe-math'
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
    .getByRole('link', { name: /World/ })
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

test('Living Atlas fits the shared shell and supports travel, globe and temporary surroundings', async ({
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
  const identity = page.getByTestId('character-profile')
  const identityBox = (await identity.boundingBox())!
  for (const content of [
    identity.getByRole('heading', { name, exact: true }),
    identity.locator('[data-character-resource="hp"]'),
    identity.locator('[data-character-resource="mp"]'),
  ]) {
    const bounds = (await content.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(identityBox.x)
    expect(bounds.y).toBeGreaterThanOrEqual(identityBox.y)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(identityBox.x + identityBox.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(identityBox.y + identityBox.height)
  }
  if (info.project.name === 'mobile-chromium') {
    const portrait = (await identity.locator('[data-character-portrait-frame]').boundingBox())!
    expect(portrait.width).toBeLessThanOrEqual(100)
    expect(identityBox.height).toBeLessThan(260)
  }
  const grid = page.getByRole('group', { name: 'Verdant Expanse, square movement grid' })
  await expect(grid.getByRole('button')).toHaveCount(117)
  const cell = await grid
    .getByRole('button', { name: 'E17 N24, open territory', exact: true })
    .boundingBox()
  const marker = await page
    .getByRole('button', { name: `${name}, your position`, exact: true })
    .boundingBox()
  expect(cell).not.toBeNull()
  expect(marker).not.toBeNull()
  expect(Math.abs(cell!.width - cell!.height)).toBeLessThan(1)
  expect(Math.abs(cell!.x + cell!.width / 2 - marker!.x - marker!.width / 2)).toBeLessThan(1)
  expect(Math.abs(cell!.y + cell!.height / 2 - marker!.y - marker!.height / 2)).toBeLessThan(1)
  const eastings = await page.locator('[class*="eastings"]').boundingBox()
  const gridBox = await grid.boundingBox()
  expect(eastings!.y).toBeGreaterThanOrEqual(gridBox!.y + gridBox!.height - 1)
  async function expectSectorToFit() {
    if (info.project.name === 'mobile-chromium') return
    const viewport = (await page.locator('[class*="mapViewport"]').boundingBox())!
    const frame = (await page.locator('[class*="sectorFrame"]').boundingBox())!
    expect(frame.y).toBeGreaterThanOrEqual(viewport.y - 1)
    expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.y + viewport.height + 1)
  }
  await expectSectorToFit()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
  ).toBe(true)
  const ambient = page.locator('[data-world-ambient]')
  const flow = ambient.locator('[data-world-flow]')
  await expect(ambient).toBeVisible()
  const flowPosition = await flow.evaluate(
    (element) => getComputedStyle(element).backgroundPosition,
  )
  await expect
    .poll(() => flow.evaluate((element) => getComputedStyle(element).backgroundPosition))
    .not.toBe(flowPosition)
  expect(
    Number(await flow.evaluate((element) => getComputedStyle(element).opacity)),
  ).toBeGreaterThanOrEqual(0.28)
  expect(
    Number(
      await ambient
        .locator('[data-world-wind]')
        .evaluate((element) => getComputedStyle(element).opacity),
    ),
  ).toBeGreaterThanOrEqual(0.18)
  expect(
    Number(
      await ambient
        .locator('[data-world-light]')
        .evaluate((element) => getComputedStyle(element).opacity),
    ),
  ).toBeGreaterThanOrEqual(0.07)
  await page.getByRole('button', { name: /Layers/ }).click()
  await page.getByLabel('Environmental motion').uncheck()
  await expect(ambient).toHaveCount(0)
  await page.getByLabel('Environmental motion').check()
  await expect(ambient).toBeVisible()
  await page.getByRole('button', { name: /Layers/ }).click()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(ambient).toBeHidden()
  expect(await ambient.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(
    0,
  )
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(ambient).toBeVisible()
  await capture(page, info, 'world-sector')
  await page
    .getByRole('button', { name: /Start Auto-path/ })
    .first()
    .click()
  await expect(page.getByRole('button', { name: /Stop Auto-path/ })).toBeVisible()
  await expectSectorToFit()
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
  await page.getByRole('button', { name: /Globe/ }).click()
  for (const region of WORLD_REGIONS)
    await expect(
      page.locator('aside').getByRole('button', { name: region.name, exact: true }),
    ).toBeVisible()
  await expect(page.locator('aside').getByText('Charted Sectors', { exact: true })).toBeVisible()
  await expect(
    page
      .locator('aside')
      .locator('[class*="chartedSectorList"]')
      .getByRole('button', { name: /Crown Road.*S16-08/ }),
  ).toBeVisible()
  const sphere = page.getByRole('group', { name: /World globe/ })
  await expect(page.locator('[data-sector-outline="crown-road"]')).toBeVisible()
  await expect(page.locator('[data-sector-outline="verdant-expanse"]')).toHaveAttribute(
    'data-current',
    'true',
  )
  const globeBounds = (await sphere.boundingBox())!
  const viewportBounds = (await page.locator('[class*="mapViewport"]').boundingBox())!
  expect(globeBounds.y).toBeGreaterThanOrEqual(viewportBounds.y + 16)
  expect(globeBounds.y + globeBounds.height).toBeLessThanOrEqual(
    viewportBounds.y + viewportBounds.height - 16,
  )
  const uncharted = page.getByText('Uncharted Territory', { exact: true })
  await expect(uncharted).toBeVisible()
  expect(
    await uncharted.evaluate((element) => getComputedStyle(element.parentElement!).backgroundImage),
  ).toContain('linear-gradient')

  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoomedBounds = (await sphere.boundingBox())!
  expect(zoomedBounds.x).toBeGreaterThanOrEqual(viewportBounds.x)
  expect(zoomedBounds.x + zoomedBounds.width).toBeLessThanOrEqual(
    viewportBounds.x + viewportBounds.width,
  )
  const visibleLabels = page.locator('[class*="regionLabel"]:visible')
  for (let i = 0; i < (await visibleLabels.count()); i++) {
    const bounds = await visibleLabels.nth(i).boundingBox()
    if (!bounds) continue
    expect(bounds.x).toBeGreaterThanOrEqual(zoomedBounds.x - 1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(zoomedBounds.x + zoomedBounds.width + 1)
    expect(bounds.y).toBeGreaterThanOrEqual(zoomedBounds.y - 1)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(zoomedBounds.y + zoomedBounds.height + 1)
  }
  await capture(page, info, 'world-globe-zoomed')
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom out' }).click()

  const crownRoad = globeSectorCenter('S16-08')!
  const crownRoadPoint = projectGlobePoint(crownRoad, { longitude: 0, latitude: 8 })
  await sphere.click({
    position: {
      x: globeBounds.width * (0.5 + crownRoadPoint.x * 0.94 * 0.5),
      y: globeBounds.height * (0.5 - crownRoadPoint.y * 0.94 * 0.5),
    },
  })
  await expect(page.locator('[class*="regionDescription"]')).toContainText('Crown Road · S16-08')
  await expect(page.locator('[data-sector-outline="crown-road"]')).toHaveAttribute(
    'data-selected',
    'true',
  )
  await page.getByRole('button', { name: /Inspect sector/ }).click()
  await expect(page.getByRole('heading', { name: 'Crown Road', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Globe/ }).click()

  const unchartedCell = globeSectorCenter('S17-08')!
  const unchartedPoint = projectGlobePoint(unchartedCell, { longitude: 0, latitude: 8 })
  await sphere.click({
    position: {
      x: globeBounds.width * (0.5 + unchartedPoint.x * 0.94 * 0.5),
      y: globeBounds.height * (0.5 - unchartedPoint.y * 0.94 * 0.5),
    },
  })
  await expect(page.getByRole('status')).toContainText(
    'S17-08 is uncharted. No charted destination is available there yet.',
  )
  expect((await world(page)).sectors.some((sector) => sector.coordinate === 'S17-08')).toBe(false)

  await page.mouse.move(
    globeBounds.x + globeBounds.width * 0.45,
    globeBounds.y + globeBounds.height * 0.5,
  )
  await page.mouse.down()
  await page.mouse.move(
    globeBounds.x + globeBounds.width * 0.58,
    globeBounds.y + globeBounds.height * 0.44,
    { steps: 8 },
  )
  await page.mouse.up()
  await expect(sphere).toBeVisible()
  await capture(page, info, 'world-globe')
  await sphere.focus()
  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: /My Position/ }).click()
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
      await expect(page.getByRole('heading', { name: region.name, exact: true })).toBeVisible()
      const regionalFlow = page.locator('[data-world-flow]')
      const before = await regionalFlow.evaluate(
        (element) => getComputedStyle(element).backgroundPosition,
      )
      await expect
        .poll(() =>
          regionalFlow.evaluate((element) => getComputedStyle(element).backgroundPosition),
        )
        .not.toBe(before)
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
  await page.reload()

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

  await page.reload()
  await expect(page.getByText('Reach the eastern watchtower across the river.')).toBeVisible()
  place(initial.characterId, 'verdant-expanse', 12, 4, false)
  await page.reload()
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
  await page.reload()
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
  await page.reload()
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
  await page.reload()
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
  await page.getByRole('button', { name: 'Start Medium' }).click()
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
  await page.reload()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Cross into uncharted territory' }).click()
  await expect(
    page.getByRole('heading', { name: 'Beyond the Last Map', exact: true }),
  ).toBeVisible()
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
  await page.reload()
  const observation = await world(page)
  expect(observation.archive).toEqual([])
  const recordObservation = await page.request.post('/api/world', {
    data: {
      characterId: initial.characterId,
      expectedVersion: observation.version,
      commandId: randomUUID(),
      intent: { kind: 'tick' },
    },
  })
  expect(recordObservation.ok()).toBe(true)
  await page.reload()
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
  const archivedVersion = archived.version
  await page.reload()
  expect((await world(page)).version).toBe(archivedVersion)
  await expect(page.getByRole('region', { name: 'Archive' })).toContainText('Weathered Observatory')

  const archivedCells = archived.sectors.find((s) => !s.charted)!.cells
  await capture(page, info, 'world-frontier')
  await page.reload()
  expect((await world(page)).sectors.find((s) => !s.charted)?.cells).toEqual(archivedCells)
})

test('Crown Road advances one four-second step with one due client tick', async ({
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
  await page.reload()

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

  await page
    .getByRole('button', {
      name: `E${road.east + 7} N${road.north - 4}, open territory`,
      exact: true,
    })
    .click()
  await expect(page.locator('[data-world-travel-status]')).toContainText('1 steps remaining')
  await expect.poll(async () => (await world(page)).position.x, { timeout: 7_000 }).toBe(7)
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
    const name = await enter(page)
    if (journey.startSector !== 'verdant-expanse') {
      place((await world(page)).characterId, journey.startSector, 5, 4)
      await page.reload()
    }
    await page.getByRole('button', { name: `Travel to ${journey.name}`, exact: false }).click()
    await expect(page.locator('[data-world-travel-status]')).toContainText(journey.name)
    await expect
      .poll(async () => (await world(page)).position.sectorId, { timeout: 20000 })
      .toBe(journey.id)
    await expect(page.getByRole('heading', { name: journey.name, exact: true })).toBeVisible()
    await capture(page, info, `${journey.id}-sector`)
    const ambient = page.locator(`[data-sector="${journey.id}"] [class*="ambient"]`)
    await expect(ambient).toBeVisible()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(ambient).toBeHidden()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(ambient).toBeVisible()
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
    await page.getByRole('button', { name: /Globe/ }).click()
    await page.getByRole('button', { name: /My Position/ }).click()
    await expect(
      page.getByRole('img', { name: `${name}, your current sector`, exact: true }),
    ).toBeVisible()
    await capture(page, info, `${journey.id}-globe`)
    await page
      .getByRole('button', { name: /Sector/, exact: false })
      .first()
      .click()
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
    await page.reload()
    expect((await world(page)).position).toEqual(stopped.position)
    await page
      .getByRole('button', { name: `Travel to ${journey.destinationName}`, exact: false })
      .click()
    await expect
      .poll(async () => (await world(page)).position.sectorId, { timeout: 85000 })
      .toBe(journey.destinationId)
    await expect(
      page.getByRole('heading', { name: journey.destinationName, exact: true }),
    ).toBeVisible()
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
    await expect(
      page.getByRole('button', { name: `Inspect ${opponentName}`, exact: true }),
    ).toBeVisible()
    const selection = page.getByLabel('Select nearby player')
    if (await selection.count()) await selection.selectOption(target.characterId)
    await page.getByRole('button', { name: /Attack/, exact: false }).click()
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
      `update app_private.character_world_state set state = state || '${JSON.stringify({ route: [{ position: destination, durationMs: 4000 }], nextStepAt: Date.now() - 1000 })}'::jsonb where character_id='${target.characterId}'::uuid`,
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
