import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { provisionAccountAndEnterCharacter, openOfflineTraining } from './pv1f-test-helpers'
import { WORLD_REGIONS } from '../src/world/catalog'
import { newWorldState } from '../src/world/travel'
import type { WorldView } from '../src/world/types'

function sql(query: string): string {
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
  return execFileSync(
    'docker',
    [
      'exec',
      container,
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
  const sphere = page.getByRole('group', { name: /World globe/ })
  const globeBounds = (await sphere.boundingBox())!
  const viewportBounds = (await page.locator('[class*="mapViewport"]').boundingBox())!
  expect(globeBounds.y).toBeGreaterThanOrEqual(viewportBounds.y + 16)
  expect(globeBounds.y + globeBounds.height).toBeLessThanOrEqual(
    viewportBounds.y + viewportBounds.height - 16,
  )
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
  await capture(page, info, 'world-frontier')
  await page.reload()
  expect((await world(page)).sectors.find((s) => !s.charted)?.cells).toEqual(survey.cells)
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
    await page.getByRole('button', { name: 'Stop travel', exact: true }).click()
    const stopped = await world(page)
    expect(stopped.route).toHaveLength(0)
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
