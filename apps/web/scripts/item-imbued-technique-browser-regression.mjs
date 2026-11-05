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
const { expect } = require('@playwright/test')
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'imbued-technique-browser-'))
const output =
  process.env.AV_IMBUED_EVIDENCE_DIR || resolve(tmpdir(), 'imbued-technique-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/item-imbued-technique-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'production-styles.js'),
  "import '@aurevane/ui/styles.css';import '@/app/globals.css';import '@/app/approved-adventure.css'",
)
// next/image is reached by AbilityEffectEditor → SummonProfileEditor → SkillMediaEditor.
// Next replaces these public build constants; this standalone Vite fixture must do so too.
// Keep real image components and never expose a process object or server environment.
const nextImageBrowserDefines = {
  'process.env.__NEXT_IMAGE_OPTS': 'undefined',
  'process.env.NEXT_DEPLOYMENT_ID': 'undefined',
  'process.env.NEXT_SUPPORTS_IMMUTABLE_ASSETS': 'false',
}
await fs.writeFile(
  resolve(fixture, 'next-navigation.js'),
  "export const useRouter=()=>({refresh(){}});export const usePathname=()=>'/master';export const useSearchParams=()=>new URLSearchParams(location.search)",
)
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
const config = {
  define: nextImageBrowserDefines,
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      'next/navigation': resolve(fixture, 'next-navigation.js'),
      'server-only': resolve(fixture, 'server-only.js'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      '@baseline-cohort': resolve(
        root,
        'docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
      ),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
    rolldownOptions: { transform: { define: nextImageBrowserDefines } },
  },
}

const server = await createServer(config)
await server.listen()
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
})
try {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/_next/image?*', async (route) => {
      const url = new URL(route.request().url())
      await route.continue({
        url: new URL(url.searchParams.get('url'), server.resolvedUrls.local[0]).href,
      })
    })
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
    const section = page.getByRole('group', { name: 'Editor sections', exact: true })
    await section.getByRole('button', { name: 'Imbued Technique', exact: true }).click()
    const enable = page.getByRole('checkbox', { name: 'Enable imbued technique', exact: true })
    await expect(enable).not.toBeChecked()
    await enable.check()
    await page
      .getByRole('textbox', { name: 'Technique name', exact: true })
      .fill('Native Sunward Prayer')
    await page.getByRole('tab', { name: 'Execution Characteristics', exact: true }).click()
    await page.getByRole('spinbutton', { name: 'AP cost', exact: true }).fill('37')
    await page.getByRole('button', { name: 'Commit Now', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Save status', exact: true })).toHaveText('Saved')
    const saved = await page.evaluate(() => window.imbuedSaved)
    const original = await page.evaluate(() => window.imbuedOriginal)
    assert.equal(saved.actions.support.name, 'Native Sunward Prayer')
    assert.deepEqual(saved.actions.attack, original.actions.attack)
    assert.deepEqual(
      saved.ability.behaviors.find((group) => group.id === saved.actions.attack.behaviorId),
      original.ability.behaviors.find((group) => group.id === original.actions.attack.behaviorId),
    )
    assert.equal(saved.sortOrder, 317)
    await page.reload({ waitUntil: 'networkidle' })
    await section.getByRole('button', { name: 'Imbued Technique', exact: true }).click()
    await expect(enable).toBeChecked()
    await expect(page.getByRole('textbox', { name: 'Technique name', exact: true })).toHaveValue(
      'Native Sunward Prayer',
    )
    await page.getByRole('tab', { name: 'Execution Characteristics', exact: true }).click()
    await expect(page.getByRole('spinbutton', { name: 'AP cost', exact: true })).toHaveValue('37')
    const reader = page.getByRole('region', { name: 'Saved Item reader', exact: true })
    await expect(reader.getByRole('tab', { name: 'Item Details', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(
      reader.getByRole('heading', { name: 'Native Sunward Prayer', exact: true }),
    ).not.toBeVisible()
    await reader.getByRole('tab', { name: 'Imbued Technique', exact: true }).click()
    await expect(
      reader.getByRole('heading', { name: 'Native Sunward Prayer', exact: true }),
    ).toBeVisible()
    await expect(
      reader.getByRole('heading', { name: original.actions.attack.name, level: 4, exact: true }),
    ).not.toBeVisible()
    await expect(
      reader.getByRole('tabpanel', { name: 'Imbued Technique', exact: true }),
    ).toContainText('37 AP')
    await page.screenshot({
      path: resolve(output, `imbued-reader-${viewport.width}.png`),
      fullPage: true,
    })
    await enable.uncheck()
    await section.getByRole('button', { name: 'Item Details', exact: true }).click()
    await section.getByRole('button', { name: 'Imbued Technique', exact: true }).click()
    await enable.check()
    await expect(page.getByRole('textbox', { name: 'Technique name', exact: true })).toHaveValue(
      'Native Sunward Prayer',
    )
    await enable.uncheck()
    await page.getByRole('button', { name: 'Commit Now', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Save status', exact: true })).toHaveText('Saved')
    assert.equal(await page.evaluate(() => window.imbuedSaved.actions.support), undefined)
    await page.reload({ waitUntil: 'networkidle' })
    await section.getByRole('button', { name: 'Imbued Technique', exact: true }).click()
    await expect(enable).not.toBeChecked()
    await page.screenshot({ path: resolve(output, `imbued-${viewport.width}.png`), fullPage: true })
    await page.evaluate(() => {
      const record = JSON.parse(localStorage.getItem('native-imbued-item'))
      record.current.definition = {
        ...record.current.definition,
        itemClass: 'armor',
        equipment: { slot: 'body', hands: 1 },
        ability: null,
        actions: {},
      }
      localStorage.setItem('native-imbued-item', JSON.stringify(record))
    })
    await page.reload({ waitUntil: 'networkidle' })
    await expect(
      section.getByRole('button', { name: 'Imbued Technique', exact: true }),
    ).toHaveCount(0)
    await expect(
      section.getByRole('button', { name: 'Item Details', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
    assert.deepEqual(errors, [])
    await page.close()
    console.log(
      `PASS Imbued Technique native enable/edit/commit/reload/disable at ${viewport.width}px`,
    )
  }
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
