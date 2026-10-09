// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-suppress-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-suppress-'))
const output = process.env.AV_SUPPRESS_EVIDENCE_DIR || resolve(fixture, 'evidence')
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
await fs.copyFile(
  resolve(web, 'e2e/fixtures/suppress-authoring-harness.jsx'),
  resolve(fixture, 'author.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'author.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/author.jsx"></script></body></html>',
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
let chronicleCases = 0
try {
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      for (const phase of ['active', 'pending']) {
        const page = await browser.newPage({ viewport })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}&suppress=${phase}`)
        const button = page.getByRole('button', { name: /^Explain Suppress \[25\.34%\]/ }).first()
        await button.waitFor()
        assert.equal(
          await button.evaluate((element) =>
            element.closest('[data-effect-timing]').getAttribute('data-effect-timing'),
          ),
          phase,
        )
        const before = await page.evaluate(() => window.fixtureBattle.snapshot)
        await button.click()
        const text = await page.locator('body').innerText()
        assert.ok(text.includes('25.34% less outgoing direct damage'))
        assert.ok(text.includes('Never stacks'))
        assert.match(text, /2 (?:turn|full round|round boundar)/)
        if (phase === 'pending') assert.ok(text.includes('round 3'))
        assert.deepEqual(await page.evaluate(() => window.fixtureBattle.snapshot), before)
        assert.equal(
          await page.evaluate(
            () => window.calls.filter((row) => /\/(commit|intents)$/.test(row.path)).length,
          ),
          0,
        )
        await page.screenshot({ path: resolve(output, `${mode}-${viewport.width}-${phase}.png`) })
        await page.keyboard.press('Escape')
        const chronicle = page.locator('[data-battle-chronicle]')
        await chronicle.getByRole('button', { name: 'Explain Suppress', exact: true }).click()
        const explanation = page.getByRole('dialog', { name: 'Suppress', exact: true })
        const recordedPercent = phase === 'pending' ? '25.34' : '100'
        assert.ok(
          (await explanation.innerText()).includes(
            `${recordedPercent}% less outgoing direct damage`,
          ),
        )
        assert.ok(!(await explanation.innerText()).includes('Deal 25% less outgoing direct damage'))
        assert.ok(
          (await explanation.innerText()).includes(
            `Recorded duration: 2 ${phase === 'pending' ? 'rounds' : 'turns'}.`,
          ),
        )
        assert.deepEqual(await page.evaluate(() => window.fixtureBattle.snapshot), before)
        assert.equal(
          await page.evaluate(
            () => window.calls.filter((row) => /\/(commit|intents)$/.test(row.path)).length,
          ),
          0,
        )
        await page.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-${phase}-chronicle.png`),
        })
        chronicleCases++
        cases++
        await page.close()
      }
    }
  }
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0] + 'author.html')
    const percent = page.getByRole('spinbutton', { name: 'Status potency (percent)', exact: true })
    assert.equal(await percent.inputValue(), '25')
    assert.equal(await percent.getAttribute('max'), '100')
    assert.equal(await percent.getAttribute('step'), '0.01')
    assert.equal(
      await page
        .getByRole('spinbutton', { name: 'Effect duration (turns)', exact: true })
        .inputValue(),
      '2',
    )
    const report = page.getByRole('region', { name: 'Ten characteristics' })
    for (const label of [
      'Skill Type',
      'Cost',
      'Cooldown',
      'Requirements',
      'Effects',
      'Range',
      'Target',
      'Target Method',
      'Target Elevation',
      'Line of Sight',
    ])
      assert.ok((await report.innerText()).includes(label))
    assert.ok((await report.innerText()).includes('Suppress [25%] [2 Turns]'))
    for (const [value, bps, valid] of [
      ['1', 100, true],
      ['25.34', 2534, true],
      ['100', 10000, true],
      ['0', 0, false],
      ['100.01', 10001, false],
    ]) {
      await percent.fill(value)
      await page.waitForFunction(
        (expected) => window.suppressAuthoredEffect.potencyBasisPoints === expected,
        bps,
      )
      assert.equal(await page.evaluate(() => window.suppressValidation.length === 0), valid)
    }
    await percent.fill('25.34')
    await page.getByRole('spinbutton', { name: 'Effect duration (turns)', exact: true }).fill('4')
    await page.getByRole('button', { name: 'Read authored Suppress', exact: true }).click()
    const text = await page.locator('body').innerText()
    assert.ok(text.includes('25.34% less outgoing direct damage'))
    assert.ok(text.includes('Suppress [25.34%] [4 Turns]'))
    assert.ok(!text.includes('1–20'))
    await page.screenshot({ path: resolve(output, `author-${viewport.width}.png`) })
    cases++
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ cases, chronicleCases, errors, evidence: output }))
} finally {
  await browser.close()
  await server.close()
}
