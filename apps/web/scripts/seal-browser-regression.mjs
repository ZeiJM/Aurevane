// Actual shared React authoring/readers; no hosted data or publication.
// Run: pnpm --filter @aurevane/web exec node scripts/seal-browser-regression.mjs
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
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'seal-browser-'))
await fs.copyFile(
  resolve(web, 'e2e/fixtures/seal-authoring-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'next-link.jsx'),
  `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}`,
)
await fs.writeFile(
  resolve(fixture, 'production-styles.js'),
  "import '@aurevane/ui/styles.css';import '@/app/globals.css'",
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/link': resolve(fixture, 'next-link.jsx'),
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
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
})
const errors = []
let cases = 0
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0])
    await page.getByRole('heading', { name: 'Seal authoring' }).waitFor()
    const categories = ['Attack', 'Recovery', 'Utility']
    for (let mask = 1; mask < 8; mask++) {
      for (let i = 0; i < 3; i++)
        await page
          .getByRole('checkbox', { name: `Seal ${categories[i]}`, exact: true })
          .setChecked(Boolean(mask & (1 << i)))
      const summary = categories.filter((_, i) => mask & (1 << i)).join(', ')
      assert.ok(
        (await page.getByRole('region', { name: 'Seal report' }).innerText()).includes(
          `[${summary}]`,
        ),
      )
      assert.equal(await page.getByRole('button', { name: 'Save Seal draft' }).isEnabled(), true)
      await page.getByRole('button', { name: 'Save Seal draft' }).click()
      await page.reload()
      for (let i = 0; i < 3; i++)
        assert.equal(
          await page
            .getByRole('checkbox', { name: `Seal ${categories[i]}`, exact: true })
            .isChecked(),
          Boolean(mask & (1 << i)),
        )
      cases++
    }
    await page.getByRole('checkbox', { name: 'Seal all categories', exact: true }).uncheck()
    assert.equal(await page.getByRole('button', { name: 'Save Seal draft' }).isEnabled(), false)
    await page.getByRole('checkbox', { name: 'Seal all categories', exact: true }).check()
    await page.getByRole('spinbutton', { name: 'Effect duration (turns)', exact: true }).fill('99')
    assert.ok(
      (await page.getByRole('region', { name: 'Seal report' }).innerText()).includes('[99 Turns]'),
    )
    await page.getByRole('button', { name: 'Save Seal draft' }).click()
    assert.equal(await page.locator('[data-battle-effect-icon="seal"]').count(), 1)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log(
    JSON.stringify({
      categoryReloadCases: cases,
      viewports: 3,
      emptySelectionRejected: true,
      maximumTurns: 99,
      runtimeErrors: errors,
    }),
  )
} finally {
  await browser.close()
  await server.close()
}
