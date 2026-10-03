// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/ai-timeout-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'ai-timeout-'))
const output = process.env.AV_TIMEOUT_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/ai-timeout-harness.jsx'),
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
const report = []
const errors = []
try {
  for (const options of [
    {},
    { terminal: true },
    { missing: true },
    { missing: true, failFirst: true },
    { mode: 'pvp' },
    { mode: 'pvp', terminal: true },
  ]) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    page.setDefaultTimeout(10000)
    console.log('Checking timeout scenario', options)
    let documentRequests = 0
    let avatarRequests = 0
    page.on('request', (request) => {
      if (request.isNavigationRequest()) documentRequests++
      if (request.url().endsWith('/stability-avatar.gif')) avatarRequests++
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/stability-avatar.gif', (route) =>
      route.fulfill({
        contentType: 'image/gif',
        body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
      }),
    )
    await page.goto(server.resolvedUrls.local[0] + `?mode=${options.mode || 'pve'}`)
    await page
      .locator(options.mode === 'pvp' ? '[data-pvp-turn-clock]' : '[data-ai-turn-clock]')
      .waitFor()
    await page
      .locator('img[src="/stability-avatar.gif"]:visible')
      .first()
      .evaluate((image) => image.decode())
    await page.waitForFunction(() => window.currentBattleVersion === 1)
    await page.evaluate(() => {
      window.originalImages = [...document.querySelectorAll('img')]
      window.originalMain = document.querySelector('#battlefield').closest('main')
      window.originalBattlefieldBackground = getComputedStyle(
        document.querySelector('#battlefield'),
      ).background
      window.calls = []
    })
    await page.evaluate((options) => {
      if (options.failFirst) window.snapshotFailures = 1
      window.timeoutBattle(options)
    }, options)
    await page.waitForTimeout(350)
    assert.equal(
      documentRequests,
      1,
      'AI timeout must not reload the document or reset loaded artwork',
    )
    if (options.failFirst) {
      assert.equal(
        await page.evaluate(() => window.currentBattleVersion),
        1,
        'Failed snapshot recovery retains last authoritative battle',
      )
      assert.equal(await page.getByRole('heading', { name: 'Defeat', exact: true }).count(), 0)
    }
    await page.waitForFunction(() => window.currentBattleVersion === 2, {}, { timeout: 8000 })
    const result = await page.evaluate(() => ({
      version: window.currentBattleVersion,
      sameMain: window.originalMain === document.querySelector('#battlefield').closest('main'),
      sameImages: window.originalImages.every((img) => img.isConnected),
      sameBackground:
        window.originalBattlefieldBackground ===
        getComputedStyle(document.querySelector('#battlefield')).background,
      calls: window.calls,
      notice: document.querySelector('[data-battle-notice]')?.textContent,
    }))
    assert.equal(result.sameMain, true, 'Battle main remains mounted')
    assert.equal(result.sameImages, true, 'Loaded avatar and battlefield artwork remain mounted')
    assert.equal(result.version, 2)
    assert.equal(result.sameBackground, true, 'Battlefield background paint remains unchanged')
    assert.equal(avatarRequests, 1, 'Uploaded GIF is not fetched again on timeout')
    assert.equal(
      (await page
        .getByRole('meter', { name: options.terminal ? 'HP 0 / 100' : 'HP 80 / 100', exact: true })
        .count()) > 0,
      true,
      'Rendered HP reflects timeout snapshot',
    )
    assert.equal(
      result.calls.some((call) => /mastery|claim|reward/.test(call.path)),
      false,
      'Timeout must not claim rewards',
    )
    if (options.terminal) {
      await page.getByRole('heading', { name: 'Defeat', exact: true }).waitFor()
      const before = await page.evaluate(
        () => window.calls.filter((call) => call.path.endsWith('/turn-clock')).length,
      )
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await page.waitForTimeout(550)
      assert.equal(
        await page.evaluate(
          () => window.calls.filter((call) => call.path.endsWith('/turn-clock')).length,
        ),
        before,
        'Terminal timeout stops polling',
      )
    } else {
      await page.locator('[data-battle-command="move"]').first().click()
      const notice = await page.locator('[data-battle-notice]').textContent()
      await page.evaluate((mode) => {
        const event = mode === 'pvp' ? 'aurevane:pvp-battle-state' : 'aurevane:battle-state'
        const stale = structuredClone(window.fixtureBattle)
        stale.snapshot.tactical.battle.combatants[0].hp = 1
        window.dispatchEvent(new CustomEvent(event, { detail: { ...stale, battleVersion: 1 } }))
        window.dispatchEvent(new CustomEvent(event, { detail: { ...stale, battleVersion: 2 } }))
        window.dispatchEvent(
          new CustomEvent(event, {
            detail: { ...stale, battleSessionId: 'unrelated', battleVersion: 99 },
          }),
        )
      }, options.mode)
      assert.equal(
        (await page.getByRole('meter', { name: 'HP 80 / 100', exact: true }).count()) > 0,
        true,
        'Stale, repeated and foreign snapshots cannot overwrite current state',
      )
      assert.equal(
        await page.locator('[data-battle-notice]').textContent(),
        notice,
        'Stale, repeated and foreign snapshots preserve valid planning',
      )
    }
    await page.screenshot({ path: resolve(output, `timeout-${report.length}.png`) })
    report.push({ options, documentRequests, avatarRequests, ...result })
    await page.close()
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(resolve(output, 'evidence.json'), JSON.stringify({ report, errors }, null, 2))
  console.log(
    `AI timeout: ${report.length} mounted cases retain artwork, update authoritative state, and stop at terminal state. Evidence: ${output}`,
  )
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
