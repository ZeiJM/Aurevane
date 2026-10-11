// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-targeting-browser-regression.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { createServer } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-targeting-'))
const output = process.env.AV_TARGETING_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-ally-inspection-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/percentage-dot-viewer-state.ts'),
  resolve(fixture, 'percentage-dot-viewer-state.ts'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'production-styles.js'),
  [
    '@aurevane/ui/styles.css',
    ...[
      'globals',
      'pv1e-shell-fixes',
      'mobile-ui-batch',
      'portrait-ratio-standardization',
      'desktop-readability',
      'desktop-page-fit',
      'mobile-readability',
      'concept-shell',
      'profile-ui-readability-pass',
      'sitewide-layout-v2',
      'approved-adventure',
    ].map((name) => `@/app/${name}.css`),
  ]
    .map((path) => `import '${path}'`)
    .join('\n'),
)
await fs.writeFile(
  resolve(fixture, 'next-link.jsx'),
  `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}`,
)
await fs.writeFile(
  resolve(fixture, 'next-dynamic.jsx'),
  `import React from 'react';export default function dynamic(loader){const Component=React.lazy(()=>loader().then(value=>({default:value})));return props=><React.Suspense fallback={null}><Component {...props}/></React.Suspense>}`,
)
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/audio': resolve(root, 'packages/audio/src/index.ts'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/link': resolve(fixture, 'next-link.jsx'),
      'next/dynamic': resolve(fixture, 'next-dynamic.jsx'),
      'next/image': resolve(fixture, 'next-mock.jsx'),
      'next/navigation': resolve(fixture, 'next-mock.jsx'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: { include: ['react', 'react-dom/client'] },
})
await server.listen()
const browser = await chromium.launch({
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
  args: ['--no-sandbox'],
  headless: true,
})
const errors = []
let cases = 0
const commits = (page) =>
  page.evaluate(() => window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)))
const tile = (page, x, y) =>
  page
    .locator('#battlefield')
    .getByRole('button', { name: new RegExp(`^Tile ${x + 1}, ${y + 1};`) })
