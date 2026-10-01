import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page, type TestInfo } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { previewDiscipline } from './discipline-library-helpers'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'

const viewports = [
  { width: 1366, height: 768 },
  { width: 1536, height: 614 },
]
type Rect = { x: number; y: number; width: number; height: number }
const parameterLabels = [
  'Skill Type',
  'Cost',
  'Cooldown',
  'Requirements',
  'Range',
  'Target',
  'Target Method',
  'Target Elevation',
  'Line of Sight',
]

async function provision(page: Page, prefix: string) {
  const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`
  const name = `${prefix} ${seed
    .slice(-8)
    .split('')
    .map((digit) => String.fromCharCode(97 + Number(digit)))
    .join('')}`
  await provisionAccountAndEnterCharacter({
    page,
    email: `${prefix}-${seed}@example.com`,
    password: 'Forecast-layout-2026!',
    characterName: name,
  })
  return name
}

async function equipForecastSkills(page: Page) {
  await page.goto('/game/nexus')
  await page.getByRole('button', { name: /Manage Disciplines/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await previewDiscipline(management, 'Primary', 'Frostweaver')
  await management.getByRole('button', { name: /Confirm Change/ }).click()
  await expect(page.getByTestId('primary-discipline-chip')).toHaveText('Frostweaver')
  await management.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: /Manage Techniques/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Techniques', exact: true })
  while (await dialog.getByRole('checkbox', { checked: true }).count()) {
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/skills') &&
        response.request().method() === 'PUT',
    )
    await dialog.getByRole('checkbox', { checked: true }).first().uncheck()
    expect((await saved).ok()).toBe(true)
  }
  const nexusRows: Record<string, string[]> = {}
  for (const name of ['Ice Lance', 'Frost Guard', 'Chilling Mist']) {
    const card = dialog
      .locator('[data-technique-card]')
      .filter({ has: page.getByRole('checkbox', { name: `Select ${name}`, exact: true }) })
    await card.hover()
    await expect(dialog.getByTestId('technique-preview').locator('strong').first()).toHaveText(name)
    nexusRows[name] = await dialog
      .getByTestId('technique-preview')
      .locator('dl > div')
      .evaluateAll((rows) =>
        rows
          .filter((row) => row.querySelector('dt')?.textContent !== 'Effects')
          .map(
            (row) =>
              `${row.querySelector('dt')!.textContent}: ${row.querySelector('dd')!.textContent}`,
          ),
      )
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/character/build/skills') &&
        response.request().method() === 'PUT',
    )
    await card.getByRole('checkbox').check()
    expect((await saved).ok()).toBe(true)
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  return nexusRows
}

async function readBattle(page: Page): Promise<BattleSessionView> {
  const id = new URL(page.url()).pathname.split('/').at(-1)!
  const response = await page.request.get(`/api/battles/${id}`)
  expect(response.ok()).toBe(true)
  return (await response.json()).battle
}

// Disposable local database setup keeps the real pinned build/preview authority intact.
// Adjacent combatants let all enemy forecasts render without spending AP on movement.
async function arrangeAdjacentCombatants(page: Page) {
  const before = await readBattle(page)
  const tactical = before.snapshot.tactical
  const actor = tactical.placements.find(
    (row) => row.combatantId === tactical.battle.currentTurn?.combatantId,
  )!
  const opponentIndex = tactical.placements.findIndex(
    (row) => row.combatantId !== actor.combatantId,
  )
  const candidate = tactical.tiles.find(
    (tile) =>
      tile.terrainId !== 'blocked' &&
      tile.elevation === 0 &&
      Math.abs(tile.position.x - actor.position.x) +
        Math.abs(tile.position.y - actor.position.y) ===
        1 &&
      !tactical.placements.some(
        (row) => row.position.x === tile.position.x && row.position.y === tile.position.y,
      ),
  )
  expect(candidate).toBeDefined()
  const sessionId = new URL(page.url()).pathname.split('/').at(-1)!
  expect(sessionId).toMatch(/^[0-9a-f-]{36}$/i)
  const container = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[0]
  if (!container) throw new Error('Disposable local Supabase database is required.')
  execFileSync(
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
      `update app_private.battle_sessions set current_snapshot = jsonb_set(current_snapshot, '{tactical,placements,${opponentIndex},position}', '${JSON.stringify(candidate!.position)}'::jsonb), current_version = current_version + 1 where id = '${sessionId}'::uuid; update app_private.ai_turn_clocks set deadline_at = now() + interval '10 minutes' where battle_session_id = '${sessionId}'::uuid; update app_private.pvp_turn_clocks set deadline_at = now() + interval '10 minutes' where battle_session_id = '${sessionId}'::uuid;`,
    ],
    { encoding: 'utf8' },
  )
  await page.reload()
  await expect(page.locator('main[data-unified-battle]')).toHaveAttribute('data-local-turn', 'true')
  const after = await readBattle(page)
  expect(after.battleVersion).toBe(before.battleVersion + 1)
  expect(after.snapshot.tactical.placements[opponentIndex]!.position).toEqual(candidate!.position)
}

async function capture(page: Page, testInfo: TestInfo, label: string) {
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
  const geometry = await page.locator('main[data-unified-battle]').evaluate((root) => {
    const rect = (node: Element | null) =>
      node
        ? {
            x: node.getBoundingClientRect().x,
            y: node.getBoundingClientRect().y,
            width: node.getBoundingClientRect().width,
            height: node.getBoundingClientRect().height,
          }
        : null
    const preview = root.querySelector('[data-react-battle-preview]')
    const image = (node: Element) => ({
      rect: rect(node),
      src: node.getAttribute('src'),
      loaded: node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
    })
    return {
      board: rect(root.querySelector('[data-board-auto-fit]')),
      strip: rect(root.querySelector('[data-battle-preview-strip]')),
      preview: rect(preview),
      lanes: [...root.querySelectorAll<HTMLElement>('[data-battle-preview-lane]')].map((lane) => ({
        name: lane.dataset.battlePreviewLane,
        rect: rect(lane),
        tabIndex: lane.tabIndex,
        overflowX: getComputedStyle(lane).overflowX,
        scrollLeft: lane.scrollLeft,
        scrollWidth: lane.scrollWidth,
        clientWidth: lane.clientWidth,
        chips: [...lane.querySelectorAll('[data-battle-preview-chip]')].map((chip) => ({
          text: chip.textContent,
          rect: rect(chip),
        })),
      })),
      info: rect(preview?.querySelector('button[data-battle-info-trigger]') ?? null),
      targets: [...root.querySelectorAll('[data-battle-target-forecast]')].map((target) => ({
        name: target.querySelector('strong')?.textContent,
        rect: rect(target),
        images: [...target.querySelectorAll('img')].map(image),
        fallback: rect(target.querySelector('[data-battle-target-portrait-fallback]')),
      })),
      ground: [...root.querySelectorAll('[data-battle-ground-target]')].map((target) => ({
        rect: rect(target),
        images: [...target.querySelectorAll('img')].map(image),
      })),
      dialogs: [...document.querySelectorAll('[role="dialog"]')].map((dialog) => ({
        rect: rect(dialog),
        label: dialog.getAttribute('aria-label'),
      })),
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }
  })
  const file = `forecast-${label}-${geometry.viewport.width}x${geometry.viewport.height}`
  const output = process.env.LAYOUT_REVIEW_OUTPUT ?? testInfo.outputPath()
  await mkdir(output, { recursive: true })
  const json = JSON.stringify(geometry, null, 2)
  await writeFile(path.join(output, `${file}.json`), json)
  const screenshot = await page.screenshot({
    path: path.join(output, `${file}.png`),
    fullPage: true,
  })
  await testInfo.attach(`${file}-geometry`, { body: json, contentType: 'application/json' })
  await testInfo.attach(file, { body: screenshot, contentType: 'image/png' })
  return geometry
}

function contained(inner: Rect, outer: Rect) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1)
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1)
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1)
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 1)
}

function expectStable(geometry: Awaited<ReturnType<typeof capture>>, baseline: Rect) {
  expect(geometry.board).not.toBeNull()
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(
      Math.abs(geometry.board![key] - baseline[key]),
      `board ${key} remains stable`,
    ).toBeLessThanOrEqual(1)
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport.width + 1)
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.viewport.height + 1)
  for (const lane of geometry.lanes) {
    contained(lane.rect!, geometry.preview!)
    expect(lane.overflowX).toBe('auto')
    for (const chip of lane.chips) {
      expect(chip.rect!.y).toBeGreaterThanOrEqual(lane.rect!.y - 1)
      expect(chip.rect!.y + chip.rect!.height).toBeLessThanOrEqual(
        lane.rect!.y + lane.rect!.height + 1,
      )
    }
  }
  if (geometry.info) contained(geometry.info, geometry.preview!)
  for (const dialog of geometry.dialogs)
    contained(dialog.rect!, { x: 0, y: 0, ...geometry.viewport })
}

async function exerciseForecast(
  page: Page,
  testInfo: TestInfo,
  kind: string,
  nexusRows: Record<string, string[]>,
) {
  const baselineState = await readBattle(page)
  let commits = 0
  const observe = (request: import('@playwright/test').Request) => {
    if (
      request.method() === 'POST' &&
      /\/(intents|commit|final-turn)$/.test(new URL(request.url()).pathname)
    )
      commits += 1
  }
  page.on('request', observe)
  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      await page.getByRole('button', { name: 'Cancel Action', exact: true }).click()
      const initial = await capture(page, testInfo, `${kind}-baseline`)
      expect(initial.board).not.toBeNull()
      const baseline = initial.board!
      expectStable(initial, baseline)
      const check = async (label: string) =>
        expectStable(await capture(page, testInfo, `${kind}-${label}`), baseline)
      await page.locator('button[data-battle-command="inspect"]').click()
      await check('inspect-armed')
      await page
        .locator('#battlefield button[aria-label*="occupied by"]:not(:has(> [data-active="true"]))')
        .click()
      await check('inspect-enemy')
      await page.locator('#battlefield button:has(> [data-active="true"])').click()
      await check('inspect-self')
      await page
        .locator('[data-battle-combatant-card="selected"]')
        .getByRole('button', { name: /^Inspect / })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await check('inspect-self-details')
      await page.keyboard.press('Escape')
      await page.locator('button[data-battle-command="inspect"]').click()
      await page
        .locator('#battlefield button[aria-label^="Tile "]:not([aria-label*="occupied by"])')
        .first()
        .click()
      await check('inspect-ground')
      for (const command of ['move', 'attack', 'guard']) {
        await page.locator(`button[data-battle-command="${command}"]`).click()
        if (command !== 'move')
          await expect(
            page.getByRole('button', { name: 'Forecast details', exact: true }),
          ).toBeVisible()
        if (command === 'guard')
          await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
        await check(`${command}-armed`)
      }
      for (const name of ['Ice Lance', 'Frost Guard', 'Chilling Mist']) {
        await page.getByRole('button', { name: new RegExp(`^Selected ${name},`) }).click()
        const preview = page.getByLabel('Action preview', { exact: true })
        await expect(
          preview.getByRole('button', { name: 'Forecast details', exact: true }),
        ).toBeVisible()
        await check(`${name}-ready`)
        const parameters = preview.locator('[data-battle-preview-lane="parameters"]')
        const tags = await parameters.locator('[data-battle-preview-chip]').allTextContents()
        expect(tags.map((tag) => tag.split(':')[0])).toEqual(parameterLabels)
        expect(tags).toEqual(nexusRows[name])
        if (name === 'Ice Lance') {
          const target = preview.locator('[data-battle-target-forecast]')
          await expect(target).toHaveCount(1)
          const identity = await target.evaluate((element) => ({
            name: element.querySelector('strong')?.textContent,
            fallback: element
              .querySelector('[data-battle-target-portrait-fallback]')
              ?.getBoundingClientRect()
              .toJSON(),
            loaded: [...element.querySelectorAll('img')].some(
              (image) => image.complete && image.naturalWidth > 0,
            ),
          }))
          expect(identity.name).toBeTruthy()
          expect(
            identity.loaded ||
              Boolean(
                identity.fallback && identity.fallback.width > 0 && identity.fallback.height > 0,
              ),
          ).toBe(true)
          if (kind === 'pve') {
            await expect(target.locator('[data-battle-target-portrait-fallback]')).toBeVisible()
            await expect(target.locator('img')).toHaveCount(0)
          }
        }
        if (name === 'Chilling Mist') {
          const ground = preview.locator('[data-battle-ground-target]')
          await expect(ground).toHaveCount(1)
          expect(
            await ground
              .locator('img')
              .evaluate(
                (image) =>
                  image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
              ),
          ).toBe(true)
        }
        await parameters.focus()
        await expect(parameters).toBeFocused()
        const visibleTags = new Set<string>()
        for (let step = 0; step < 120; step += 1) {
          const state = await parameters.evaluate((lane) => {
            const box = lane.getBoundingClientRect()
            return {
              visible: [...lane.querySelectorAll('[data-battle-preview-chip]')]
                .filter((chip) => {
                  const item = chip.getBoundingClientRect()
                  return item.left >= box.left - 1 && item.right <= box.right + 1
                })
                .map((chip) => chip.textContent!),
              end: lane.scrollLeft + lane.clientWidth >= lane.scrollWidth - 1,
              scrollLeft: lane.scrollLeft,
            }
          })
          state.visible.forEach((tag) => visibleTags.add(tag))
          if (state.end) break
          await parameters.press('ArrowRight')
          await expect
            .poll(() => parameters.evaluate((lane) => lane.scrollLeft), {
              timeout: 1500,
              intervals: [20, 40, 80],
            })
            .toBeGreaterThan(state.scrollLeft)
        }
        await check(`${name}-keyboard-scrolled`)
        expect([...visibleTags]).toEqual(tags)
        expect(commits).toBe(0)
        await preview.getByRole('button', { name: 'Forecast details', exact: true }).click()
        const popup = page.getByRole('dialog', { name: 'Action forecast', exact: true })
        await expect(popup).toBeVisible()
        await check(`${name}-details`)
        expect(await popup.locator('[data-battle-skill-parameters] dt').allTextContents()).toEqual(
          parameterLabels,
        )
        await page.keyboard.press('Escape')
        await expect(popup).toHaveCount(0)
      }
      await page.locator('[data-battle-special="essence"] > button[aria-pressed]').click()
      await expect(
        page
          .getByLabel('Action preview', { exact: true })
          .locator('[data-battle-preview-lane="parameters"]'),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Forecast details', exact: true }),
      ).toBeVisible()
      await check('essence-armed')
      await page.getByRole('button', { name: 'Cancel Action', exact: true }).click()
      let release!: () => void
      const hold = new Promise<void>((resolve) => {
        release = resolve
      })
      let observed!: () => void
      const fetched = new Promise<void>((resolve) => {
        observed = resolve
      })
      await page.route('**/api/battles/*/preview', async (route) => {
        const response = await route.fetch()
        observed()
        await hold
        await route.fulfill({ response })
      })
      try {
        await page.getByRole('button', { name: /^Selected Chilling Mist,/ }).click()
        await fetched
        await expect(page.getByLabel('Action preview', { exact: true })).toContainText(
          'Calculating preview…',
        )
        await check('pending-ground')
      } finally {
        release()
        await page.unroute('**/api/battles/*/preview')
      }
      await expect(
        page.getByRole('button', { name: 'Forecast details', exact: true }),
      ).toBeVisible()
      await check('pending-resolved')
    }
    expect(commits).toBe(0)
    expect(await readBattle(page)).toEqual(baselineState)
  } finally {
    page.off('request', observe)
  }
}

test('AI forecast arming, targets, keyboard reading and details keep the desktop board fixed', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Both approved desktop geometries are exercised in one authenticated session',
  )
  test.setTimeout(180_000)
  await provision(page, 'Forecast')
  const nexusRows = await equipForecastSkills(page)
  await page.goto('/game/battle')
  await page.getByLabel('Battle mode').selectOption('recruit-sparring')
  await page.getByRole('button', { name: 'Enter Battle' }).click()
  await expect(page).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/)
  await arrangeAdjacentCombatants(page)
  await exerciseForecast(page, testInfo, 'pve', nexusRows)
})

test('share-code PvP forecast uses the same fixed desktop board and readable lanes', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-chromium',
    'Both approved desktop geometries are exercised in one authenticated session',
  )
  test.setTimeout(240_000)
  const hostContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: viewports[0],
  })
  const guestContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
    viewport: viewports[0],
  })
  const host = await hostContext.newPage()
  const guest = await guestContext.newPage()
  try {
    await provision(host, 'ForeHost')
    const hostRows = await equipForecastSkills(host)
    await provision(guest, 'ForeGuest')
    const guestRows = await equipForecastSkills(guest)
    await host.goto('/game/battle')
    await host.getByRole('button', { name: 'PVP - Direct', exact: true }).click()
    await host.getByRole('button', { name: 'Create Battle Lobby' }).click()
    const hostDialog = host.getByRole('dialog', { name: 'The arena is waiting.' })
    await expect(hostDialog).toBeVisible()
    const code = (await hostDialog
      .locator('button')
      .filter({ hasText: 'Lobby Key' })
      .locator('strong')
      .textContent())!.trim()
    expect(code).toMatch(/^AVL-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    await guest.goto(`/game/battle?join=${encodeURIComponent(code)}`)
    const guestDialog = guest.getByRole('dialog', { name: 'The arena is waiting.' })
    await guestDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await hostDialog.getByRole('button', { name: 'Mark Ready' }).click()
    await expect(host).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect(guest).toHaveURL(/\/game\/battle\/[0-9a-f-]{36}$/, { timeout: 20_000 })
    await expect
      .poll(
        async () =>
          (await host.locator('main[data-unified-battle]').getAttribute('data-local-turn')) ===
            'true' ||
          (await guest.locator('main[data-unified-battle]').getAttribute('data-local-turn')) ===
            'true',
      )
      .toBe(true)
    const activeHost =
      (await host.locator('main[data-unified-battle]').getAttribute('data-local-turn')) === 'true'
    const active = activeHost ? host : guest
    await arrangeAdjacentCombatants(active)
    await exerciseForecast(active, testInfo, 'pvp', activeHost ? hostRows : guestRows)
  } finally {
    await Promise.all([hostContext.close(), guestContext.close()])
  }
})
