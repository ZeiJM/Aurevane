// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-support-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-support-'))
const output = process.env.AV_SUPPORT_EVIDENCE_DIR || resolve(fixture, 'evidence')
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
const errors = [],
  results = []
const actions = [
  { id: 'pilfer', name: 'Pilfer', ap: 15, mp: 0, cd: 1, x: 4, y: 3 },
  { id: 'fleetstep', name: 'Fleetstep', ap: 30, mp: 0, cd: 2, x: 3, y: 2 },
  { id: 'invocation', name: 'Invocation', ap: 45, mp: 10, cd: 4, x: 3, y: 2 },
]
try {
  for (const mode of ['pve', 'pvp', 'spectator'])
    for (const width of [1366, 390])
      for (const action of actions) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          isMobile: width < 821,
          hasTouch: width < 821,
        })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(
          `${server.resolvedUrls.local[0]}?mode=${mode}&canonical=support-${action.id}`,
        )
        await page.locator('#battlefield button').first().waitFor()
        if (mode !== 'spectator') {
          const command = page.locator('button[data-command-slot="guard"]')
          await command.waitFor()
          assert.ok((await command.getAttribute('aria-label')).startsWith(`${action.name},`))
          const icon = command.locator('img')
          assert.ok(
            (await icon.getAttribute('src')).includes(`/media/art/support/${action.id}-v01.webp`),
          )
          await icon.evaluate((img) => img.decode())
          if (width > 821) await page.keyboard.press('3')
          else await command.click()
          const tile = page
            .locator('#battlefield')
            .getByRole('button', { name: new RegExp(`^Tile ${action.x + 1}, ${action.y + 1};`) })
          await tile.click()
          await page.waitForFunction(() => window.fixtureBattle.battleVersion > 1)
          const state = await page.evaluate(() => ({
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants.find(
              (row) => row.id === 'character:player',
            ),
            placement: window.fixtureBattle.snapshot.tactical.placements.find(
              (row) => row.combatantId === 'character:player',
            ),
            summons: window.fixtureBattle.snapshot.effectState?.summons ?? [],
          }))
          assert.equal(state.calls.length, 1)
          assert.equal(state.calls[0].body.intent.actionId, `basic.${action.id}`)
          assert.equal(
            state.actor.temporaryResources.find((row) => row.key === 'pv1f.action-economy').current,
            100 - action.ap,
          )
          assert.equal(state.actor.mp, 50 - action.mp)
          await page.waitForFunction(
            (cd) =>
              document
                .querySelector('button[data-command-slot="guard"]')
                .getAttribute('aria-label')
                .includes(`Cooldown: ${cd}`),
            action.cd,
          )
          if (action.id === 'fleetstep') assert.deepEqual(state.placement.position, { x: 3, y: 2 })
          if (action.id === 'invocation') assert.equal(state.summons.length, 1)
        } else assert.equal(await page.locator('button[data-command-slot="guard"]').count(), 0)
        if (action.id === 'invocation') {
          const portrait = page
            .locator('#battlefield img[src*="/media/art/support/vesper-portrait-v01.webp"]')
            .first()
          await portrait.waitFor()
          await portrait.evaluate((img) => img.decode())
        }
        await page.screenshot({
          path: resolve(output, `${mode}-${width}-${action.id}.png`),
          fullPage: true,
        })
        results.push({ mode, width, action: action.id })
        await page.close()
      }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        cases: results.length,
        errors,
        results,
        scope:
          'Native Chromium with production battle UI and real local canonical engine; fixture transport only, no hosted mutations.',
      },
      null,
      2,
    ),
  )
  console.log(`${results.length} native Support cases passed. Evidence: ${output}`)
} finally {
  await browser.close()
  await server.close()
}
