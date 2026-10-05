// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-command-feedback-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-command-feedback-'))
const output = process.env.AV_COMMAND_FEEDBACK_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-ally-inspection-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
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
async function verifyTabGuard(page) {
  await page.evaluate(() => {
    if (document.querySelector('[data-fixture-text-entry]')) return
    const input = document.createElement('input')
    input.dataset.fixtureTextEntry = 'true'
    input.setAttribute('aria-label', 'Fixture text entry')
    document.body.append(input)
    const next = document.createElement('input')
    next.dataset.fixtureNextEntry = 'true'
    document.body.append(next)
  })
  const map = page.locator('#battlefield button').first()
  const cardButtons = page.locator('[data-battle-combatant-card] button:visible')
  const card = (await cardButtons.count())
    ? cardButtons.first()
    : page.locator('main button:visible').first()
  const input = page.getByRole('textbox', { name: 'Fixture text entry' })
  const before = await page.evaluate(
    () => window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)).length,
  )
  for (const control of [map, card, input]) {
    await control.focus()
    for (const key of ['Tab', 'Shift+Tab']) {
      await page.keyboard.press(key)
      assert.equal(
        await control.evaluate((element) => document.activeElement === element),
        true,
        `${key} keeps focus on the current battlefield/control/text entry`,
      )
      if (control === map)
        assert.equal(
          await map.evaluate((tile) => getComputedStyle(tile).outlineStyle),
          'none',
          'Keyboard input cannot paint an unrelated rectangle on an unselected map tile',
        )
    }
  }
  await input.fill('Entry remains available')
  await page.keyboard.press('KeyW')
  assert.equal(
    await input.inputValue(),
    'Entry remains availablew',
    'Text entry remains independent of combat shortcuts',
  )
  const shortcuts = await page.evaluate(() => {
    const modified = ['ctrlKey', 'altKey', 'metaKey'].map((modifier) => {
      const event = new KeyboardEvent('keydown', {
        code: 'Tab',
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        [modifier]: true,
      })
      document.activeElement.dispatchEvent(event)
      return event.defaultPrevented
    })
    const escape = new KeyboardEvent('keydown', {
      code: 'Escape',
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    document.activeElement.dispatchEvent(escape)
    return { modified, escape: escape.defaultPrevented }
  })
  assert.deepEqual(
    shortcuts.modified,
    [false, false, false],
    'Browser modifier shortcuts pass through',
  )
  assert.equal(shortcuts.escape, false, 'Escape passes through the Tab guard')
  assert.equal(
    await page.evaluate(
      () => window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)).length,
    ),
    before,
    'Tab, Shift+Tab and typing cannot submit battle commands',
  )
}
async function verifyTabRestoredAfterUnmount(page) {
  await page.evaluate(() => window.unmountBattle())
  const first = page.getByRole('textbox', { name: 'Fixture text entry' })
  const next = page.locator('[data-fixture-next-entry]')
  await first.focus()
  await page.keyboard.press('Tab')
  assert.equal(
    await next.evaluate((element) => document.activeElement === element),
    true,
    'Tab cycles normally after leaving the mounted battle',
  )
  await page.keyboard.press('Shift+Tab')
  assert.equal(
    await first.evaluate((element) => document.activeElement === element),
    true,
    'Shift+Tab cycles normally after leaving the mounted battle',
  )
}
try {
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      for (const gesture of mode === 'spectator'
        ? ['tab-focus']
        : ['move-pointer', 'move-direction', 'attack-pointer']) {
        const captureFlames =
          mode === 'pve' && viewport.width === 1366 && gesture === 'move-pointer'
        const page = await browser.newPage({
          viewport,
          ...(captureFlames ? { recordVideo: { dir: output, size: viewport } } : {}),
          isMobile: viewport.width < 821,
          hasTouch: viewport.width < 821,
        })
        page.setDefaultTimeout(5000)
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}`)
        const root = page.locator('main')
        await root.waitFor()
        if (captureFlames) {
          // Record the actual shared emblem for visual review through a full slow glow cycle.
          await page.waitForTimeout(8000)
          await page.screenshot({
            path: resolve(output, 'smooth-versus-desktop.png'),
            fullPage: true,
          })
        }
        await verifyTabGuard(page)
        if (mode === 'spectator') {
          await verifyTabRestoredAfterUnmount(page)
          await page.close()
          console.log(
            `${mode} ${viewport.width}: Tab/Shift+Tab prevention and unmount restoration passed`,
          )
          continue
        }
        // Hold only transport boundaries. The production component owns selection, execution,
        // request startup and locks; no fake interaction controller is mounted.
        await page.evaluate(() => {
          const fixtureFetch = window.fetch
          window.commandStarts = []
          window.forecastStarts = []
          window.releaseCommand = null
          window.releaseForecast = null
          const commandHold = new Promise((resolve) => {
            window.releaseCommand = resolve
          })
          const forecastHold = new Promise((resolve) => {
            window.releaseForecast = resolve
          })
          window.fetch = async (url, options = {}) => {
            const path = String(url)
            if (/\/(commit|intents)$/.test(path)) {
              window.commandStarts.push({ path, body: JSON.parse(options.body) })
              await commandHold
            } else if (path.endsWith('/preview')) {
              window.forecastStarts.push({ path, body: JSON.parse(options.body) })
              await forecastHold
            }
            return fixtureFetch(url, options)
          }
        })
        const attack = gesture === 'attack-pointer'
        await page.locator(`[data-battle-command="${attack ? 'attack' : 'move'}"]`).click()
        await verifyTabGuard(page)
        const destination = page.getByRole('button', {
          name: attack ? /occupied by Recruit 2/ : /^Tile 4, 3;/,
        })
        const reachable = await page.locator('#battlefield [data-reachable]').count()
        if (attack) {
          await page.waitForFunction(() => window.forecastStarts.length > 0)
          assert.equal(
            await page.locator('#battlefield [data-selected]').count(),
            0,
            'Automatic aim retains forecasts without painting an inspection box',
          )
        } else {
          assert.ok(reachable > 1, 'Full movement range remains available')
        }
        await root.focus()
        await page.keyboard.press('Shift')
        await destination.focus()
        const outline = await destination.evaluate((tile) => getComputedStyle(tile).outlineStyle)
        assert.equal(outline, 'none', 'Ready commands do not paint a tile focus rectangle')
        // Register after arming has refreshed the native key listener. Recording at the end
        // of the same input event rejects timer/frame/forecast waits before fetch starts.
        await page.evaluate((directional) => {
          window.requestStartsAtGestureEnd = null
          const record = (event) => {
            if (directional && event.code !== 'KeyW') return
            window.requestStartsAtGestureEnd = window.commandStarts.length
            window.removeEventListener(directional ? 'keydown' : 'click', record)
          }
          window.addEventListener(directional ? 'keydown' : 'click', record)
        }, gesture === 'move-direction')
        if (gesture === 'move-direction') await page.keyboard.press('KeyW')
        else if (viewport.width < 821) await destination.tap()
        else await destination.click()
        assert.equal(
          await page.evaluate(() => window.requestStartsAtGestureEnd),
          1,
          'The commit fetch starts in the deliberate input event, without a client dwell',
        )
        // This happens while both the forecast and authoritative response remain held.
        await page.waitForFunction(() => window.commandStarts.length === 1)
        const starts = await page.evaluate(() => window.commandStarts)
        assert.equal(starts[0].path.endsWith(mode === 'pvp' ? '/commit' : '/intents'), true)
        assert.equal(starts[0].body.expectedBattleVersion, 1)
        assert.deepEqual(
          starts[0].body.intent,
          attack
            ? {
                kind: 'action',
                actionId: 'basic.attack.unarmed.basic',
                target: { kind: 'unit', combatantId: 'enemy-two' },
              }
            : {
                kind: 'move',
                path: [
                  { x: 3, y: 3 },
                  { x: 3, y: 2 },
                ],
              },
        )
        assert.equal(
          await page.evaluate(() => window.fixtureBattle.battleVersion),
          1,
          'The request starts without optimistic authoritative state',
        )
        assert.equal(
          await page.locator('#battlefield [data-path]').count(),
          0,
          'Submitting movement never flashes the origin or chosen route',
        )
        assert.equal(
          await page.locator('#battlefield [data-selected]').count(),
          0,
          'Executing an action never flashes an inspection box',
        )
        await root.focus()
        await page.keyboard.press('Shift')
        await destination.focus()
        assert.equal(
          await destination.evaluate((tile) => getComputedStyle(tile).outlineStyle),
          'none',
          'Pending execution hides only the redundant focus rectangle',
        )
        if (!attack)
          assert.equal(
            await page.locator('#battlefield [data-reachable]').count(),
            reachable,
            'Submitting movement preserves the full range guidance',
          )
        await destination.dispatchEvent('click')
        await page.keyboard.press(attack ? 'KeyA' : 'KeyW')
        await page.evaluate(() =>
          window.dispatchEvent(
            new KeyboardEvent('keydown', {
              code: 'KeyW',
              key: 'w',
              repeat: true,
              bubbles: true,
            }),
          ),
        )
        assert.equal(
          await page.evaluate(() => window.commandStarts.length),
          1,
          'Pointer, directional and repeated keys cannot submit during a pending command',
        )
        await page.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-${gesture}.png`),
          fullPage: true,
        })
        await page.evaluate(() => window.releaseCommand())
        await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
        await page.waitForFunction(
          () => !document.querySelector('main').hasAttribute('data-battle-execution-pending'),
        )
        await destination.focus()
        assert.equal(
          await destination.evaluate((tile) => getComputedStyle(tile).outlineStyle),
          'none',
          'The tile focus rectangle stays absent after the authoritative response settles',
        )
        await page.evaluate(() => window.releaseForecast())
        await page.locator('[data-battle-command="inspect"]').click()
        const ally = page.getByRole('button', { name: /occupied by Ally 1/ })
        await ally.click()
        assert.equal(
          await ally.getAttribute('data-selected'),
          'true',
          'Deliberate inspection retains its selection cue',
        )
        assert.equal(await page.evaluate(() => window.commandStarts.length), 1)
        await verifyTabRestoredAfterUnmount(page)
        await page.close()
        console.log(
          `${mode} ${viewport.width} ${gesture}: immediate request, quiet pending feedback, range/focus and duplicate guards passed`,
        )
      }
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
