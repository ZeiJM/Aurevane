// Actual operational components and native media; HTTP/session boundaries are local fixtures.
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
const { expect } = require('@playwright/test')
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'event-workspace-'))
const output =
  process.env.AV_EVENT_WORKSPACE_EVIDENCE_DIR || resolve(tmpdir(), 'event-workspace-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/event-workspace-harness.jsx'),
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
  resolve(fixture, 'next-mock.jsx'),
  `import React,{useSyncExternalStore} from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>};for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);dispatchEvent(new PopStateEvent('popstate'))}};const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/');export const useRouter=()=>({push:url=>history.pushState(null,'',url),refresh(){}});export const useSearchParams=()=>new URLSearchParams(location.search);`,
)
await fs.writeFile(
  resolve(fixture, 'shell.jsx'),
  `import React from 'react';export function AuthenticatedShellFrame({children}){return <main style={{height:'90vh',minHeight:0,overflow:'auto'}}>{children}</main>}`,
)
await fs.writeFile(
  resolve(fixture, 'supabase.js'),
  `export function createSupabaseBrowserClient(){throw new Error('Native fixture does not perform storage uploads')}`,
)
const config = {
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@/components/shell/authenticated-game-shell': resolve(fixture, 'shell.jsx'),
      '@/lib/supabase/client': resolve(fixture, 'supabase.js'),
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/audio': resolve(root, 'packages/audio/src/index.ts'),
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
}

