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
const controlledOnly = process.env.AV_CANONICAL_CONTROLLED === '1'
let cases = 0
try {
  for (const mode of ['pve', 'pvp']) {
    if (moveOnly || controlledOnly) continue
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
          page.on('pageerror', (error) => {
            errors.push(error.message)
            console.error('Move fixture browser error:', error.message)
          })
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
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
              (unit) => unit.id === 'character:player',
            ),
            placement: window.fixtureBattle.snapshot.tactical.placements.find(
              (placement) => placement.combatantId === 'character:player',
            ),
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
          page.on('pageerror', (error) => {
            errors.push(error.message)
            console.error('Move fixture browser error:', error.message)
          })
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
            placement: window.fixtureBattle.snapshot.tactical.placements.find(
              (placement) => placement.combatantId === 'character:player',
            ),
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
  if (moveOnly) {
    for (const mode of ['pve', 'pvp']) {
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        const touch = viewport.width === 390
        const options = { viewport, ...(touch ? { isMobile: true, hasTouch: true } : {}) }
        for (const price of [23, 100]) {
          const page = await browser.newPage(options)
          page.on('pageerror', (error) => {
            errors.push(error.message)
            console.error('Move fixture browser error:', error.message)
          })
          const gesture = (locator) => (touch ? locator.tap() : locator.click())
          await page.goto(
            server.resolvedUrls.local[0] +
              `?mode=${mode}&targeting=single&canonical=move-basic-${price}`,
          )
          const step = page
            .getByRole('region', { name: 'Command Deck' })
            .getByRole('button', { name: new RegExp(`^Swift Step,.*${price} AP`) })
          await gesture(step)
          const destination = page
            .locator('#battlefield')
            .getByRole('button', { name: /^Tile 4, 3;/ })
          assert.equal(
            await destination.getAttribute('data-reachable'),
            'true',
            'the flat overall cost permits walking even at100 AP',
          )
          await page.screenshot({
            path: resolve(output, `${mode}-${viewport.width}-basic-${price}.png`),
          })
          await gesture(destination)
          await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
          const result = await page.evaluate(() => ({
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            receipts: window.receipts,
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
              (unit) => unit.id === 'character:player',
            ),
            placement: window.fixtureBattle.snapshot.tactical.placements.find(
              (placement) => placement.combatantId === 'character:player',
            ),
          }))
          assert.equal(result.calls.length, 1)
          assert.equal(
            result.calls[0].body.intent.kind,
            'action',
            'flat Basic Move uses its captured action facade',
          )
          assert.equal(result.calls[0].body.intent.actionId, 'basic.move')
          assert.equal(result.calls[0].body.intent.behaviorId, 'use')
          assert.deepEqual(result.calls[0].body.intent.target, { kind: 'self' })
          assert.deepEqual(result.calls[0].body.intent.movementPath, [
            { x: 3, y: 3 },
            { x: 3, y: 2 },
          ])
          assert.deepEqual(result.placement.position, { x: 3, y: 2 })
          assert.equal(result.actor.hp, 100)
          assert.equal(result.actor.mp, 50)
          assert.equal(
            result.receipts.filter((event) => event.event === 'combat_action_used').length,
            1,
          )
          assert.equal(
            Number(
              await page
                .getByRole('progressbar', { name: 'Action Economy remaining' })
                .getAttribute('aria-valuenow'),
            ),
            100 - price,
          )
          await page.close()
          cases++
        }
        if (!touch) {
          const page = await browser.newPage(options)
          page.on('pageerror', (error) => {
            errors.push(error.message)
            console.error('Move fixture browser error:', error.message)
          })
          await page.goto(
            server.resolvedUrls.local[0] +
              `?mode=${mode}&targeting=single&canonical=move-basic-100`,
          )
          await page
            .getByRole('region', { name: 'Command Deck' })
            .getByRole('button', { name: /^Swift Step,/ })
            .click()
          await page.keyboard.press('w')
          await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
          const intents = await page.evaluate(() =>
            window.calls
              .filter((call) => /\/(commit|intents)$/.test(call.path))
              .map((call) => call.body.intent),
          )
          assert.equal(intents.length, 1)
          assert.equal(intents[0].actionId, 'basic.move')
          assert.deepEqual(intents[0].movementPath, [
            { x: 3, y: 3 },
            { x: 3, y: 2 },
          ])
          await page.close()
          cases++
          const line = await browser.newPage(options)
          line.on('pageerror', (error) => {
            errors.push(error.message)
            console.error('Move fixture browser error:', error.message)
          })
          await line.goto(
            server.resolvedUrls.local[0] +
              `?mode=${mode}&targeting=single&canonical=move-basic-line`,
          )
          await line
            .getByRole('region', { name: 'Command Deck' })
            .getByRole('button', { name: /^Swift Step,/ })
            .click()
          await line
            .locator('#battlefield')
            .getByRole('button', { name: /^Tile 4, 3;/ })
            .click()
          assert.equal(
            await line.evaluate(
              () => window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length,
            ),
            0,
            'Line Basic Move retains directional choice after walking',
          )
          const victim = line.locator('#battlefield').getByRole('button', { name: /^Tile 5, 3;/ })
          await victim.hover()
          await line.waitForFunction(() =>
            document
              .querySelector('#battlefield button[aria-label^="Tile 5, 3;"]')
              ?.hasAttribute('data-affected'),
          )
          assert.equal(
            await line.evaluate(
              () => window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length,
            ),
            0,
            'hover is informational',
          )
          await line.screenshot({ path: resolve(output, `${mode}-basic-line-hover.png`) })
          await victim.click()
          await line.waitForFunction(() =>
            window.receipts?.some((event) => event.event === 'damage_applied'),
          )
          const result = await line.evaluate(() => ({
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
              (unit) => unit.id === 'character:player',
            ),
            placement: window.fixtureBattle.snapshot.tactical.placements.find(
              (placement) => placement.combatantId === 'character:player',
            ),
          }))
          assert.equal(result.calls.length, 1)
          assert.deepEqual(result.calls[0].body.intent.target, {
            kind: 'direction',
            direction: 'east',
          })
          assert.deepEqual(result.calls[0].body.intent.movementPath, [
            { x: 3, y: 3 },
            { x: 3, y: 2 },
          ])
          assert.deepEqual(result.placement.position, { x: 3, y: 2 })
          assert.equal(result.actor.hp, 100)
          assert.equal(result.actor.mp, 50)
          assert.equal(
            Number(
              await line
                .getByRole('progressbar', { name: 'Action Economy remaining' })
                .getAttribute('aria-valuenow'),
            ),
            77,
          )
          await line.close()
          cases++
        }
      }
    }
  }
  if (controlledOnly) {
    for (const mode of ['pve', 'pvp'])
      for (const viewport of [
        { width: 1366, height: 768 },
        { width: 390, height: 844 },
      ]) {
        const touch = viewport.width === 390
        for (const scenario of [
          'controlled-self',
          'controlled-price',
          'controlled-poor',
          'controlled-choices',
          'controlled-move',
          'controlled-basic',
        ]) {
          const page = await browser.newPage({
            viewport,
            ...(touch ? { isMobile: true, hasTouch: true } : {}),
          })
          page.on('pageerror', (error) => errors.push(error.message))
          const gesture = (locator) => (touch ? locator.tap() : locator.click())
          await page.goto(
            server.resolvedUrls.local[0] + `?mode=${mode}&targeting=single&canonical=${scenario}`,
          )
          const command =
            scenario === 'controlled-basic'
              ? page.locator('[data-command-slot="guard"]')
              : page.getByRole('button', { name: /^Selected Targeting Test,/ })
          const artwork = command.locator('[data-av-square-media]').first()
          const bounds = await artwork.boundingBox()
          const before = await page.evaluate(() =>
            structuredClone(window.fixtureBattle.snapshot.tactical.battle.combatants[0]),
          )
          const commits = () =>
            page.evaluate(() =>
              window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            )
          assert.equal(await page.locator('[data-battle-controlled-ready="true"]').count(), 0)
          await gesture(command)
          if (scenario === 'controlled-choices') {
            assert.equal((await commits()).length, 0, 'ambiguous groups cannot prime implicitly')
            await page.getByLabel('Ability action', { exact: true }).selectOption('second')
            await gesture(command)
          }
          await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
          const prime = (await commits())[0].body.intent
          assert.deepEqual(Object.keys(prime).sort(), ['actionId', 'behaviorId', 'kind'])
          assert.equal(prime.kind, 'ability-prime')
          if (scenario === 'controlled-choices') assert.equal(prime.behaviorId, 'second')
          const prepared = await page.evaluate(() => ({
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants[0],
            receipts: window.receipts,
          }))
          assert.deepEqual(prepared.actor, before, 'prime does not spend resources')
          assert.deepEqual(prepared.receipts, [])
          if (scenario === 'controlled-poor') {
            await page.waitForFunction(() =>
              window.calls.some(
                (call) => call.path.endsWith('/preview') && call.body.expectedBattleVersion === 2,
              ),
            )
            assert.equal(
              await page.locator('[data-battle-controlled-ready="true"]').count(),
              0,
              'insufficient MP never glows',
            )
            await gesture(page.getByRole('button', { name: 'Cancel prime', exact: true }))
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 3)
            assert.deepEqual(
              (await commits()).map((call) => call.body.intent.kind),
              ['ability-prime', 'ability-cancel-prime'],
            )
            assert.deepEqual(
              await page.evaluate(
                () => window.fixtureBattle.snapshot.tactical.battle.combatants[0],
              ),
              before,
            )
            assert.equal(await page.locator('[data-battle-controlled-ready="true"]').count(), 0)
          } else {
            if (scenario === 'controlled-move') {
              assert.equal(
                await page.locator('[data-battle-controlled-ready="true"]').count(),
                0,
                'an incomplete Move intent is not ready',
              )
              await gesture(command)
              await gesture(
                page.locator('#battlefield').getByRole('button', { name: /^Tile 4, 3;/ }),
              )
            }
            await page
              .locator('[data-battle-controlled-ready="true"]')
              .waitFor({ state: 'visible' })
            const readyBounds = await artwork.boundingBox()
            if (scenario === 'controlled-price') {
              assert.equal(
                before.temporaryResources.find((row) => row.key === 'pv1f.action-economy').current,
                12,
              )
              assert.equal(
                await command.isEnabled(),
                true,
                'captured 11 AP remains legal below old 15 AP price',
              )
              assert.match(await command.getAttribute('aria-label'), /11 AP \/ 2 MP \/ 1 HP/)
              await gesture(page.getByRole('button', { name: 'About Targeting Test', exact: true }))
              const dialog = page.getByRole('dialog')
              await dialog.waitFor({ state: 'visible' })
              assert.match(await dialog.innerText(), /11 AP \/ 2 MP \/ 1 HP/)
              assert.match(
                await dialog.innerText(),
                /Dmg \[10\]/,
                'the report uses captured effect power',
              )
              assert.doesNotMatch(
                await dialog.innerText(),
                /Slow|Dmg \[9\]/,
                'legacy envelope effects do not replace the captured group',
              )
              assert.match(await dialog.innerText(), /\[Controlled\]/)
              const tagColors = await dialog.evaluate((element) => ({
                magnitude: getComputedStyle(
                  element.querySelector('[data-compact-effect-magnitude]'),
                ).color,
                labels: [
                  ...element.querySelectorAll(
                    '[data-compact-effect-label], [data-effect-tag-label]',
                  ),
                ].map((label) => getComputedStyle(label).color),
                expanded: element.querySelectorAll('[data-effect-tag-label]').length,
              }))
              assert.ok(tagColors.expanded > 0, 'expanded effect names use the shared label reader')
              assert.equal(
                tagColors.magnitude,
                'rgb(121, 85, 28)',
                'paper magnitude retains its readable orange',
              )
              assert.ok(tagColors.labels.length > 1)
              for (const color of tagColors.labels)
                assert.equal(
                  color,
                  tagColors.magnitude,
                  'compact and expanded tag names match their value color',
                )
              await page.screenshot({
                path: resolve(output, `${mode}-${viewport.width}-effect-tag-reader.png`),
                fullPage: true,
              })
              await page.keyboard.press('Escape')
              await dialog.waitFor({ state: 'hidden' })
            }
            assert.doesNotMatch(await page.locator('body').innerText(), /NaN|Infinity/)
            assert.equal(readyBounds.width, bounds.width)
            assert.equal(readyBounds.height, bounds.height)
            await page.screenshot({
              path: resolve(output, `${mode}-${viewport.width}-${scenario}-ready.png`),
              fullPage: true,
            })
            if (scenario === 'controlled-choices') {
              await page.keyboard.press('Tab')
              await page.keyboard.press('Shift+Tab')
              assert.equal((await commits()).length, 1, 'target cycling never releases')
              await page.keyboard.press('Escape')
              assert.equal(await page.locator('[data-battle-controlled-ready="true"]').count(), 0)
              await page.evaluate(() => window.restoreCanonicalBattle())
              await page.evaluate(
                () =>
                  new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve)),
                  ),
              )
            }
            if (scenario === 'controlled-move')
              await gesture(
                page.locator('#battlefield').getByRole('button', { name: /^Tile 5, 3;/ }),
              )
            else await gesture(command)
            await page.waitForFunction(
              (version) => window.fixtureBattle.battleVersion === version,
              scenario === 'controlled-choices' ? 4 : 3,
            )
            const result = await page.evaluate(() => ({
              actor: window.fixtureBattle.snapshot.tactical.battle.combatants[0],
              receipts: window.receipts,
              snapshot: window.fixtureBattle.snapshot,
            }))
            const paid = await commits()
            assert.equal(paid.length, 2, 'one free prime and one explicit paid release')
            assert.equal(paid[1].body.intent.kind, 'action')
            assert.equal(paid[1].body.intent.behaviorId, prime.behaviorId)
            assert.equal(result.actor.mp, before.mp - 2)
            assert.equal(result.actor.hp, before.hp - 1)
            const ap = (actor) =>
              actor.temporaryResources.find((row) => row.key === 'pv1f.action-economy').current
            assert.equal(ap(result.actor), ap(before) - 11)
            assert.equal(
              result.receipts.filter((event) => event.event === 'combat_action_used').length,
              1,
            )
            assert.equal(await page.locator('[data-battle-controlled-ready="true"]').count(), 0)
            assert.doesNotMatch(
              JSON.stringify(result.snapshot),
              /abilityRuntime|capturedAbilitySources|returnAnchor|conditionTruth/,
            )
          }
          await page.close()
          cases++
        }
        if (!touch)
          for (const keyboardCase of [
            'controlled-self',
            'controlled-price',
            'controlled-move',
            'controlled-basic',
          ]) {
            const page = await browser.newPage({ viewport })
            page.on('pageerror', (error) => errors.push(error.message))
            await page.goto(
              server.resolvedUrls.local[0] +
                `?mode=${mode}&targeting=single&canonical=${keyboardCase}`,
            )
            const key = keyboardCase === 'controlled-basic' ? '3' : '4'
            await page.keyboard.press(key)
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
            if (keyboardCase === 'controlled-move') {
              await page.keyboard.press(key)
              await page.keyboard.press('w')
              await page.waitForFunction(() =>
                window.calls.some(
                  (call) =>
                    call.path.endsWith('/preview') && call.body.intent.movementPath?.length > 1,
                ),
              )
            }
            await page
              .locator('[data-battle-controlled-ready="true"]')
              .waitFor({ state: 'visible' })
            await page.keyboard.press(keyboardCase === 'controlled-move' ? 'd' : key)
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 3)
            assert.deepEqual(
              await page.evaluate(() =>
                window.calls
                  .filter((call) => /\/(commit|intents)$/.test(call.path))
                  .map((call) => call.body.intent.kind),
              ),
              ['ability-prime', 'action'],
            )
            await page.close()
            cases++
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
  console.log(
    `${cases} canonical ${controlledOnly ? 'Controlled ' : moveOnly ? 'Move ' : ''}controller cases passed`,
  )
} catch (error) {
  const failedPage = browser
    .contexts()
    .flatMap((context) => context.pages())
    .at(-1)
  if (failedPage) {
    const diagnostics = await Promise.allSettled([
      failedPage.screenshot({ path: resolve(output, 'failure.png'), timeout: 5000 }),
      failedPage.content().then((html) => fs.writeFile(resolve(output, 'failure.html'), html)),
      failedPage
        .evaluate(() => ({
          fixtureReady: Boolean(window.fixtureBattle),
          buttons: [...document.querySelectorAll('button')].map(
            (button) => button.getAttribute('aria-label') || button.textContent,
          ),
        }))
        .then((state) =>
          fs.writeFile(resolve(output, 'failure-state.json'), JSON.stringify(state, null, 2)),
        ),
    ])
    console.error(
      'Move diagnostic artifacts captured:',
      diagnostics.map((result) => result.status).join(', '),
    )
  }
  await fs.writeFile(
    resolve(output, 'failure.json'),
    JSON.stringify({ error: String(error), errors, cases }, null, 2),
  )
  throw error
} finally {
  await browser.close()
  await server.close()
}
