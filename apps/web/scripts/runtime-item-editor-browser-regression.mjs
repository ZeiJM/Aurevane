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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'runtime-item-editor-browser-'))
const output =
  process.env.AV_ITEM_EDITOR_EVIDENCE_DIR ||
  resolve(tmpdir(), 'runtime-item-editor-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/runtime-item-editor-harness.jsx'),
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
// next/image is reached by AbilityEffectEditor → SummonProfileEditor → SkillMediaEditor.
// Next replaces these public build constants; this standalone Vite fixture must do so too.
// Keep real image components and never expose a process object or server environment.
const nextImageBrowserDefines = {
  'process.env.__NEXT_IMAGE_OPTS': 'undefined',
  'process.env.NEXT_DEPLOYMENT_ID': 'undefined',
  'process.env.NEXT_SUPPORTS_IMMUTABLE_ASSETS': 'false',
}
const config = {
  define: nextImageBrowserDefines,
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
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
    { width: 412, height: 915 },
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
    const editor = page.getByRole('region', { name: 'Master Item editor', exact: true })
    await editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }).fill('21')
    await editor.getByRole('spinbutton', { name: 'Battle uses', exact: true }).fill('4')
    await editor.getByRole('textbox', { name: 'use name', exact: true }).fill('Test Draught')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    const reader = page.getByRole('region', { name: 'Saved player Item reader', exact: true })
    await expect(reader.getByRole('heading', { name: 'Test Draught', exact: true })).toBeVisible()
    await expect(reader.getByLabel('Usage limits')).toContainText('4 uses per battle')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(
      editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }),
    ).toHaveValue('21')
    await expect(editor.getByRole('spinbutton', { name: 'Battle uses', exact: true })).toHaveValue(
      '4',
    )
    await editor.getByRole('combobox', { name: 'Item class', exact: true }).selectOption('weapon')
    await expect(
      editor.getByRole('button', { name: 'Apply class and reset behaviors' }),
    ).toBeVisible()
    await editor.getByRole('button', { name: 'Apply class and reset behaviors' }).click()
    await editor.getByRole('combobox', { name: 'Hands', exact: true }).selectOption('2')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await expect(reader).toContainText('2 hands')
    await expect(
      editor.getByRole('combobox', { name: 'Attack binding', exact: true }),
    ).not.toHaveValue('')
    await editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }).fill('101')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await expect(editor.getByRole('alert')).toContainText('1–100')
    await editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }).fill('50')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    )
    assert.deepEqual(errors, [])
    await page.screenshot({
      path: resolve(output, `item-editor-${viewport.width}.png`),
      fullPage: true,
    })
    console.log(
      `Item editor ${viewport.width}: controls, bound report, serialization, explicit class reset and limits passed.`,
    )
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