const server = await createServer(config)
await server.listen()
const executablePath = process.env.AV_EVENT_WORKSPACE_BROWSER_EXECUTABLE
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
})
console.log(
  `Event browser: ${browser.version()}; executable: ${executablePath || chromium.executablePath()}`,
)
try {
  for (const viewport of [
    { width: 1366, height: 768, zoom: 1 },
    { width: 390, height: 844, zoom: 1 },
    { width: 1366, height: 768, zoom: 2 },
  ]) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width === 390 })
    const errors = []
    page.on('pageerror', (error) => {
      errors.push(String(error))
      console.error(error)
    })
    await page.goto(server.resolvedUrls.local[0])
    await page.locator('body').evaluate((body, zoom) => {
      body.style.zoom = zoom
    }, viewport.zoom)
    await page.getByRole('heading', { name: 'Events & Live Ops', exact: true }).waitFor()
    const section = page.getByRole('navigation', { name: 'Event authoring sections' })
    const choose = async (name) => {
      const button = section.getByRole('button', { name, exact: true })
      if (viewport.width === 390) await button.tap()
      else await button.click()
    }
    await page.getByLabel('Saved events').selectOption('event.stale')
    await page.getByText('Loaded draft v2.', { exact: true }).waitFor()
    await choose('Schedule')
    await page.getByLabel('Confirm publication or schedule for this audience').check()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page
      .getByText('Event definition changed. Reload before publishing.', { exact: true })
      .waitFor()
    assert.equal(
      await page.evaluate(
        () =>
          window.__eventRequests.find((r) => r.body.operation === 'publish').body
            .expectedBaseVersion,
      ),
      2,
    )
    await page.getByLabel('Saved events').selectOption('event.ready')
    await page.getByText('Loaded published v3.', { exact: true }).waitFor()
    await choose('Setup')
    await page.evaluate(() =>
      document.querySelectorAll('main').forEach((element) => {
        element.scrollTop = 0
      }),
    )
    await page.screenshot({
      path: resolve(output, `author-${viewport.width}-${viewport.zoom}.png`),
      fullPage: true,
    })
    await choose('Phases')
    await page.getByRole('button', { name: 'Add effect', exact: true }).first().click()
    await page.getByText(/Production unavailable/).waitFor()
    await choose('Schedule')
    await page.getByLabel('Confirm publication or schedule for this audience').check()
    assert.equal(
      await page.getByRole('button', { name: 'Publish', exact: true }).isDisabled(),
      true,
    )
    await page.getByLabel('Saved events').selectOption('event.ready')
    await page.getByText('Loaded published v3.', { exact: true }).waitFor()
    await choose('Preview')
    await page
      .locator('#event-controls')
      .getByRole('button', { name: 'Preview', exact: true })
      .click()
    await page.getByRole('article', { name: 'Event preview' }).waitFor()
    assert.equal(
      await page.getByText(/No run, participation, effect or reward was created/).count(),
      1,
    )
    await page.evaluate(() =>
      document.querySelectorAll('main').forEach((element) => {
        element.scrollTop = 0
      }),
    )
    await page.getByRole('article', { name: 'Event preview' }).scrollIntoViewIfNeeded()
    await page.screenshot({
      path: resolve(output, `preview-${viewport.width}-${viewport.zoom}.png`),
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Save draft', exact: true }).click()
    await page.getByText('Draft v1 saved.', { exact: true }).waitFor()
    await choose('Schedule')
    await page.getByLabel('Start', { exact: true }).fill('2026-12-01T12:00')
    await page.getByLabel('End', { exact: true }).fill('2026-12-01T16:00')
    await page.getByLabel('Confirm publication or schedule for this audience').check()
    await page
      .locator('#event-controls')
      .getByRole('button', { name: 'Schedule', exact: true })
      .click()
    await page.getByText(/Scheduled run 22222222/).waitFor()
    await page
      .getByRole('navigation', { name: 'Events workspace' })
      .getByRole('button', { name: 'Live runs' })
      .click()
    for (const action of [
      'Pause',
      'Resume',
      'Stop / resolve',
      'End run',
      'Emergency stop',
      'Archive',
    ]) {
      await page.getByLabel('Confirm the live action below').check()
      const button = page.getByRole('button', { name: action, exact: true })
      await button.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByLabel('Confirm the live action below')).not.toBeChecked()
      if (action === 'End run') {
        await expect(page.getByRole('button', { name: 'Stop / resolve', exact: true })).toHaveCount(
          0,
        )
      }
    }
    await page
      .getByRole('navigation', { name: 'Live Event workspace' })
      .getByRole('button', { name: 'Rewards', exact: true })
      .click()
    await page.getByText('reward.watch', { exact: true }).waitFor()
    const bodies = await page.evaluate(() => window.__eventRequests.map((r) => r.body))
    assert.ok(bodies.every((b) => !('reason' in b) && !('requestFingerprint' in b)))
    assert.deepEqual(
      bodies.filter((b) => b.operation === 'operate').map((b) => b.expectedStateVersion),
      [1, 2, 3, 4, 5, 6],
    )
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'horizontal page overflow',
    )
    assert.deepEqual(errors, [])
    for (const button of await page
      .getByRole('navigation', { name: 'Live Event workspace' })
      .getByRole('button')
      .all()) {
      const box = await button.boundingBox()
      assert.ok(box && box.height >= 44, 'live section controls retain touch height')
    }
    await page.evaluate(() =>
      document.querySelectorAll('main').forEach((element) => {
        element.scrollTop = 0
      }),
    )
    await page.screenshot({
      path: resolve(output, `events-${viewport.width}-${viewport.zoom}.png`),
      fullPage: true,
    })
    await page.locator('#event-rewards').scrollIntoViewIfNeeded()
    await page.screenshot({
      path: resolve(output, `rewards-${viewport.width}-${viewport.zoom}.png`),
      fullPage: true,
    })
    console.log(
      `Passed Events actual components: ${viewport.width}x${viewport.height}, CSS zoom ${viewport.zoom}; keyboard/live CAS payload, navigation-only blockers, draft base preserved, reason-free requests.`,
    )
    await page.close()
  }
} catch (error) {
  for (const context of browser.contexts())
    for (const page of context.pages())
      await page.screenshot({ path: resolve(output, `failure-${Date.now()}.png`), fullPage: true })
  throw error
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
