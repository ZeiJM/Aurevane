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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'staff-browser-'))
const output = process.env.AV_STAFF_EVIDENCE_DIR || resolve(tmpdir(), 'staff-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/staff-management-harness.jsx'),
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
const launch = { headless: true, ...(executablePath ? { executablePath } : {}) }
const evidence = []
async function exercise(page, label, desktop) {
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(server.resolvedUrls.local[0] + 'master/staff')
  const directory = page.locator('section[aria-labelledby="staff-directory-title"]')
  await page.getByRole('heading', { name: 'Role defaults', exact: true }).waitFor()
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    label + ' horizontal overflow',
  )
  if (desktop) {
    const aligned = await directory
      .locator('article')
      .evaluateAll((rows) =>
        rows
          .slice(0, 4)
          .map((row) =>
            Array.from(row.children).map((cell) => Math.round(cell.getBoundingClientRect().left)),
          ),
      )
    assert.deepEqual(aligned[0], aligned[1], 'Owner and staff columns align')
    assert.ok(
      await directory
        .locator('[class*="rows"]')
        .evaluate((element) => element.scrollHeight > element.clientHeight),
      'directory scrolls internally',
    )
  }
  await page.screenshot({ path: resolve(output, label + '-directory.png'), fullPage: true })
  const permission = page.getByRole('checkbox', { name: 'Game Content', exact: true })
  const baseline = await permission.isChecked()
  await permission.setChecked(!baseline)
  await page.getByRole('button', { name: 'Save role defaults', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Role defaults saved.' }).waitFor()
  const saved = await page.evaluate(() =>
    window.__staffRequests.findLast((value) => value.operation === 'save-role-defaults'),
  )
  assert.equal(saved.expectedRevision, baseline ? 2 : 1)
  assert.equal(saved.roles.moderator.includes('content.combat.author'), !baseline)
  await page.evaluate(() => {
    window.__staffRejectNextSave = true
  })
  await permission.setChecked(baseline)
  await page.getByRole('button', { name: 'Save role defaults', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Refresh role defaults' }).waitFor()
  assert.equal(await permission.isChecked(), baseline, 'stale response retains local edits')
  await page.getByRole('button', { name: 'Reload defaults', exact: true }).click()
  await page.waitForFunction(() => window.__staffRequests.at(-1).operation === 'read-role-defaults')
  await page.waitForFunction(
    (expected) => document.querySelector('input[aria-label="Game Content"]').checked === expected,
    !baseline,
  )
  const help = page.getByRole('button', { name: 'About Role defaults', exact: true })
  await help.click()
  await page.getByRole('dialog', { name: 'Role defaults', exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page
    .getByRole('dialog', { name: 'Role defaults', exact: true })
    .waitFor({ state: 'hidden' })
  assert.equal(
    await help.evaluate((element) => document.activeElement === element),
    true,
    'help returns keyboard focus',
  )
  await directory.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await page.getByRole('heading', { name: 'Character access', exact: true }).waitFor()
  await page.getByLabel('Character', { exact: true }).selectOption('character-0')
  await page.getByRole('checkbox', { name: 'Content Staff', exact: true }).check()
  await page.getByRole('checkbox', { name: /Confirm access change/ }).check()
  const save = page.getByRole('button', { name: 'Save character access', exact: true })
  await save.scrollIntoViewIfNeeded()
  await save.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const metrics = await save.evaluate((element) => {
    const rect = element.getBoundingClientRect(),
      hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      innerWidth,
      innerHeight,
      hit: hit === element || element.contains(hit),
      focus: element.matches(':focus-visible'),
    }
  })
  assert.ok(
    metrics.left >= -1 &&
      metrics.right <= metrics.innerWidth + 1 &&
      metrics.top >= -1 &&
      metrics.bottom <= metrics.innerHeight + 1 &&
      metrics.hit,
    label + ' save control accessible',
  )
  assert.equal(metrics.focus, true, label + ' keyboard focus visible')
  await page.screenshot({ path: resolve(output, label + '-editor.png'), fullPage: true })
  await save.click()
  await page.getByRole('heading', { name: 'Role defaults', exact: true }).waitFor()
  const assigned = await page.evaluate(() =>
    window.__staffRequests.findLast((value) => value.operation === 'set-character-access'),
  )
  assert.equal(assigned.targetCharacterId, 'character-0')
  assert.equal(assigned.expectedVersion, 4)
  assert.ok(assigned.roles.includes('content-staff'))
  assert.deepEqual(errors, [])
  evidence.push({
    label,
    browser: page.context().browser()?.version(),
    savedRevision: saved.expectedRevision + 1,
    metrics,
    errors,
    transportFixture: true,
  })
}
let browser, native
try {
  browser = await chromium.launch(launch)
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    await exercise(page, viewport.width === 1366 ? 'desktop' : 'mobile', viewport.width === 1366)
    await page.close()
  }
  await browser.close()
  browser = null
  const extension = resolve(fixture, 'extension')
  await fs.mkdir(extension)
  await fs.writeFile(
    resolve(extension, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Disposable Staff browser zoom proof',
      version: '1.0',
      permissions: ['tabs'],
      host_permissions: ['http://127.0.0.1/*'],
      background: { service_worker: 'background.js' },
    }),
  )
  await fs.writeFile(
    resolve(extension, 'background.js'),
    'chrome.runtime.onInstalled.addListener(() => {});',
  )
  native = await chromium.launchPersistentContext(resolve(fixture, 'profile'), {
    ...launch,
    viewport: null,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--window-size=1366,768',
    ],
  })
  const page = await native.newPage()
  await page.goto(server.resolvedUrls.local[0] + 'master/staff')
  let worker = native.serviceWorkers()[0]
  if (!worker)
    worker = await native.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null)
  if (!worker)
    evidence.push({
      label: 'real-200-percent',
      unavailable:
        'Chromium did not expose the extension service worker; CSS zoom was not substituted.',
    })
  else {
    const baseline = await page.evaluate(() => innerWidth)
    const factor = await worker.evaluate(async () => {
      const tab = (await chrome.tabs.query({})).find((tab) => tab.url.includes('/master/staff'))
      await chrome.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-origin' })
      await chrome.tabs.setZoom(tab.id, 2)
      return chrome.tabs.getZoom(tab.id)
    })
    assert.equal(factor, 2)
    await page.waitForFunction((width) => innerWidth < width * 0.6, baseline)
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).zoom), '1')
    await exercise(page, 'real-200-percent', false)
    evidence.at(-1).zoomReadback = factor
    evidence.at(-1).baselineWidth = baseline
  }
  await fs.writeFile(resolve(output, 'receipt.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
} finally {
  await browser?.close()
  await native?.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
