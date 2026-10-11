// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-percentage-dots-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-percentage-dots-'))
const output = process.env.AV_PERCENTAGE_DOT_EVIDENCE_DIR || resolve(fixture, 'evidence')
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
let activePage
let activeCase
try {
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      for (const dot of ['burn', 'poison', 'bleed', 'essence-burn', 'essence-bleed']) {
        for (const phase of ['active', 'pending']) {
          const page = await browser.newPage({
            viewport,
            isMobile: viewport.width < 821,
            hasTouch: viewport.width < 821,
          })
          activePage = page
          activeCase = `${mode}-${viewport.width}-${dot}-${phase}`
          page.setDefaultTimeout(10000)
          page.on('pageerror', (error) => errors.push(`${mode}/${dot}/${phase}: ${error.message}`))
          await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&dot=${dot}&phase=${phase}`)
          await page
            .getByRole('button', { name: 'Read pinned percentage definition', exact: true })
            .waitFor()
          const before = await page.evaluate(() => structuredClone(window.fixtureBattle.snapshot))
          const details = await page.evaluate(() => {
            const effect = window.dotDefinition.effects.find((row) => row.type === window.dotType)
            return {
              type: window.dotType,
              basis: window.dotCapturedDamage,
              bps: effect.damageProfile.basisPoints,
            }
          })
          assert.ok(details.basis > 0, 'The fixture must capture actual hostile HP loss')
          await page
            .getByRole('button', { name: 'Read pinned percentage definition', exact: true })
            .click()
          const report = page.getByRole('region', {
            name: 'Pinned percentage definition',
            exact: true,
          })
          const reportText = await report.innerText()
          const name = details.type[0].toUpperCase() + details.type.slice(1)
          assert.ok(reportText.includes(name))
          assert.ok(
            reportText.includes(`${details.bps / 100}%`),
            'Skill/Essence readers use the pinned percentage',
          )
          assert.match(reportText, /HP damage|damage dealt|attack damage/i)
          await report.screenshot({
            path: resolve(output, `${mode}-${viewport.width}-${dot}-${phase}-report.png`),
          })
          await page
            .getByRole('button', { name: 'Close pinned percentage definition', exact: true })
            .click()
          const effect = page.getByRole('button', { name: new RegExp(`^Explain ${name},`) }).first()
          await effect.waitFor()
          assert.equal(
            await effect.evaluate((button) =>
              button.closest('[data-effect-timing]')?.getAttribute('data-effect-timing'),
            ),
            phase,
          )
          await effect.click()
          const text = await page.locator('body').innerText()
          assert.match(text, /HP damage|damage dealt|attack damage/i)
          if (phase === 'active') {
            assert.ok(text.includes(`Captured attack damage: ${details.basis} HP.`))
            assert.ok(
              text.includes(`Next tick: ${Math.floor((details.basis * details.bps) / 10000)} HP`),
            )
          } else {
            assert.match(text, /pending|next round|round 2/i)
          }
          assert.ok(
            !text.includes('percentageDotCommandId') && !text.includes('rngSeed'),
            'Private dependency and RNG state stays out of readers',
          )
          assert.deepEqual(
            await page.evaluate(() => window.fixtureBattle.snapshot),
            before,
            'Reading reports/rails does not mutate state or RNG',
          )
          assert.equal(
            await page.evaluate(
              () => window.calls.filter((row) => /\/(commit|intents)$/.test(row.path)).length,
            ),
            0,
          )
          await page.screenshot({
            path: resolve(output, `${mode}-${viewport.width}-${dot}-${phase}-rail.png`),
          })
          cases++
          await page.close()
        }
      }
    }
  }
  // Saved percentage encounters without the trigger policy retain their old extra-tick rules.
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const width of [1366, 390]) {
      for (const dot of ['burn', 'poison']) {
        const page = await browser.newPage({
          viewport: { width, height: width === 390 ? 844 : 768 },
        })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&dot=${dot}&triggers=legacy`)
        await page
          .getByRole('button', { name: 'Read pinned percentage definition', exact: true })
          .click()
        const report = page.getByRole('region', {
          name: 'Pinned percentage definition',
          exact: true,
        })
        const text = await report.innerText()
        assert.ok(
          text.includes(
            dot === 'burn'
              ? '2 HP backlash once after each damaging command'
              : 'Every five traversed tiles',
          ),
        )
        assert.ok(!text.includes('backlash equal to 10%'))
        assert.ok(!text.includes('at most once per turn'))
        await report.screenshot({
          path: resolve(output, `${mode}-${width}-${dot}-legacy-report.png`),
        })
        cases++
        await page.close()
      }
    }
  }
  assert.equal(cases, 72)
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        cases,
        errors,
        scope:
          'Canonical committed percentage fixtures in production readers across desktop/mobile PvE/PvP/spectators; not an authenticated Production test.',
      },
      null,
      2,
    ),
  )
  console.log(
    `${cases} percentage Skill/Essence and active/pending rail cases passed. Screenshots: ${output}`,
  )
} catch (error) {
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: resolve(output, `failure-${activeCase}.png`) })
  await fs.writeFile(
    resolve(output, 'partial-results.json'),
    JSON.stringify({ cases, activeCase, errors }),
  )
  throw error
} finally {
  await browser.close()
  await server.close()
}
