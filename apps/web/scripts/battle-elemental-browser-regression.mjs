// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-elemental-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-elemental-'))
const output = process.env.AV_ELEMENTAL_EVIDENCE_DIR || resolve(fixture, 'evidence')
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
const catalogCases = []
const tile = (page, x, y) =>
  page
    .locator('#battlefield')
    .getByRole('button', { name: new RegExp(`^Tile ${x + 1}, ${y + 1};`) })
try {
  if (process.env.AV_ELEMENTAL_ONLY_CATALOG !== '1') {
    for (const mode of ['pve', 'pvp', 'spectator']) {
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        for (const reducedMotion of ['no-preference', 'reduce']) {
          const page = await browser.newPage({ viewport, reducedMotion })
          page.on('pageerror', (error) => errors.push(error.message))
          await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&elemental=steam`)
          const mist = page.locator('[data-ground-steam-mist="true"]')
          await mist.waitFor()
          assert.equal(await mist.count(), 1)
          const animation = await mist
            .locator('i')
            .first()
            .evaluate((el) => getComputedStyle(el).animationName)
          assert.equal(
            animation === 'none',
            reducedMotion === 'reduce',
            `${mode} ${viewport.width} ${reducedMotion}`,
          )
          assert.ok(
            await mist
              .locator('i')
              .first()
              .evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity) > 0),
          )
          await page.locator('#battlefield').screenshot({
            path: resolve(output, `${mode}-${viewport.width}-${reducedMotion}-steam.png`),
          })
          cases++
          await page.close()
        }
      }
    }

    for (const policy of [1, 2]) {
      for (const mode of ['pve', 'pvp']) {
        for (const viewport of [
          { width: 1366, height: 768 },
          { width: 390, height: 844 },
        ]) {
          const page = await browser.newPage({
            viewport,
            isMobile: viewport.width < 821,
            hasTouch: viewport.width < 821,
          })
          page.setDefaultTimeout(10000)
          page.on('pageerror', (error) => errors.push(`${mode}/${policy}: ${error.message}`))
          const load = async (shape, elemental = 'fire-area') => {
            await page.goto(
              server.resolvedUrls.local[0] +
                `?mode=${mode}&targeting=${shape}&elemental=${elemental}&elementalPolicy=${policy}&cycleTarget=custom`,
            )
            await page.locator('#battlefield').waitFor()
            await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
            assert.equal(
              await page.getByRole('group', { name: 'Fire target' }).count(),
              0,
              'Fire uses ordinary board selection without cockpit target buttons',
            )
            assert.equal(await page.getByRole('button', { name: 'Ground', exact: true }).count(), 0)
            assert.equal(
              await page.getByRole('button', { name: 'Enemies', exact: true }).count(),
              0,
            )
          }
          const receipt = async () => {
            await page.waitForFunction(
              () => window.fixtureBattle.battleVersion === 2 || window.commitFailure,
            )
            const result = await page.evaluate(() => ({
              failure: window.commitFailure,
              calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
              statuses: window.fixtureBattle.snapshot.statusState.find(
                (row) => row.combatantId === 'character:player',
              ).statuses,
              overlays: window.fixtureBattle.snapshot.terrainOverlays,
              enemyHp: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
                (unit) => unit.id === 'enemy-one',
              ).hp,
            }))
            assert.equal(result.failure, undefined)
            assert.equal(result.calls.length, 1)
            assert.equal(
              result.statuses.some((status) => status.statusId === 'frozen'),
              false,
              'Legal Fire cleanses caster Chilled',
            )
            return result
          }
          for (const ground of [false, true]) {
            await load('single', 'fire')
            await tile(page, ground ? 3 : 4, ground ? 2 : 3).click()
            const result = await receipt()
            assert.deepEqual(
              result.calls[0].body.intent.target,
              ground
                ? { kind: 'tile', position: { x: 3, y: 2 } }
                : { kind: 'unit', combatantId: 'enemy-one' },
            )
            if (ground) {
              assert.equal(result.overlays[0].kind, 'steam')
              assert.equal(result.overlays[0].remainingRoundBoundaries, 2)
              await page.waitForFunction(() =>
                window.calls.some(
                  (call) =>
                    call.path.endsWith('/preview') &&
                    call.body.expectedBattleVersion === 2 &&
                    call.body.intent.target.kind === 'tile',
                ),
              )
              await page.waitForFunction(
                () =>
                  !document
                    .querySelector('main[data-unified-battle]')
                    .hasAttribute('data-battle-execution-pending'),
              )
              await page.evaluate(() => {
                window.calls = []
              })
              await page.keyboard.press('n')
              await page.waitForFunction(() =>
                window.calls.some(
                  (call) =>
                    call.path.endsWith('/preview') &&
                    call.body.expectedBattleVersion === 2 &&
                    call.body.intent.target.kind === 'unit',
                ),
              )
            } else assert.ok(result.enemyHp < 80)
            cases++
          }
          for (const shape of ['line', 'circle1', 'all']) {
            for (const gesture of ['enemy', 'ground', 'arrow']) {
              await load(shape)
              const target =
                shape === 'line' ? { kind: 'direction', direction: 'east' } : { kind: 'activate' }
              const ground = gesture === 'ground' || (gesture === 'arrow' && shape === 'line')
              if (gesture === 'arrow') {
                // Existing line hover supplies ground intent to keyboard direction, without another mode.
                if (shape === 'line') {
                  await tile(page, 6, 3).hover()
                  await page.waitForFunction(() =>
                    window.calls.some(
                      (call) =>
                        call.path.endsWith('/preview') && call.body.intent.target.ground === true,
                    ),
                  )
                }
                await page.keyboard.press('ArrowRight')
              } else
                await tile(
                  page,
                  ground ? (shape === 'line' ? 6 : 3) : 4,
                  ground && shape !== 'line' ? 2 : 3,
                ).click()
              const result = await receipt()
              assert.deepEqual(
                result.calls[0].body.intent.target,
                ground ? { ...target, ground: true } : target,
              )
              if (ground) assert.equal(result.enemyHp, 80, 'Ground Fire misses Airborne')
              else assert.ok(result.enemyHp < 80, 'Enemy Fire hits Airborne')
              cases++
            }
          }
          await page.goto(
            server.resolvedUrls.local[0] +
              `?mode=${mode}&targeting=single&elemental=chilled&elementalPolicy=${policy}&cycleTarget=custom`,
          )
          await page.locator('[data-command-slot="finish"]').click()
          assert.equal(
            await page.getByRole('button', { name: 'Face east', exact: true }).isEnabled(),
            true,
          )
          for (const facing of ['north', 'south', 'west'])
            assert.equal(
              await page.getByRole('button', { name: `Face ${facing}`, exact: true }).isDisabled(),
              true,
            )
          await page.keyboard.press('ArrowUp')
          assert.equal(
            await page.evaluate(
              () =>
                window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path))
                  .length,
            ),
            0,
            'Chilled rejects changed final facing hotkey',
          )
          await page.getByRole('button', { name: 'Face east', exact: true }).click()
          await page.waitForFunction(
            () => window.fixtureBattle.battleVersion === 2 || window.commitFailure,
          )
          assert.equal(await page.evaluate(() => window.commitFailure), undefined)
          assert.equal(
            await page.evaluate(
              () =>
                window.fixtureBattle.snapshot.tactical.placements.find(
                  (row) => row.combatantId === 'character:player',
                ).facing,
            ),
            'east',
          )
          cases++
          await page.close()
        }
      }
    }
    for (const mode of ['pve', 'pvp']) {
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        const page = await browser.newPage({ viewport })
        page.setDefaultTimeout(10000)
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(
          server.resolvedUrls.local[0] +
            `?mode=${mode}&targeting=single&elemental=fire&elementalPolicy=legacy`,
        )
        await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
        await tile(page, 3, 2).click()
        assert.equal(
          await page.evaluate(
            () => window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length,
          ),
          0,
          'Historical absent policy retains enemy-only Fire selection',
        )
        await page.locator('[data-command-slot="finish"]').click()
        for (const facing of ['north', 'east', 'south', 'west'])
          assert.equal(
            await page.getByRole('button', { name: `Face ${facing}`, exact: true }).isEnabled(),
            true,
            'Historical Chilled does not lock final facing',
          )
        cases++
        await page.close()
      }
    }
  }
  // Mount the actual published Flame Burst, including its authored Ground preset and effects.
  for (const policy of [2, 1, 'legacy']) {
    for (const mode of ['pve', 'pvp']) {
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        for (const ground of [true, false]) {
          const page = await browser.newPage({
            viewport,
            isMobile: viewport.width < 821,
            hasTouch: viewport.width < 821,
          })
          page.setDefaultTimeout(10000)
          page.on('pageerror', (error) =>
            errors.push(`${mode}/catalog/${policy}: ${error.message}`),
          )
          await page.goto(
            server.resolvedUrls.local[0] +
              `?mode=${mode}&targeting=catalog-fire&elemental=fire-catalog&elementalPolicy=${policy}`,
          )
          await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
          const authored = await page.evaluate(() => ({
            id: window.targetingDefinition.id,
            target: window.targetingDefinition.target,
            groundArea: window.targetingDefinition.groundArea,
          }))
          assert.equal(authored.id, 'cinderweaver.flame-burst')
          assert.equal(authored.target.kind, 'ground-tile')
          assert.equal(authored.target.shape.kind, 'circle')
          assert.equal(authored.target.shape.radius, 1)
          assert.equal(authored.groundArea.durationRounds, 3)
          assert.equal(await page.getByRole('group', { name: 'Fire target' }).count(), 0)
          await tile(page, ground ? 3 : 4, ground ? 2 : 3).click()
          await page.waitForFunction(
            () => window.fixtureBattle.battleVersion === 2 || window.commitFailure,
          )
          const result = await page.evaluate(() => ({
            failure: window.commitFailure,
            intent: window.calls.find((call) => /\/(commit|intents)$/.test(call.path)).body.intent,
            enemyHp: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
              (unit) => unit.id === 'enemy-one',
            ).hp,
            groundAreas: window.fixtureBattle.snapshot.groundAreas ?? [],
          }))
          assert.equal(result.failure, undefined)
          assert.deepEqual(
            result.intent.target,
            policy === 2 && ground ? { kind: 'activate', ground: true } : { kind: 'activate' },
          )
          if (policy === 2 && !ground) {
            assert.ok(result.enemyHp < 80, 'Published Flame Burst Enemy intent hits Airborne')
            assert.equal(
              result.groundAreas.length,
              0,
              'Enemy intent creates no persistent Ground area',
            )
          } else {
            assert.equal(
              result.enemyHp,
              80,
              'Published Flame Burst Ground intent excludes Airborne',
            )
            assert.equal(result.groundAreas.length, 1)
            assert.equal(
              result.groundAreas[0].expiresAtRound - result.groundAreas[0].activationRound,
              3,
            )
          }
          catalogCases.push({
            policy,
            mode,
            width: viewport.width,
            selected: ground ? 'ground' : 'enemy',
            target: result.intent.target,
            enemyHp: result.enemyHp,
            groundAreas: result.groundAreas.length,
          })
          cases++
          await page.close()
        }
      }
    }
  }
  assert.deepEqual(errors, [])
  const result = { cases, errors, catalogCases, evidence: output }
  await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} finally {
  await browser.close()
  await server.close()
}
