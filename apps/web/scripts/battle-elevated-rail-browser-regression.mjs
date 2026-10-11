// Production viewer projection and shared rail effects: height, lifetime, privacy and live exit.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-elevated-rail-browser-regression.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { createServer, build } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const { expect } = require('@playwright/test')
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-elevated-rail-'))
const output =
  process.env.AV_ELEVATED_RAIL_EVIDENCE_DIR || resolve(tmpdir(), 'battle-elevated-rail-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-elevated-rail-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'production-styles.js'),
  "import '@aurevane/ui/styles.css';import '@/app/globals.css'",
)
// The projection has no server I/O. Only its environment guard is disabled in this browser fixture.
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
const config = {
  configFile: false,
  root: fixture,
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'server-only': resolve(fixture, 'server-only.js'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: { include: ['react', 'react-dom/client'] },
}
if (process.env.AV_ELEVATED_RAIL_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log('Elevated rail production fixture compilation passed.')
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
} else {
  const server = await createServer(config)
  await server.listen()
  let browser
  const evidence = []
  try {
    browser = await chromium.launch({
      ...(process.env.AV_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
        : {}),
      args: ['--no-sandbox'],
      headless: true,
    })
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.elevatedRail))
      for (const mode of ['PvE', 'PvP', 'Spectator'])
        for (const height of [1, 2, 3]) {
          await page.evaluate(
            ({ mode, height }) => {
              window.elevatedRail.setMode(mode)
              window.elevatedRail.setHeight(height)
              window.elevatedRail.setCovert(false)
            },
            { mode, height },
          )
          await expect(page.locator('output')).toHaveAttribute(
            'data-fixture-height',
            String(height),
          )
          await expect(page.locator('output')).toHaveAttribute('data-fixture-mode', mode)
          const effects = page.getByRole('region', { name: 'Archer combat effects' })
          await expect(effects.locator('[data-effect-duration]')).toHaveCount(0)
          await expect(page.locator('[data-stat="evasion"]')).toHaveText(
            `${4 + [0, 15, 20, 25][height]}%`,
          )
          await expect(page.locator('[data-stat="physical"]')).toHaveText('24')
          await expect(page.locator('[data-stat="mystic"]')).toHaveText('17')
          for (const [name, text] of [
            ['Elevation Evasion', `Evasion +${[0, 15, 20, 25][height]}%`],
            ['Elevated Defenses', 'Physical Defense −20%; Mystic Defense −20%'],
          ]) {
            const trigger = effects.getByRole('button', {
              name: `Explain ${name}, Active · While on elevated terrain`,
              exact: true,
            })
            await trigger.focus()
            await page.keyboard.press('Enter')
            const panel = page.getByRole('dialog', { name, exact: true })
            await expect(panel).toBeVisible()
            await expect(panel).toContainText(text)
            await expect(panel).toContainText('While on elevated terrain')
            await expect(panel).toContainText('cannot be copied or cleansed')
            await expect(panel).not.toContainText(/1 turn|turn start|Until removed/)
            const box = await panel.boundingBox()
            assert.ok(
              box.x >= 0 &&
                box.y >= 0 &&
                box.x + box.width <= viewport.width + 1 &&
                box.y + box.height <= viewport.height + 1,
              `${name} popup fits ${viewport.width}`,
            )
            await page.keyboard.press('Escape')
            await expect(panel).toHaveCount(0)
          }
          await page.screenshot({
            path: resolve(output, `${mode.toLowerCase()}-height${height}-${viewport.width}.png`),
          })
          await page.evaluate(() => window.elevatedRail.setHeight(0))
          await expect(
            effects.getByRole('button', {
              name: /Explain Elevation Evasion|Explain Elevated Defenses/,
            }),
          ).toHaveCount(0)
          await expect(effects).toContainText('No combat effects')
          await expect(page.locator('[data-stat="evasion"]')).toHaveText('4%')
          await expect(page.locator('[data-stat="physical"]')).toHaveText('31')
          await expect(page.locator('[data-stat="mystic"]')).toHaveText('22')
          evidence.push({ viewport, mode, height, liveExit: 'passed', popup: 'passed' })
        }
      for (const mode of ['Self', 'PvE', 'PvP', 'Opponent', 'Spectator']) {
        await page.evaluate((mode) => {
          window.elevatedRail.setMode(mode)
          window.elevatedRail.setHeight(3)
          window.elevatedRail.setCovert(true)
        }, mode)
        const allowed = ['Self', 'PvE', 'PvP'].includes(mode)
        const evasion = page.getByRole('button', { name: /Explain Elevation Evasion,/ })
        await expect(evasion).toHaveCount(allowed ? 1 : 0)
        await expect(page.getByRole('button', { name: /Explain Elevated Defenses,/ })).toHaveCount(
          1,
        )
        await expect(page.locator('[data-stat="evasion"]')).toHaveText(allowed ? '29%' : '4%')
        assert.deepEqual(
          await page.evaluate(() =>
            window.elevatedRailProjection
              .filter((row) => row.statusId.startsWith('terrain-'))
              .map((row) => row.statusId),
          ),
          allowed ? ['terrain-evasion', 'terrain-defense'] : ['terrain-defense'],
        )
        evidence.push({ viewport, mode, covert: true, privacy: 'passed' })
      }
      assert.deepEqual(errors, [])
      await page.close()
    }
    await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
    console.log(
      `Elevated rail browser regression passed (${evidence.length} cases). Evidence: ${output}`,
    )
  } finally {
    await browser?.close()
    await server.close()
    await fs.rm(fixture, { recursive: true, force: true })
  }
}
