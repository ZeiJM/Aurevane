// Production battle UI with real guided services over local in-memory persistence.
// Run: pnpm --filter @aurevane/web exec node scripts/guided-items-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'guided-items-'))
const output = process.env.AV_GUIDED_ITEMS_EVIDENCE_DIR || '/tmp/guided-items-browser-evidence'
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
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
let createGuidedNativeFixture
const sessions = new Map()
function configureGuidedService(server) {
  server.middlewares.use('/__guided', async (request, response, next) => {
    const url = new URL(request.url, 'http://fixture')
    if (!['/start', '/request'].includes(url.pathname)) return next()
    try {
      const key = url.searchParams.get('run') + ':' + url.searchParams.get('loadout')
      if (!sessions.has(key))
        sessions.set(key, await createGuidedNativeFixture(url.searchParams.get('loadout')))
      const session = sessions.get(key)
      let result
      if (url.pathname === '/start') result = await session.start()
      else {
        let text = ''
        for await (const chunk of request) text += chunk
        result = await session.request(url.searchParams.get('path'), JSON.parse(text || 'null'))
      }
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result))
    } catch (error) {
      console.error(error)
      response.statusCode = 400
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ error: { message: error.message } }))
    }
  })
}
const server = await createServer({
  plugins: [{ name: 'guided-native-service', configureServer: configureGuidedService }],
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      'server-only': resolve(fixture, 'server-only.js'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/db': resolve(root, 'packages/db/src'),
      '@aurevane/realtime': resolve(root, 'packages/realtime/src/index.ts'),
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
;({ createGuidedNativeFixture } = await server.ssrLoadModule(
  resolve(web, 'e2e/fixtures/guided-training-service.ts'),
))
await server.listen()
const browser = await chromium.launch({
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
  args: ['--no-sandbox'],
  headless: true,
})
const { expect } = require('@playwright/test')
const errors = [],
  results = []
let activePage
try {
  for (const width of [1366, 390]) {
    for (const loadout of ['weapon-recovery', 'empty-mp', 'equipment-support']) {
      const page = await browser.newPage({
        viewport: { width, height: 915 },
        isMobile: width < 821,
        hasTouch: width < 821,
      })
      activePage = page
      page.setDefaultTimeout(15000)
      page.on('pageerror', (error) => {
        errors.push(error.message)
        console.error(error.stack)
      })
      await page.goto(`${server.resolvedUrls.local[0]}?mode=pve&guided=${loadout}&run=${width}`)
      await page.getByRole('button', { name: 'Close victory conditions' }).click()
      await page.locator('[data-command-slot="move"]').waitFor()
      if (loadout === 'equipment-support') {
        await expect(page.locator('[data-command-slot="guard"]')).toHaveAttribute(
          'aria-label',
          /^Tower Shield,/,
        )
        await expect(page.getByRole('button', { name: /^Practice HP Recovery/ })).toBeEnabled()
        await page.screenshot({
          path: resolve(output, `guided-equipment-support-${width}-practice.png`),
          fullPage: true,
        })
      }
      await page.locator('[data-command-slot="move"]').click()
      await page
        .locator('#battlefield')
        .getByRole('button', { name: /^Tile 4, 2;/ })
        .click()
      await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
      await page.locator('[data-command-slot="attack"]').click()
      await page
        .locator('#battlefield')
        .getByRole('button', { name: /^Tile 5, 2;/ })
        .click()
      await page.waitForFunction(() => window.fixtureBattle.battleVersion === 3)
      const recovery =
        loadout === 'weapon-recovery'
          ? page.locator('[data-command-slot="guard"]')
          : page.getByRole('button', { name: /^Practice HP Recovery/ })
      await expect(recovery).toBeVisible()
      await recovery.click()
      await page
        .locator('#battlefield')
        .getByRole('button', { name: /^Tile 4, 2;/ })
        .click()
      await page.waitForFunction(() => window.fixtureBattle.battleVersion === 4)
      const expectedProgress = { move: true, attack: true, guard: true, facing: false }
      const readProgress = () =>
        page.evaluate(
          async () => (await (await fetch('/api/battles/fixture/guided-training')).json()).progress,
        )
      assert.deepEqual(await readProgress(), expectedProgress)
      await page.reload()
      await page.getByRole('button', { name: 'Close victory conditions' }).click()
      assert.deepEqual(await readProgress(), expectedProgress)
      await expect(page.getByRole('button', { name: /^End Turn,/ })).toBeVisible()
      await page.getByRole('button', { name: /^End Turn,/ }).click()
      await page.keyboard.press('ArrowRight')
      await page.waitForFunction(
        () => window.fixtureBattle?.snapshot.tactical.battle.lifecycle === 'completed',
      )
      const progress = await page.evaluate(
        async () => (await (await fetch('/api/battles/fixture/guided-training')).json()).progress,
      )
      assert.deepEqual(progress, { move: true, attack: true, guard: true, facing: true })
      assert.ok(
        !/ownedStackId|private-native-stack|capturedAbilitySources/.test(
          await page.evaluate(() => JSON.stringify(window.fixtureBattle)),
        ),
      )
      await page.screenshot({
        path: resolve(output, `guided-${loadout}-${width}.png`),
        fullPage: true,
      })
      results.push({ loadout, width, progress })
      console.log(`PASS guided ${loadout} ${width}`)
      await page.close()
    }
    for (const timing of ['controlled', 'delayed']) {
      const page = await browser.newPage({
        viewport: { width, height: 915 },
        isMobile: width < 821,
        hasTouch: width < 821,
      })
      activePage = page
      page.setDefaultTimeout(15000)
      page.on('pageerror', (error) => {
        errors.push(error.message)
        console.error(error.stack)
      })
      await page.goto(`${server.resolvedUrls.local[0]}?mode=pve&canonical=items-global-${timing}`)
      await page.locator('[data-command-slot="items"]').click()
      await page.getByRole('button', { name: /^Information about Mender Salve, Main Hand/ }).click()
      const panel = page.locator('[data-battle-info-panel]')
      await expect(panel).toContainText(timing === 'controlled' ? 'Controlled' : 'Delayed')
      await expect(panel).toContainText('3 uses per battle')
      assert.equal(
        (
          await page.evaluate(() =>
            window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
          )
        ).length,
        0,
      )
      await page.screenshot({
        path: resolve(output, `salve-global-${timing}-${width}.png`),
        fullPage: true,
      })
      await page.keyboard.press('Escape')
      await page.evaluate(() => window.restoreCanonicalBattle())
      await page.locator('[data-command-slot="items"]').click()
      await page.getByRole('button', { name: /^Information about Mender Salve, Main Hand/ }).click()
      await expect(panel).toContainText(timing === 'controlled' ? 'Controlled' : 'Delayed')
      results.push({ timing, width, reader: 'pinned, no execution' })
      await page.close()
    }
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`PASS ${results.length} guided service/Item policy native cases; ${output}`)
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({ path: resolve(output, 'failure.png'), fullPage: true })
    console.error(
      await activePage.evaluate(() => ({
        calls: window.calls,
        battle: window.fixtureBattle,
        text: document.body.innerText,
      })),
    )
  }
  throw error
} finally {
  await browser.close()
  await server.close()
}
