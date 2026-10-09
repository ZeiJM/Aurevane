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
const tile = (page, x, y) =>
  page
    .locator('#battlefield')
    .getByRole('button', { name: new RegExp(`^Tile ${x + 1}, ${y + 1};`) })
try {
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
  for (const mode of ['pve', 'pvp']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&elemental=fire`,
      )
      await page.locator('#battlefield').waitFor()
      await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
      await tile(page, 3, 2).click()
      await page
        .waitForFunction(() => window.calls.some((call) => /\/(commit|intents)$/.test(call.path)))
        .catch(async (error) => {
          console.log(
            JSON.stringify(
              await page.evaluate(() => ({
                calls: window.calls,
                forecasts: window.forecasts,
                notices: document.body.innerText,
              })),
              null,
              2,
            ),
          )
          throw error
        })
      await page.waitForFunction(
        () => window.fixtureBattle.battleVersion === 2 || window.commitFailure,
      )
      assert.equal(await page.evaluate(() => window.commitFailure), undefined)
      const receipt = await page.evaluate(() => ({
        calls: window.calls,
        statuses: window.fixtureBattle.snapshot.statusState.find(
          (row) => row.combatantId === 'character:player',
        ).statuses,
        overlays: window.fixtureBattle.snapshot.terrainOverlays,
      }))
      assert.equal(
        receipt.statuses.some((status) => status.statusId === 'frozen'),
        false,
        'Legal empty Fire cast cleanses caster Chilled',
      )
      assert.equal(receipt.overlays[0].kind, 'steam')
      assert.equal(receipt.overlays[0].remainingRoundBoundaries, 2)
      assert.equal(receipt.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length, 1)
      assert.deepEqual(
        receipt.calls.find((call) => /\/(commit|intents)$/.test(call.path)).body.intent.target,
        { kind: 'tile', position: { x: 3, y: 2 } },
      )
      cases++
      await page.close()
    }
  }
  for (const mode of ['pve', 'pvp']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=line&elemental=fire-area`,
      )
      await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
      await page.getByRole('button', { name: 'Ground', exact: true }).click()
      await tile(page, 5, 3).click()
      await page.waitForFunction(
        () => window.fixtureBattle.battleVersion === 2 || window.commitFailure,
      )
      const ground = await page.evaluate(() => ({
        failure: window.commitFailure,
        intent: window.calls.find((call) => /\/(commit|intents)$/.test(call.path)).body.intent,
        enemy: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
          (unit) => unit.id === 'enemy-one',
        ).hp,
      }))
      assert.equal(ground.failure, undefined)
      assert.deepEqual(ground.intent.target, { kind: 'direction', direction: 'east', ground: true })
      assert.equal(ground.enemy, 80, 'Ground Fire misses Airborne')
      await page.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=line&elemental=fire-area`,
      )
      await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
      await tile(page, 5, 3).click()
      await page.waitForFunction(
        () => window.fixtureBattle.battleVersion === 2 || window.commitFailure,
      )
      assert.equal(await page.evaluate(() => window.commitFailure), undefined)
      assert.ok(
        await page.evaluate(
          () =>
            window.fixtureBattle.snapshot.tactical.battle.combatants.find(
              (unit) => unit.id === 'enemy-one',
            ).hp < 80,
        ),
        'Enemy Fire hits Airborne',
      )
      cases++
      await page.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&elemental=chilled`,
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
      assert.notEqual(
        await page.evaluate(
          () => window.fixtureBattle.snapshot.tactical.battle.currentTurn.combatantId,
        ),
        'character:player',
      )
      cases++
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ cases, errors, evidence: output }))
} finally {
  await browser.close()
  await server.close()
}
