import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { expectTerrainKey } from './battle-map-key-helpers'

import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test'
import type { BattleSessionView } from '../src/server/battle/battle-session-service'
import { selectDiscipline } from './discipline-library-helpers'
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
  'Effects',
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
  // Exercise the direct-image path, which previously received a second legacy map portrait.
  await page.goto('/game/account/titles')
  await page
    .getByLabel('Direct image URL')
    .fill('http://127.0.0.1:3100/media/art/adventure/male-01-v01.webp')
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/account/profile-display') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Save Profile Image', exact: true }).click()
  expect((await saved).ok()).toBe(true)
  return name
}

async function equipForecastSkills(page: Page) {
  await page.goto('/game/nexus')
  await page.getByRole('button', { name: /Manage Disciplines/ }).click()
  const management = page.getByRole('dialog', { name: 'Discipline Management', exact: true })
  await selectDiscipline(management, 'Primary', 'Frostweaver')
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
        rows.map((row) => {
          const label = row.querySelector('dt')!.textContent
          const value = row.querySelector('dd')!
          const effects = value.querySelectorAll('[data-compact-skill-effect="true"]')
          // Nexus renders separate effect chips; battle uses a comma-separated value.
          // Compare every chip, in order, without concatenating their DOM text together.
          const text = effects.length
            ? Array.from(effects, (effect) => effect.textContent).join(', ')
            : value.textContent
          return `${label}: ${text}`
        }),
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
      cockpit: rect(root.querySelector('[data-unified-command-deck]')),
      commandAlignment: [
        ...root.querySelectorAll(
          '[data-command-card], [data-battle-skill-slot], [data-battle-special]',
        ),
      ].map((card) => ({
        controls: rect(card.querySelector('[data-battle-cockpit-controls]')),
        name: rect(card.querySelector('strong')),
        nameLines: (() => {
          const range = document.createRange()
          range.selectNodeContents(card.querySelector('strong')!)
          return [...range.getClientRects()].map(({ x, y, width, height }) => ({
            x,
            y,
            width,
            height,
          }))
        })(),
        artwork: rect(
          card.querySelector(
            '[data-battle-command-artwork], [data-av-square-media], :scope > span',
          ),
        ),
      })),
      terrainToggle: rect(root.querySelector('button[aria-label="Terrain"]')),
      cancel: rect(root.querySelector('[data-battle-footer-actions] > button:nth-child(2)')),
      footer: rect(root.querySelector('footer')),
      commandContents: [
        ...root.querySelectorAll(
          '[data-command-card], [data-command-card] > *, [data-unified-facing-pad] button, [data-battle-skill-slot] > *, [data-battle-special] > *',
        ),
      ]
        .filter((node) => node.getBoundingClientRect().height > 0)
        .map(rect),
      cards: [...root.querySelectorAll<HTMLElement>('[data-battle-combatant-card]')].map(
        (card) => ({
          rect: rect(card),
          portrait: rect(card.querySelector('button[aria-label^="Inspect "]')),
          vitals: rect(card.querySelector('[data-resource]')?.parentElement ?? null),
          overflow: card.scrollHeight - card.clientHeight,
          resources: [...card.querySelectorAll('[data-resource]')].map((row) => ({
            label: rect(row.querySelector('span')),
            bar: rect(row.querySelector('i')),
          })),
          effects: rect(card.querySelector('section')),
        }),
      ),
      tokens: [...root.querySelectorAll('#battlefield button[aria-label*="occupied by"]')].map(
        (tile) => ({
          tile: rect(tile),
          token: rect(tile.querySelector(':scope > [data-team]')),
          portraits: [...tile.querySelectorAll('img')].map(rect),
          duplicatePortraits: tile.querySelectorAll('[data-map-token-portrait]').length,
        }),
      ),
      board: rect(root.querySelector('[data-board-auto-fit]')),
      strip: rect(root.querySelector('[data-battle-preview-strip]')),
      preview: rect(preview),
      lanes: [...root.querySelectorAll<HTMLElement>('[data-battle-preview-lane]')]
        .filter((lane) => lane.offsetWidth > 0)
        .map((lane) => ({
          name: lane.dataset.battlePreviewLane,
          rect: rect(lane),
          tabIndex: lane.tabIndex,
          overflowX: getComputedStyle(lane).overflowX,
          scrollLeft: lane.scrollLeft,
          scrollWidth: lane.scrollWidth,
          clientWidth: lane.clientWidth,
          scrollHeight: lane.scrollHeight,
          clientHeight: lane.clientHeight,
          chips: [...lane.querySelectorAll('[data-battle-preview-chip]')].map((chip) => ({
            text: chip.textContent,
            rect: rect(chip),
          })),
        })),
      info: rect(
        [...(preview?.querySelectorAll('button[data-battle-info-trigger]') ?? [])].find((button) =>
          /^(i|ⓘ)$/i.test(button.textContent?.trim() ?? ''),
        ) ?? null,
      ),
      readingTriggers: [
        ...(preview?.querySelectorAll('button[data-battle-info-trigger]') ?? []),
      ].map(rect),
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
  expect(geometry.cockpit!.height).toBeLessThanOrEqual(168)
  expect(geometry.strip!.height).toBeCloseTo(44, 0)
  expect(geometry.info).toBeNull()
  for (const command of geometry.commandAlignment) {
    expect(
      command.name!.y + command.name!.height,
      'skill names fit above info/hotkey row',
    ).toBeLessThanOrEqual(command.controls!.y + 1)
    for (const line of command.nameLines) contained(line, command.name!)
  }
  const controls = geometry.commandAlignment.map((command) => command.controls!.y)
  expect(
    Math.max(...controls) - Math.min(...controls),
    'cockpit info and hotkeys share one row',
  ).toBeLessThanOrEqual(1)
  const sizes = geometry.commandAlignment.map((command) => command.artwork!.width)
  expect(
    Math.min(...sizes),
    'cockpit art is visibly larger within its existing dock budget',
  ).toBeGreaterThanOrEqual(68)
  expect(
    Math.max(...sizes) - Math.min(...sizes),
    'empty and populated cockpit squares have equal size',
  ).toBeLessThanOrEqual(1)
  for (const command of geometry.commandAlignment) {
    expect(
      Math.abs(command.artwork!.width - command.artwork!.height),
      'artwork keeps a square frame',
    ).toBeLessThanOrEqual(1)
    expect(
      command.artwork!.y - geometry.cockpit!.y,
      'artwork retains a small space above it',
    ).toBeLessThanOrEqual(8)
    expect(command.artwork!.y - geometry.cockpit!.y).toBeGreaterThanOrEqual(4)
  }
  const artwork = geometry.commandAlignment.map((command) => command.artwork!.y)
  expect(
    Math.max(...artwork) - Math.min(...artwork),
    'all cockpit artwork shares one row',
  ).toBeLessThanOrEqual(1)
  if (geometry.cards.length === 2) {
    expect(
      Math.abs(geometry.cards[0]!.rect!.height - geometry.cards[1]!.rect!.height),
      'rail cards have equal height',
    ).toBeLessThanOrEqual(1)
    expect(
      Math.abs(geometry.cards[0]!.portrait!.height - geometry.cards[1]!.portrait!.height),
      'rail portraits have equal height regardless of character name',
    ).toBeLessThanOrEqual(1)
  }
  expect(geometry.terrainToggle).not.toBeNull()
  contained(geometry.terrainToggle!, geometry.footer!)
  expect(geometry.terrainToggle!.x + geometry.terrainToggle!.width).toBeLessThanOrEqual(
    geometry.cancel!.x + 1,
  )
  for (const content of geometry.commandContents) contained(content!, geometry.cockpit!)
  for (const card of geometry.cards) {
    expect(card.overflow, 'combatant summary fits without scrolling').toBeLessThanOrEqual(1)
    contained(card.effects!, card.rect!)
    contained(card.portrait!, card.rect!)
    expect(card.portrait!.height).toBeGreaterThanOrEqual(32)
    expect(Math.abs(card.portrait!.width - card.portrait!.height)).toBeLessThanOrEqual(1)
    if (geometry.viewport.width > 820) {
      expect(card.portrait!.x + card.portrait!.width).toBeLessThanOrEqual(card.vitals!.x + 1)
      expect(
        Math.abs(
          card.portrait!.y + card.portrait!.height / 2 - (card.vitals!.y + card.vitals!.height / 2),
        ),
      ).toBeLessThanOrEqual(1)
    } else {
      expect(card.portrait!.y + card.portrait!.height).toBeLessThanOrEqual(card.vitals!.y + 1)
    }
    for (const resource of card.resources) {
      expect(resource.bar!.x).toBeGreaterThan(resource.label!.x)
      expect(Math.abs(resource.bar!.y - resource.label!.y)).toBeLessThanOrEqual(4)
    }
  }
  for (const token of geometry.tokens) {
    expect(token.duplicatePortraits).toBe(0)
    contained(token.token!, token.tile!)
    expect(Math.abs(token.token!.width - token.token!.height)).toBeLessThanOrEqual(1)
    for (const portrait of token.portraits) contained(portrait!, token.token!)
  }
  const visibleLaneTop = Math.min(...geometry.lanes.map((lane) => lane.rect!.y))
  const visibleLaneBottom = Math.max(
    ...geometry.lanes.map((lane) => lane.rect!.y + lane.rect!.height),
  )
  expect(
    Math.abs(
      (visibleLaneTop + visibleLaneBottom) / 2 -
        (geometry.preview!.y + geometry.preview!.height / 2),
    ),
    'the preview text lanes are vertically centered',
  ).toBeLessThanOrEqual(1)
  for (const lane of geometry.lanes) {
    contained(lane.rect!, geometry.preview!)
    expect(lane.overflowX).toBe('visible')
    expect(lane.scrollWidth).toBeLessThanOrEqual(lane.clientWidth + 1)
    expect(lane.scrollHeight).toBeLessThanOrEqual(lane.clientHeight + 1)
    for (const chip of lane.chips) {
      expect(chip.rect!.y).toBeGreaterThanOrEqual(lane.rect!.y - 1)
      expect(chip.rect!.y + chip.rect!.height).toBeLessThanOrEqual(
        lane.rect!.y + lane.rect!.height + 1,
      )
    }
  }
  for (const trigger of geometry.readingTriggers) contained(trigger!, geometry.preview!)
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
      await expectTerrainKey(page)
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
      await expect(page.locator('[data-battle-combatant-card="selected"]')).not.toContainText(
        await page.locator('[data-battle-combatant-card="local"] header strong').innerText(),
      )
      await page
        .locator('[data-battle-combatant-card="local"]')
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
            page
              .getByLabel('Action preview', { exact: true })
              .locator('[data-battle-preview-lane="outcomes"] [data-battle-preview-chip]')
              .first(),
          ).toBeVisible()
        if (command === 'guard')
          await expect(page.getByLabel('Action preview', { exact: true })).toContainText('30 AP')
        await check(`${command}-armed`)
      }
      await page.locator('button[data-battle-command="finish"]').click()
      await expect(page.getByRole('group', { name: 'Final facing' })).toBeVisible()
      await check('finish-facing')
      await page.getByRole('button', { name: 'Cancel Action', exact: true }).click()
      for (const name of ['Ice Lance', 'Frost Guard', 'Chilling Mist']) {
        await page.getByRole('button', { name: new RegExp(`^Selected ${name},`) }).click()
        const preview = page.getByLabel('Action preview', { exact: true })
        await expect(
          preview
            .locator('[data-battle-preview-lane="outcomes"] [data-battle-preview-chip]')
            .first(),
        ).toBeVisible()
        await check(`${name}-ready`)
        await preview.getByRole('button', { name: `Show ${name} parameters`, exact: true }).click()
        const parameters = page.getByRole('dialog', { name: `${name} parameters`, exact: true })
        await expect(parameters).toBeVisible()
        const tags = await parameters
          .locator('dl > div')
          .evaluateAll((rows) =>
            rows.map(
              (row) =>
                `${row.querySelector('dt')!.textContent}: ${row.querySelector('dd')!.textContent}`,
            ),
          )
        expect(tags.map((tag) => tag.split(':')[0])).toEqual(parameterLabels)
        expect(tags).toEqual(nexusRows[name])
        await check(`${name}-parameters`)
        await page.keyboard.press('w')
        await page.keyboard.press('Space')
        expect(commits).toBe(0)
        await page.keyboard.press('Escape')
        await expect(parameters).toHaveCount(0)
        await expect(
          preview.getByRole('button', { name: `Show ${name} parameters`, exact: true }),
        ).toBeFocused()
        await preview.getByRole('button', { name: 'Show forecast details', exact: true }).click()
        const forecastDetails = page.getByRole('dialog', { name: 'Forecast details', exact: true })
        await expect(forecastDetails).toBeVisible()
        if (name === 'Ice Lance') {
          const target = forecastDetails.locator('[data-battle-target-forecast]')
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
          const ground = forecastDetails.locator('[data-battle-ground-target]')
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
        await check(`${name}-forecast-details`)
        // A click outside the reader dismisses it without executing an action.
        const outsideTileIndex = await page
          .locator('#battlefield button[aria-label^="Tile "]')
          .evaluateAll((tiles) => {
            const reader = document
              .querySelector('[data-battle-info-panel]')!
              .getBoundingClientRect()
            return tiles.findIndex((tile) => {
              const bounds = tile.getBoundingClientRect()
              const x = bounds.x + bounds.width / 2,
                y = bounds.y + bounds.height / 2
              return (
                x >= 0 &&
                x < innerWidth &&
                y >= 0 &&
                y < innerHeight &&
                (x < reader.left || x > reader.right || y < reader.top || y > reader.bottom)
              )
            })
          })
        if (outsideTileIndex >= 0) {
          await page
            .locator('#battlefield button[aria-label^="Tile "]')
            .nth(outsideTileIndex)
            .click()
        } else {
          // Complete reports can cover the whole board; the viewport margin remains dismissible.
          const readerBounds = await forecastDetails.boundingBox()
          expect(readerBounds!.x > 1 || readerBounds!.y > 1).toBe(true)
          await page.mouse.click(1, 1)
        }
        await expect(forecastDetails).toHaveCount(0)
        expect(commits).toBe(0)
        await page.getByRole('button', { name: 'About ' + name, exact: true }).click()
        const popup = page.getByRole('dialog', { name, exact: true })
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
        page
          .getByLabel('Action preview', { exact: true })
          .locator('[data-battle-preview-lane="outcomes"] [data-battle-preview-chip]')
          .first(),
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
      const previewUrl = new URL(
        `/api/battles/${baselineState.battleSessionId}/preview`,
        page.url(),
      ).toString()
      let handled: Promise<void> | undefined
      const holdPreview = (route: Route) => {
        handled = (async () => {
          const response = await route.fetch()
          observed()
          await hold
          await route.fulfill({ response })
        })()
        return handled
      }
      await page.route(previewUrl, holdPreview, { times: 1 })
      try {
        await page.getByRole('button', { name: /^Selected Chilling Mist,/ }).click()
        await fetched
        await expect(page.getByLabel('Action preview', { exact: true })).toContainText(
          'Calculating preview…',
        )
        await check('pending-ground')
      } finally {
        release()
        // Removing interception can release a paused route itself. Let the held real
        // response finish exactly once before removing this viewport's handler.
        await handled
        await page.unroute(previewUrl, holdPreview)
      }
      await expect(
        page
          .getByLabel('Action preview', { exact: true })
          .locator('[data-battle-preview-lane="outcomes"] [data-battle-preview-chip]')
          .first(),
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
