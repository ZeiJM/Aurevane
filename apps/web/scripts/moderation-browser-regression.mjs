// Browser verification of real Staff components, local transport/session fixture only.
// PGlite/native SQL authority tests provide independent security evidence.
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'moderation-browser-'))
const output =
  process.env.AV_MODERATION_EVIDENCE_DIR || resolve(tmpdir(), 'moderation-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/moderation-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
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
    ].map((name) => '@/app/' + name + '.css'),
  ]
    .map((path) => `import '${path}'`)
    .join('\n'),
)
await fs.writeFile(
  resolve(fixture, 'next-link.jsx'),
  "import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}",
)
await fs.writeFile(
  resolve(fixture, 'next-mock.jsx'),
  'export const useRouter=()=>({refresh(){},push(){}})',
)
await fs.writeFile(
  resolve(fixture, 'shell.jsx'),
  "import React from 'react';export function AuthenticatedShellFrame({children}){return <main style={{height:'90vh',minHeight:0,overflow:'auto'}}>{children}</main>}",
)
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@/components/shell/authenticated-game-shell': resolve(fixture, 'shell.jsx'),
      '@': resolve(web, 'src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/link': resolve(fixture, 'next-link.jsx'),
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
const executablePath = process.env.AV_STAFF_BROWSER_EXECUTABLE
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
})
const evidence = []
try {
  for (const [label, width, height] of [
    ['desktop', 1366, 768],
    ['mobile', 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } }),
      page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(server.resolvedUrls.local[0])
    await page.getByLabel('Character name', { exact: true }).fill('Mira')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByRole('button', { name: 'Mira', exact: true }).click()
    await page.getByText('No active ban', { exact: true }).waitFor()
    await page.getByLabel('Duration', { exact: true }).fill('2')
    await page.getByLabel('Duration unit', { exact: true }).selectOption('1')
    await page.getByLabel('Reason', { exact: true }).fill('Temporary moderation test')
    await page.getByLabel('Confirm this account moderation change.').check()
    await page.getByRole('button', { name: 'Apply ban', exact: true }).click()
    await page.getByText('Ban applied', { exact: true }).waitFor()
    await page.getByLabel('Permanent ban', { exact: true }).check()
    await page.getByLabel('Reason', { exact: true }).fill('Permanent edit test')
    await page.getByLabel('Confirm this account moderation change.').check()
    await page.getByRole('button', { name: 'Save ban changes', exact: true }).click()
    await page.getByText('Permanently banned', { exact: true }).waitFor()
    await page.evaluate(() => {
      window.__rejectModeration = true
    })
    await page.getByLabel('Reason', { exact: true }).fill('Stale lift attempt')
    await page.getByLabel('Confirm this account moderation change.').check()
    await page.getByRole('button', { name: 'Lift ban', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'This ban changed.' }).waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Mira', exact: true }).isVisible(), true)
    await page.getByRole('button', { name: 'Refresh player', exact: true }).click()
    await page.getByLabel('Reason', { exact: true }).fill('Lift test')
    await page.getByLabel('Confirm this account moderation change.').check()
    await page.getByRole('button', { name: 'Lift ban', exact: true }).click()
    await page.getByText('No active ban', { exact: true }).waitFor()
    await page.getByText('Ban lifted', { exact: true }).waitFor()
    assert.equal(
      await page.getByLabel('Permanent ban', { exact: true }).isChecked(),
      false,
      'lifting resets the next ban to temporary',
    )
    assert.equal(await page.locator('ol li').count(), 3)
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      label + ' horizontal overflow',
    )
    await page.screenshot({ path: resolve(output, label + '.png'), fullPage: true })
    assert.deepEqual(errors, [])
    evidence.push({ label, browser: browser.version(), actions: 3, errors, transportFixture: true })
    await context.close()
  }
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser.close()
  await server.close()
}
