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
const moveOnly = process.env.AV_CANONICAL_MOVE === '1'
let cases = 0
try {
  for (const mode of ['pve', 'pvp']) {
    if (moveOnly) continue
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const touch = viewport.width === 390
      const options = { viewport, ...(touch ? { isMobile: true, hasTouch: true } : {}) }
      const gesture = (locator) => (touch ? locator.tap() : locator.click())
      const page = await browser.newPage(options)
      page.on('pageerror', (e) => errors.push(e.message))
      await page.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=plural`,
      )
      await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
      const tile = (x, y) =>
        page
          .locator('#battlefield')
          .getByRole('button', { name: new RegExp(`^Tile ${x + 1}, ${y + 1};`) })
      await page.keyboard.press('Enter')
      assert.equal(
        await page.evaluate(
          () => window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)).length,
        ),
        0,
        'arming does not select an implicit victim',
      )
      await gesture(tile(4, 3))
      await gesture(tile(4, 3))
      assert.equal(
        await page.getByRole('button', { name: 'Use selected targets', exact: true }).isDisabled(),
        true,
        'repeated selection removes a target',
      )
      await gesture(tile(4, 3))
      assert.equal(
        await page.evaluate(
          () => window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)).length,
        ),
        0,
        'first plural gesture must draft without paying',
      )
      await gesture(tile(5, 3))
      await page.screenshot({
        path: resolve(output, `${mode}-${viewport.width}-plural-draft.png`),
      })
      await gesture(page.getByRole('button', { name: 'Use selected targets', exact: true }))
      await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
      const result = await page.evaluate(() => ({
        calls: window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)),
        receipts: window.receipts,
        actor: window.fixtureBattle.snapshot.tactical.battle.combatants[0],
      }))
      assert.equal(result.calls.length, 1)
      assert.equal(result.calls[0].body.intent.behaviorId, 'strike')
      assert.deepEqual(result.calls[0].body.intent.target, {
        kind: 'selections',
        selections: [
          { kind: 'unit', combatantId: 'enemy-one' },
          { kind: 'unit', combatantId: 'enemy-two' },
        ],
      })
      assert.deepEqual(
        result.receipts.filter((e) => e.event === 'damage_applied').map((e) => e.targetCombatantId),
        ['enemy-one', 'enemy-two'],
      )
      assert.equal(result.actor.hp, 99)
      assert.equal(result.actor.mp, 48)
      await page.close()
      cases++
      const choices = await browser.newPage(options)
      choices.on('pageerror', (e) => errors.push(e.message))
      await choices.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=choices`,
      )
      await choices.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
      await choices
        .locator('#battlefield')
        .getByRole('button', { name: /^Tile 5, 4;/ })
        .click()
      assert.equal(
        await choices.evaluate(
          () => window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)).length,
        ),
        0,
        'multiple groups never pick the first implicitly',
      )
      await choices.getByRole('combobox', { name: 'Ability action' }).selectOption('second')
      await choices.waitForFunction(() =>
        document.activeElement?.matches('[data-battle-keyboard-focus-root="true"]'),
      )
      await choices.screenshot({
        path: resolve(output, `${mode}-${viewport.width}-behavior-choice.png`),
      })
      await choices.keyboard.press('ArrowRight')
      await choices.keyboard.press('Enter')
      await choices.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
      const choice = await choices.evaluate(() =>
        window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)),
      )
      assert.equal(choice.length, 1)
      assert.equal(choice[0].body.intent.behaviorId, 'second')
      assert.deepEqual(choice[0].body.intent.target, {
        kind: 'selections',
        selections: [{ kind: 'unit', combatantId: 'enemy-one' }],
      })
      await choices.close()
      cases++
      const reconcile = await browser.newPage(options)
      reconcile.on('pageerror', (e) => errors.push(e.message))
      await reconcile.goto(
        server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=plural`,
      )
      const arm = () =>
        gesture(reconcile.getByRole('button', { name: /^Selected Targeting Test,/ }))
      const chosen = () =>
        gesture(reconcile.locator('#battlefield').getByRole('button', { name: /^Tile 5, 4;/ }))
      await arm()
      await chosen()
      await gesture(reconcile.getByRole('button', { name: 'Cancel Action', exact: true }))
      await reconcile.keyboard.press('Enter')
      assert.equal(
        await reconcile.evaluate(
          () => window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)).length,
        ),
        0,
        'cancellation cannot commit a saved draft',
      )
      await arm()
      await chosen()
      assert.equal(
        await reconcile
          .getByRole('button', { name: 'Use selected targets', exact: true })
          .isDisabled(),
        false,
      )
      await reconcile.evaluate((mode) => {
        const next = structuredClone(window.fixtureBattle)
        next.battleVersion++
        window.fixtureBattle = next
        window.dispatchEvent(
          new CustomEvent(mode === 'pvp' ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state', {
            detail: next,
          }),
        )
      }, mode)
      await reconcile.waitForFunction(
        () =>
          document.querySelector('button[aria-label="Use selected targets"]')?.disabled === true,
        undefined,
        { timeout: 5000 },
      )
      assert.equal(
        await reconcile
          .getByRole('button', { name: 'Use selected targets', exact: true })
          .isDisabled(),
        true,
        'a same-turn remote version clears the unfinished target draft',
      )
      await reconcile.keyboard.press('Enter')
      assert.equal(
        await reconcile.evaluate(
          () => window.calls.filter((c) => /\/(commit|intents)$/.test(c.path)).length,
        ),
        0,
        'no stale target command can commit',
      )
      await reconcile.close()
      cases++
    }
    // Actual CSS content zoom exercises enlarged hit targets; this is not browser-chrome zoom.
    const zoomed = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    zoomed.on('pageerror', (error) => errors.push(error.message))
    await zoomed.goto(
      server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=plural`,
    )
    await zoomed.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    await zoomed.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
    await zoomed
      .locator('#battlefield')
      .getByRole('button', { name: /^Tile 5, 4;/ })
      .click()
    const zoomConfirm = zoomed.getByRole('button', { name: 'Use selected targets', exact: true })
    assert.equal(await zoomConfirm.isEnabled(), true)
    await zoomConfirm.scrollIntoViewIfNeeded()
    await zoomed.screenshot({ path: resolve(output, `${mode}-200pct-content-zoom.png`) })
    await zoomConfirm.click()
    await zoomed.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
    const zoomResult = await zoomed.evaluate(() => ({
      calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
      receipts: window.receipts,
      actor: window.fixtureBattle.snapshot.tactical.battle.combatants[0],
    }))
    assert.equal(zoomResult.calls.length, 1)
    assert.deepEqual(zoomResult.calls[0].body.intent.target, {
      kind: 'selections',
      selections: [{ kind: 'unit', combatantId: 'enemy-one' }],
    })
    assert.deepEqual(
      zoomResult.receipts
        .filter((event) => event.event === 'damage_applied')
        .map((event) => event.targetCombatantId),
      ['enemy-one'],
    )
    assert.equal(zoomResult.actor.hp, 99)
    assert.equal(zoomResult.actor.mp, 48)
    await zoomed.close()
    cases++
  }
  if (moveOnly) {
    for (const mode of ['pve', 'pvp']) {
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        const touch = viewport.width === 390
        const options = { viewport, ...(touch ? { isMobile: true, hasTouch: true } : {}) }
        for (const scenario of ['move-paid', 'move-mixed', 'move-stationary', 'move-stale']) {
          const page = await browser.newPage(options)
          page.on('pageerror', (error) => errors.push(error.message))
          const gesture = (locator) => (touch ? locator.tap() : locator.click())
          const tile = (x, y) =>
            page
              .locator('#battlefield')
              .getByRole('button', { name: new RegExp(`^Tile ${x + 1}, ${y + 1};`) })
          const commands = () =>
            page.evaluate(() =>
              window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            )
          await page.goto(
            server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=${scenario}`,
          )
          await gesture(page.getByRole('button', { name: /^Selected Targeting Test,/ }))
          assert.equal((await commands()).length, 0, 'arming Move neither pays nor commits')
          await gesture(tile(3, scenario === 'move-stationary' ? 3 : 2))
          assert.equal(
            (await commands()).length,
            0,
            'destination choice must await the explicit follow-up recipient',
          )
          if (scenario === 'move-stale') {
            await gesture(page.getByRole('button', { name: 'Cancel Action', exact: true }))
            await page.keyboard.press('Enter')
            assert.equal((await commands()).length, 0, 'Cancel does not retain a paid route')
            await gesture(page.getByRole('button', { name: /^Selected Targeting Test,/ }))
            await gesture(tile(3, 2))
            await page.evaluate((mode) => {
              const next = structuredClone(window.fixtureBattle)
              next.battleVersion++
              window.fixtureBattle = next
              window.dispatchEvent(
                new CustomEvent(
                  mode === 'pvp' ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state',
                  { detail: next },
                ),
              )
            }, mode)
            await tile(3, 2).waitFor({ state: 'visible' })
            await page.waitForFunction(() =>
              document
                .querySelector('#battlefield button[aria-label^="Tile 4, 3;"]')
                ?.hasAttribute('data-reachable'),
            )
            await gesture(tile(4, 2))
            assert.equal(
              (await commands()).length,
              0,
              'remote version discards the old route, so an occupied destination cannot become a follow-up',
            )
            await gesture(tile(3, 2))
          }
          await page.screenshot({
            path: resolve(output, `${mode}-${viewport.width}-${scenario}-target.png`),
          })
          await gesture(tile(4, scenario === 'move-stationary' ? 3 : 2))
          await page.waitForFunction(() =>
            window.receipts?.some((event) => event.event === 'damage_applied'),
          )
          const result = await page.evaluate(() => ({
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            receipts: window.receipts,
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants[0],
            placement: window.fixtureBattle.snapshot.tactical.placements[0],
          }))
          assert.equal(result.calls.length, 1)
          assert.equal(result.calls[0].body.intent.behaviorId, 'strike')
          assert.deepEqual(result.calls[0].body.intent.target, {
            kind: 'unit',
            combatantId: 'enemy-one',
          })
          assert.deepEqual(
            result.calls[0].body.intent.movementPath,
            scenario === 'move-stationary'
              ? undefined
              : [
                  { x: 3, y: 3 },
                  { x: 3, y: 2 },
                ],
          )
          assert.deepEqual(result.placement.position, {
            x: 3,
            y: scenario === 'move-stationary' ? 3 : 2,
          })
          assert.equal(result.actor.hp, 99)
          assert.equal(result.actor.mp, 48)
          assert.equal(
            result.receipts.filter((event) => event.event === 'combat_action_used').length,
            1,
          )
          const ap = await page
            .getByRole('progressbar', { name: 'Action Economy remaining' })
            .getAttribute('aria-valuenow')
          assert.equal(
            Number(ap),
            scenario === 'move-paid' ? 0 : 89,
            'the overall authored AP price is the only payment',
          )
          await page.close()
          cases++
        }
        if (!touch) {
          const page = await browser.newPage(options)
          page.on('pageerror', (error) => errors.push(error.message))
          await page.goto(
            server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=move-paid`,
          )
          await page.getByRole('button', { name: /^Selected Targeting Test,/ }).click()
          await page.keyboard.press('w')
          assert.equal(
            await page.evaluate(
              () => window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length,
            ),
            0,
            'W chooses the Move destination before targeting',
          )
          await page.keyboard.press('d')
          await page.waitForFunction(() =>
            window.receipts?.some((event) => event.event === 'damage_applied'),
          )
          const result = await page.evaluate(() => ({
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            placement: window.fixtureBattle.snapshot.tactical.placements[0],
          }))
          assert.equal(result.calls.length, 1)
          assert.deepEqual(result.calls[0].body.intent.target, {
            kind: 'unit',
            combatantId: 'enemy-one',
          })
          assert.deepEqual(result.calls[0].body.intent.movementPath, [
            { x: 3, y: 3 },
            { x: 3, y: 2 },
          ])
          assert.deepEqual(result.placement.position, { x: 3, y: 2 })
          await page.close()
          cases++
        }
      }
    }
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        cases,
        errors,
        scope:
          'Local production PvE/PvP controls and real canonical kernel; no hosted gameplay claim.',
      },
      null,
      2,
    ),
  )
  console.log(`${cases} canonical ${moveOnly ? 'Move ' : ''}controller cases passed`)
} finally {
  await browser.close()
  await server.close()
}