try {
  // Compass badges stay readable at board edges without changing portrait or meter geometry.
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      page.setDefaultTimeout(10000)
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&compass=edges`)
      await page.locator('#battlefield').waitFor()
      await page
        .locator('#battlefield')
        .screenshot({ path: resolve(output, `${mode}-${viewport.width}-compass-edges.png`) })
      const badges = page.locator('[data-battle-facing-indicator="true"]')
      assert.equal(await badges.count(), 4, `${mode}: all living combatants use the shared compass`)
      const directions = []
      for (const badge of await badges.all()) {
        const geometry = await badge.evaluate((el) => {
          const tile = el.parentElement,
            token = tile.querySelector('[data-team]')
          const rect = (value) => value.getBoundingClientRect().toJSON()
          return {
            badge: rect(el),
            token: rect(token),
            tile: rect(tile),
            direction: el.dataset.facing,
            color: getComputedStyle(el).color,
            identity: getComputedStyle(token).borderTopColor,
            pointer: getComputedStyle(el).pointerEvents,
            radius: getComputedStyle(el).borderRadius,
            transform: getComputedStyle(el).transform,
            svg: rect(el.querySelector('svg')),
          }
        })
        directions.push(geometry.direction)
        assert.ok(geometry.badge.width >= 12 && geometry.svg.width >= 6, 'Readable badge and arrow')
        assert.equal(geometry.pointer, 'none')
        assert.equal(geometry.radius, '50%')
        assert.equal(geometry.color, geometry.identity)
        assert.ok(
          geometry.badge.left >= geometry.tile.left - 1 &&
            geometry.badge.right <= geometry.tile.right + 1,
        )
        assert.ok(
          geometry.badge.top >= geometry.tile.top && geometry.badge.top <= geometry.tile.top + 3,
          'Facing sits inside the tile top-left',
        )
        assert.ok(
          geometry.badge.left >= geometry.tile.left &&
            geometry.badge.left <= geometry.tile.left + 3,
          'Facing is independent of portrait position',
        )
        const angle = {
          north: 'matrix(1, 0, 0, 1',
          east: 'matrix(0, 1, -1, 0',
          south: 'matrix(-1, 0, 0, -1',
          west: 'matrix(0, -1, 1, 0',
        }[geometry.direction]
        assert.ok(geometry.transform.startsWith(angle), 'Arrow rotation matches recorded facing')
      }
      assert.deepEqual(directions.sort(), ['east', 'north', 'south', 'west'])
      await page.emulateMedia({ reducedMotion: 'reduce' })
      assert.equal(
        await badges.first().evaluate((el) => getComputedStyle(el).animationName),
        'none',
      )
      if (mode === 'spectator') {
        const chat = page
          .locator('details')
          .filter({ has: page.getByText('Battle Chat', { exact: true }) })
        const summary = chat.locator('summary')
        await summary.click()
        assert.equal(await chat.getAttribute('open'), '')
        await chat.getByRole('textbox').waitFor()
        const bounds = await chat.evaluate((el) => ({
          summary: el.querySelector('summary').getBoundingClientRect().toJSON(),
          panel: el.querySelector('[class*="comms"]').getBoundingClientRect().toJSON(),
        }))
        assert.ok(
          bounds.panel.bottom <= bounds.summary.top - 4,
          'Chat stays above its close control',
        )
        assert.ok(
          bounds.panel.left >= 0 && bounds.panel.right <= viewport.width,
          'Chat stays within viewport width',
        )
        assert.ok(bounds.panel.top >= 0, 'Chat stays within viewport height')
        await page.screenshot({
          path: resolve(output, `spectator-${viewport.width}-chat-open.png`),
          fullPage: true,
        })
        await summary.click()
        assert.equal(await chat.getAttribute('open'), null)
        assert.equal(await chat.getByRole('textbox').isVisible(), false)
      }
      assert.equal((await commits(page)).length, 0, 'Presentation never issues a combat command')
      cases++
      await page.close()
    }
  }
  if (process.env.AV_TARGETING_ONLY_GROUND !== '1') {
    for (const mode of ['pve', 'pvp']) {
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        for (const targeting of [
          'single',
          'line',
          'circle1',
          'circle2',
          'ground-circle1',
          'all',
          'all-any',
          'all-ground',
          'heal',
          'buff',
          'legacy',
        ]) {
          const page = await browser.newPage({
            viewport,
            isMobile: viewport.width < 821,
            hasTouch: viewport.width < 821,
          })
          page.setDefaultTimeout(10000)
          page.on('pageerror', (error) => errors.push(`${mode}/${targeting}: ${error.message}`))
          await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&targeting=${targeting}`)
          await page.locator('[data-battle-combatant-card="local"]').waitFor()
          const original = await page.evaluate(() => structuredClone(window.fixtureBattle.snapshot))
          const arm = () => page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
          await arm()
          const selector =
            targeting === 'heal'
              ? '[data-heal-target="true"]'
              : targeting === 'all-ground' || targeting === 'ground-circle1'
                ? '[data-ground-path="true"]'
                : targeting === 'buff' || targeting === 'all-any'
                  ? '[data-buff-path="true"]'
                  : '[data-attack-path="true"]'
          const count =
            targeting === 'single'
              ? 4
              : targeting === 'all-any'
                ? 4
                : targeting === 'line'
                  ? 12
                  : targeting === 'circle1' || targeting === 'ground-circle1'
                    ? 8
                    : targeting === 'circle2'
                      ? 24
                      : targeting === 'all-ground'
                        ? 63
                        : targeting === 'legacy'
                          ? null
                          : 2
          if (count !== null)
            await page
              .waitForFunction(
                ({ selector, count }) =>
                  document.querySelectorAll('#battlefield button' + selector).length === count,
                { selector, count },
              )
              .catch(async (error) => {
                throw new Error(
                  `${mode}/${viewport.width}/${targeting}: expected ${count} ${selector} tiles; found ${await page.locator('#battlefield button' + selector).count()}; ${await page.locator('[data-battle-notice]').innerText()}`,
                  { cause: error },
                )
              })
          await page
            .waitForFunction(() => window.forecasts?.length > 0)
            .catch(async (error) => {
              throw new Error(
                `${mode}/${viewport.width}/${targeting}: missing forecast; ${await page.locator('[data-battle-notice]').innerText()}; errors ${errors.join('; ')}`,
                { cause: error },
              )
            })
          assert.deepEqual(
            await page.evaluate(() => window.fixtureBattle.snapshot),
            original,
            'Arming and forecasting leave state and RNG unchanged',
          )
          assert.equal((await commits(page)).length, 0)
          if (count !== null)
            assert.equal(
              await page.locator('#battlefield button' + selector).count(),
              count,
              'Automatic recipient detection keeps potential geometry',
            )
          const fill = await page
            .locator('#battlefield button' + selector)
            .first()
            .evaluate((button) => getComputedStyle(button, '::after').backgroundColor)
          assert.equal(
            fill,
            targeting === 'heal'
              ? 'rgba(102, 218, 143, 0.5)'
              : targeting === 'all-ground' || targeting === 'ground-circle1'
                ? 'rgba(222, 117, 34, 0.3)'
                : targeting === 'buff' || targeting === 'all-any'
                  ? 'rgba(108, 145, 198, 0.5)'
                  : 'rgba(189, 38, 58, 0.22)',
          )
          if (targeting.includes('circle')) {
            assert.equal(await tile(page, 3, 3).getAttribute('data-self-target'), null)
            assert.equal(await tile(page, 3, 3).getAttribute('data-target'), null)
            assert.equal(
              await tile(page, 3, 3).evaluate(
                (button) => getComputedStyle(button, '::after').content,
              ),
              'none',
              'Circle caster tile has no selection fill',
            )
          }
          if (targeting === 'circle1' || targeting === 'ground-circle1' || targeting === 'single') {
            assert.equal(
              await tile(page, 5, 3).getAttribute('data-target'),
              null,
              'Out-of-footprint occupied tiles have no target outline',
            )
          }
          await page.screenshot({
            path: resolve(output, `${mode}-${viewport.width}-${targeting}.png`),
            fullPage: true,
          })
          const forecasts = await page.evaluate(() =>
            window.forecasts.filter((row) => row.preview.legal),
          )
          if (targeting === 'all')
            assert.deepEqual(forecasts[0].preview.affectedCombatantIds.slice().sort(), [
              'enemy-one',
              'enemy-two',
            ])
          if (targeting === 'all-any')
            assert.equal(forecasts[0].preview.affectedCombatantIds.length, 4)
          if (targeting === 'heal' || targeting === 'buff')
            assert.deepEqual(forecasts[0].preview.affectedCombatantIds.slice().sort(), [
              'ally',
              'character:player',
            ])
          if (targeting === 'all-ground') {
            assert.equal(forecasts[0].preview.affectedTiles.length, 63)
            const outcomes = await page.locator('[data-battle-preview-lane="outcomes"]').innerText()
            assert.match(outcomes, /Frozen Ground.*2 rounds/)
            assert.doesNotMatch(
              outcomes,
              /63 tiles|caster’s enemies only|both teams|Airborne exempt/,
            )
            assert.ok(
              outcomes.length < 3500,
              'Ground preview summarizes terrain instead of listing every tile',
            )
          }
          if (targeting === 'legacy') {
            assert.equal(
              await page.evaluate(() => window.targetingDefinition.target.geometryVersion),
              undefined,
            )
            assert.ok(
              forecasts.every(
                (row) =>
                  row.intent.target.kind !== 'direction' && row.intent.target.kind !== 'activate',
              ),
            )
          }
          if (targeting === 'single') {
            // A forced move leaves no red single-unit targeting cue on the vacated tile.
            await page.locator('[data-command-slot="attack"]').click()
            await page.waitForFunction(
              () =>
                document.querySelector('#battlefield button[aria-label^="Tile 5, 4;"]')?.style
                  .borderColor === 'rgb(255, 118, 111)',
            )
            await page.evaluate(() => {
              window.fixtureBattle = {
                ...window.fixtureBattle,
                battleVersion: window.fixtureBattle.battleVersion + 1,
                snapshot: {
                  ...window.fixtureBattle.snapshot,
                  tactical: {
                    ...window.fixtureBattle.snapshot.tactical,
                    placements: window.fixtureBattle.snapshot.tactical.placements.map((row) =>
                      row.combatantId === 'enemy-one' ? { ...row, position: { x: 3, y: 2 } } : row,
                    ),
                  },
                },
              }
              window.publishBattle()
            })
            await page.waitForFunction(
              () =>
                document.querySelector('#battlefield button[aria-label^="Tile 5, 4;"]')?.style
                  .borderColor === '',
            )
            await arm()
            await page.waitForFunction(
              () =>
                document.querySelector('#battlefield button[aria-label^="Tile 5, 4;"]')?.dataset
                  .attackPath === 'true',
            )
            assert.equal(
              await tile(page, 4, 3).getAttribute('data-attack-path'),
              'true',
              'An empty in-range tile keeps the potential glow',
            )
            assert.equal(
              await tile(page, 4, 3).getAttribute('data-target'),
              null,
              'The moved unit leaves no target outline',
            )
            assert.equal(
              await tile(page, 4, 3).evaluate((button) => button.style.borderColor),
              '',
              'The vacated tile has no stale inline target border',
            )
            assert.equal(await tile(page, 5, 4).getAttribute('data-attack-path'), null)
            assert.equal(
              await tile(page, 5, 4).evaluate(
                (button) => getComputedStyle(button, '::after').content,
              ),
              'none',
            )
            await page.getByRole('button', { name: 'Cancel Action', exact: true }).click()
            assert.equal(
              await page.locator('#battlefield button[data-attack-path="true"]').count(),
              0,
            )
            assert.deepEqual(
              await tile(page, 4, 3).evaluate((button) => ({
                border: button.style.borderColor,
                background: button.style.backgroundColor,
                shadow: button.style.boxShadow,
                glow: getComputedStyle(button, '::after').content,
              })),
              { border: '', background: '', shadow: '', glow: 'none' },
              'Cancel clears the potential glow and all stale target overrides',
            )
          }
          if (targeting === 'line') {
            // Mouse hover previews one cast while every legal potential lane remains visible.
            if (viewport.width > 821) {
              await tile(page, 6, 3).hover()
              await page.waitForFunction(
                () =>
                  document.querySelectorAll('#battlefield button[data-attack-path="true"]')
                    .length === 12,
              )
              assert.equal((await commits(page)).length, 0)
              await page.mouse.move(0, 0)
              await page.waitForFunction(
                () =>
                  document.querySelectorAll('#battlefield button[data-attack-path="true"]')
                    .length === 12,
              )
            }
            for (const [direction, key, dx, dy] of [
              ['north', 'ArrowUp', 0, -1],
              ['east', 'KeyD', 1, 0],
              ['south', 'ArrowDown', 0, 1],
              ['west', 'KeyA', -1, 0],
            ]) {
              await page.evaluate(
                ({ original, dx, dy }) => {
                  const snapshot = structuredClone(original)
                  snapshot.tactical.placements = snapshot.tactical.placements.map((row) => ({
                    ...row,
                    position:
                      row.combatantId === 'enemy-one'
                        ? { x: 3 + dx, y: 3 + dy }
                        : row.combatantId === 'enemy-two'
                          ? { x: 3 + dx * 2, y: 3 + dy * 2 }
                          : row.combatantId === 'ally'
                            ? { x: 0, y: 0 }
                            : row.position,
                  }))
                  window.fixtureBattle = {
                    ...window.fixtureBattle,
                    battleVersion: window.fixtureBattle.battleVersion + 1,
                    snapshot,
                  }
                  window.receipts = []
                  window.publishBattle()
                },
                { original, dx, dy },
              )
              await arm()
              const version = await page.evaluate(() => window.fixtureBattle.battleVersion)
              await page.keyboard.press(key)
              await page.waitForFunction(
                (version) => window.fixtureBattle.battleVersion > version,
                version,
              )
              await page.waitForFunction(
                () => !document.querySelector('[data-battle-execution-pending="true"]'),
              )
              const command = (await commits(page)).at(-1)
              assert.deepEqual(command.body.intent.target, { kind: 'direction', direction })
              const recipients = await page.evaluate(() =>
                window.receipts
                  .filter(
                    (event) =>
                      (event.event === 'damage_applied' && event.amount > 0) ||
                      event.event === 'combat_accuracy_resolved',
                  )
                  .map((event) => event.targetCombatantId),
              )
              assert.deepEqual(
                [...new Set(recipients)].sort(),
                ['enemy-one', 'enemy-two'],
                'The same command resolves both occupants in the full lane, including legitimate misses',
              )
            }
            // Preview failures retain armed potential coverage; stale views cannot advertise outcomes.
            for (const failure of ['http', 'network', 'stale']) {
              await page.evaluate(
                ({ original, failure }) => {
                  window.previewFailure = failure
                  window.fixtureBattle = {
                    ...window.fixtureBattle,
                    battleVersion: window.fixtureBattle.battleVersion + 1,
                    snapshot: structuredClone(original),
                  }
                  window.publishBattle()
                },
                { original, failure },
              )
              await arm()
              await page.waitForFunction(
                () =>
                  document.querySelectorAll('#battlefield button[data-attack-path="true"]')
                    .length === 12,
              )
              await page.waitForFunction(() =>
                document
                  .querySelector('[data-battle-notice]')
                  ?.textContent.match(/unavailable|connection failed|out of date/),
              )
              assert.deepEqual(await page.evaluate(() => window.fixtureBattle.snapshot), original)
            }
            await page.evaluate(() => {
              window.previewFailure = null
            })
            // A diagonal touch/click cannot invent a Line direction or submit a command.
            const priorCommands = (await commits(page)).length
            await tile(page, 4, 4).click()
            assert.equal((await commits(page)).length, priorCommands)
            assert.match(await page.locator('[data-battle-notice]').innerText(), /straight lane/)
            await page.keyboard.press('Escape')
            assert.equal(
              await page.locator('#battlefield button[data-attack-path="true"]').count(),
              0,
            )
            await page.waitForFunction(
              () => document.activeElement?.dataset.battleKeyboardFocusRoot === 'true',
            )
            assert.equal(
              await page.evaluate(() => document.activeElement?.dataset.battleKeyboardFocusRoot),
              'true',
            )
            await page.keyboard.press('Digit1')
            assert.equal(
              await page
                .locator('[data-battle-layout="refined"]')
                .getAttribute('data-battle-action-mode'),
              'move',
              'Cancel restores direct keyboard commands without a click',
            )
          }
          cases++
          await page.close()
        }
        const airbornePage = await browser.newPage({
          viewport,
          isMobile: viewport.width < 821,
          hasTouch: viewport.width < 821,
        })
        airbornePage.on('pageerror', (error) => errors.push(`${mode}/airborne: ${error.message}`))
        await airbornePage.goto(
          server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&airborne=1`,
        )
        await airbornePage.locator('[data-battle-combatant-card="local"]').waitFor()
        await airbornePage.evaluate(() => {
          const state = window.fixtureBattle.snapshot
          window.fixtureBattle = {
            ...window.fixtureBattle,
            battleVersion: window.fixtureBattle.battleVersion + 1,
            snapshot: {
              ...state,
              airborneJumpPolicyVersion: 1,
              statusState: state.statusState.map((row) =>
                row.combatantId === 'character:player'
                  ? {
                      ...row,
                      statuses: [
                        ...row.statuses,
                        {
                          statusId: 'airborne',
                          statusVersion: 1,
                          stacks: 1,
                          remainingOwnerTurnStarts: 2,
                          sourceCombatantId: 'character:player',
                        },
                      ],
                    }
                  : row,
              ),
              tactical: {
                ...state.tactical,
                tiles: state.tactical.tiles.map((row) =>
                  (row.position.x === 3 && row.position.y === 2) ||
                  (row.position.x === 4 && row.position.y === 3)
                    ? { ...row, elevation: 3 }
                    : row,
                ),
              },
            },
          }
          window.publishBattle()
        })
        await airbornePage.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
        await tile(airbornePage, 4, 3).click()
        await airbornePage.waitForFunction(() =>
          window.receipts?.some((event) => event.event === 'damage_applied'),
        )
        assert.ok(
          await airbornePage.evaluate(() =>
            window.forecasts.some((forecast) => forecast.preview.legal),
          ),
          'Airborne Attack preview and commit reach elevation3',
        )
        await airbornePage.locator('[data-command-slot="move"]').click()
        await tile(airbornePage, 3, 2).click()
        await airbornePage.waitForFunction(() =>
          window.fixtureBattle.snapshot.tactical.placements.some(
            (row) =>
              row.combatantId === 'character:player' &&
              row.position.x === 3 &&
              row.position.y === 2,
          ),
        )
        assert.equal(
          await airbornePage.evaluate(
            () =>
              window.fixtureBattle.snapshot.statBridge.combatants.find(
                (row) => row.combatantId === 'character:player',
              ).jump,
          ),
          1,
          'Airborne does not rewrite saved Jump',
        )
        assert.equal(
          await airbornePage.evaluate(
            () => window.fixtureBattle.snapshot.tactical.movementProfiles[0].maxElevationStep,
          ),
          1,
          'Committed movement preserves the saved profile',
        )
        await airbornePage.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-airborne-height3.png`),
        })
        await airbornePage.evaluate(() => {
          const state = window.fixtureBattle.snapshot
          window.fixtureBattle = {
            ...window.fixtureBattle,
            battleVersion: window.fixtureBattle.battleVersion + 1,
            snapshot: {
              ...state,
              statusState: state.statusState.map((row) =>
                row.combatantId === 'character:player'
                  ? {
                      ...row,
                      statuses: row.statuses.filter((status) => status.statusId !== 'airborne'),
                    }
                  : row,
              ),
            },
          }
          window.publishBattle()
        })
        await airbornePage.locator('[data-command-slot="move"]').click()
        await tile(airbornePage, 3, 3).click()
        await airbornePage.waitForFunction(() =>
          window.fixtureBattle.snapshot.tactical.placements.some(
            (row) =>
              row.combatantId === 'character:player' &&
              row.position.x === 3 &&
              row.position.y === 3,
          ),
        )
        await airbornePage.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-airborne-expired-descent.png`),
        })
        await airbornePage.evaluate(() => {
          const state = window.fixtureBattle.snapshot
          window.fixtureBattle = {
            ...window.fixtureBattle,
            battleVersion: window.fixtureBattle.battleVersion + 1,
            snapshot: {
              ...state,
              terrainOverlays: [
                {
                  kind: 'frozen',
                  position: { x: 2, y: 2 },
                  remainingRoundBoundaries: 2,
                  sourceCombatantId: 'character:player',
                  frozenGroundPolicyVersion: 1,
                },
              ],
            },
          }
          window.publishBattle()
        })
        await airbornePage.locator('[data-command-slot="inspect"]').click()
        await tile(airbornePage, 2, 2).click()
        const groundNotice = await airbornePage
          .locator('[data-battle-preview-lane="outcomes"]')
          .innerText()
        assert.match(groundNotice, /Frozen Ground terrain · 2 rounds remaining/)
        assert.doesNotMatch(groundNotice, /Adds 10 AP|Airborne|caster’s enemies/)
        assert.match(await tile(airbornePage, 2, 2).getAttribute('aria-label'), /Adds 10 AP/)
        await airbornePage.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-compact-ground-inspect.png`),
        })
        cases++
        await airbornePage.close()
      }
    }
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(server.resolvedUrls.local[0] + '?mode=spectator&targeting=all')
      await page.locator('main[data-pvp-spectator="true"]').waitFor()
      assert.equal(await page.locator('[data-battle-command="basic-attack"]').count(), 0)
      assert.equal(await page.locator('#battlefield button[data-attack-path="true"]').count(), 0)
      assert.equal((await commits(page)).length, 0)
      assert.ok(!(await page.locator('body').innerText()).includes('rngSeed'))
      await page.screenshot({
        path: resolve(output, `spectator-${viewport.width}.png`),
        fullPage: true,
      })
      cases++
      await page.close()
    }
  }
  for (const mode of ['pve', 'pvp', 'spectator'])
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ])
      for (const preset of ['embers', 'frost', 'arcane-pulse']) {
        const page = await browser.newPage({ viewport })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&ground=${preset}`)
        const layers = page.locator('[data-ground-area-id="ground.area.fixture"]')
        await layers.first().waitFor()
        assert.equal(await layers.count(), 2)
        assert.equal(await page.locator('[data-ground-area-phase="pending"]').count(), 2)
        await page.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-${preset}-pending.png`),
          fullPage: true,
        })
        if (mode !== 'spectator') {
          await page.evaluate(() => {
            const next = structuredClone(window.fixtureBattle)
            next.battleVersion++
            next.snapshot.tactical.battle.round = 2
            window.fixtureBattle = next
            window.publishBattle()
          })
          await page.locator('[data-ground-area-phase="active"]').first().waitFor()
          assert.equal(await layers.count(), 2)
          assert.equal(await layers.first().getAttribute('data-ground-area-preset'), preset)
          const effect = await layers
            .first()
            .locator('i')
            .evaluate((el) => ({
              animation: getComputedStyle(el).animationName,
              pointer: getComputedStyle(el.parentElement).pointerEvents,
              zIndex: getComputedStyle(el.parentElement).zIndex,
            }))
          assert.notEqual(effect.animation, 'none')
          assert.equal(effect.pointer, 'none')
          assert.equal(effect.zIndex, '1')
          if (preset === 'embers' || preset === 'arcane-pulse') {
            const boundaryOpacity = await layers
              .first()
              .locator('i')
              .evaluate((el) => {
                const animation = el.getAnimations()[0]
                animation.pause()
                const duration = Number(animation.effect.getTiming().duration)
                return [0, duration, duration * 2].map((time) => {
                  animation.currentTime = time
                  return Number(getComputedStyle(el).opacity)
                })
              })
            assert.deepEqual(boundaryOpacity, [0, 0, 0])
          }

          await page.screenshot({
            path: resolve(output, `${mode}-${viewport.width}-${preset}-active.png`),
            fullPage: true,
          })
          await page.emulateMedia({ reducedMotion: 'reduce' })
          assert.equal(
            await layers
              .first()
              .locator('i')
              .evaluate((el) => getComputedStyle(el).animationName),
            'none',
          )
          await page.evaluate(() => {
            const next = structuredClone(window.fixtureBattle)
            next.battleVersion++
            next.snapshot.tactical.battle.round = 5
            window.fixtureBattle = next
            window.publishBattle()
          })
          await page.waitForFunction(
            () =>
              document.querySelectorAll('[data-ground-area-id="ground.area.fixture"]').length === 0,
          )
        }
        assert.equal(
          (await commits(page)).length,
          0,
          'Ground render phases issue no combat command',
        )
        cases++
        await page.close()
      }
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0] + '?mode=master-ground')
    await page.getByLabel('Ground duration (rounds)', { exact: true }).fill('4')
    await page.getByLabel('Ground animation', { exact: true }).selectOption('frost')
    await page.getByLabel('Ground activation', { exact: true }).selectOption('instant')
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      'Ground editor fits its viewport without horizontal overflow',
    )
    const draft = JSON.parse(await page.locator('[data-ground-draft]').innerText())
    assert.equal(draft.durationRounds, 4)
    assert.equal(draft.visualPresetId, 'frost')
    assert.equal(draft.timing, 'instant')
    assert.deepEqual(draft.entryEffectOrdinals, [0, 1])
    assert.equal(
      await page
        .locator('[aria-label="Ground animation preview"] [data-ground-area-preset="frost"]')
        .count(),
      1,
    )
    await page.screenshot({
      path: resolve(output, `master-${viewport.width}-ground-editor.png`),
      fullPage: true,
    })
    await page.getByLabel('Persistent ground effect', { exact: true }).uncheck()
    assert.equal(await page.getByLabel('Ground duration (rounds)', { exact: true }).count(), 0)
    await page.getByLabel('Persistent ground effect', { exact: true }).check()
    assert.equal(
      JSON.parse(await page.locator('[data-ground-draft]').innerText()).durationRounds,
      2,
    )
    cases++
    await page.close()
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        cases,
        errors,
        scope:
          'Local production components with canonical kernel forecasts/commands; not an authenticated Production test.',
      },
      null,
      2,
    ) + '\n',
  )
  console.log(`${cases} production-component targeting cases passed. Screenshots: ${output}`)
} finally {
  await browser.close()
  await server.close()
}
