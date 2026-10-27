// Actual operational components and native media; HTTP/session boundaries are local fixtures.
// Disposable transport fixtures exercise actual production editors and the shared Master shell.
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'master-operations-'))
const output =
  process.env.AV_PANEL_WORLD_RULES_EVIDENCE_DIR || resolve(tmpdir(), 'panel-world-rules-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/master-operations-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
const entryPath = resolve(fixture, 'entry.jsx')
let entry = await fs.readFile(entryPath, 'utf8')
entry = entry.replace(
  'let settings = { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS }',
  `let settings = JSON.parse(sessionStorage.getItem('world-test-settings') ?? 'null') ?? { ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS }`,
)
entry = entry.replace(
  'dayLengthMinutes: change.dayLengthMinutes,',
  'dayLengthMinutes: change.dayLengthMinutes, weatherRollMinutes: change.weatherRollMinutes,',
)
entry = entry.replace(
  'return Response.json({ settings })',
  `sessionStorage.setItem('world-test-settings', JSON.stringify(settings)); return Response.json({ settings })`,
)
entry = entry.replace(
  "usedBy={{ damage: [{ contentKey: 'skill.fixture', name: 'Fixture Strike' }] }}",
  `usedBy={{ damage: Array.from({length: 120}, (_, index) => ({contentKey: 'internal.fixture.' + index, name: 'Named Skill ' + (index + 1)})) }}`,
)
await fs.writeFile(entryPath, entry)
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
const profile = await fs.mkdtemp(resolve(tmpdir(), 'panel-world-rules-browser-'))
const extension = resolve(profile, 'extension')
await fs.mkdir(extension)
await fs.writeFile(
  resolve(extension, 'manifest.json'),
  JSON.stringify({
    manifest_version: 3,
    name: 'Disposable local zoom proof',
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
const executablePath =
  process.env.AV_PANEL_WORLD_RULES_BROWSER_EXECUTABLE || '/tmp/task13-recovery-browser/chromium'
let native
let browser
const evidence = []
async function verify(page, scenario) {
  console.log('Verifying', scenario)
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const origin = server.resolvedUrls.local[0]
  await page.goto(origin + '?view=world')
  const world = page.getByRole('form', { name: 'World environment', exact: true })
  await expect(world).toBeVisible()
  await world
    .getByLabel('Automatic weather roll interval (real minutes)', { exact: true })
    .fill('15')
  await world.getByRole('combobox', { name: 'Weather selection', exact: true }).selectOption('rain')
  await world.getByLabel('Forced weather duration (minutes)', { exact: true }).fill('37')
  await world.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(world.getByRole('status')).toContainText('World environment saved')
  await expect(world).toContainText('37 min remaining')
  await expect(world).toContainText('local time')
  await expect(world).not.toContainText(/\d{4}-\d{2}-\d{2}T/)
  await page.reload()
  await expect(
    world.getByLabel('Automatic weather roll interval (real minutes)', { exact: true }),
  ).toHaveValue('15')
  await expect(world).toContainText('37 min remaining')
  await expect(
    world.getByLabel('Forced weather duration (minutes)', { exact: true }),
  ).toBeDisabled()
  await world.getByRole('button', { name: 'Save Changes', exact: true }).click()
  const settings = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('world-test-settings')),
  )
  assert.equal(settings.weatherRollMinutes, 15)
  const savedUntil = settings.weatherOverrideUntil
  await world.getByRole('button', { name: 'Save Changes', exact: true }).click()
  assert.equal(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('world-test-settings')).weatherOverrideUntil,
    ),
    savedUntil,
  )
  const worldGeometry = await world.evaluate((element) => {
    const r = element.getBoundingClientRect()
    return {
      top: r.top,
      bottom: r.bottom,
      viewportHeight: innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    }
  })
  assert.equal(worldGeometry.horizontalOverflow, false)
  if (scenario === 'desktop')
    assert.ok(
      worldGeometry.bottom <= worldGeometry.viewportHeight,
      'Desktop World controls require unnecessary page scroll',
    )
  await page.screenshot({ path: resolve(output, `${scenario}-world.png`), fullPage: true })
  console.log('World controls passed', scenario)
  await page.goto(origin + '?view=rules')
  const timing = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Effect timing', exact: true }) })
  await expect(timing).toBeVisible()
  if (scenario === 'desktop') {
    const workspace = await page
      .getByTestId('master-panel-shell')
      .locator(':scope > div')
      .evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }))
    assert.ok(
      workspace.scrollHeight <= workspace.clientHeight + 1,
      `Desktop Rules should fit its workspace: ${JSON.stringify(workspace)}`,
    )
  }
  const rulesGeometry = await timing.evaluate((form) => {
    const list = form.querySelector('table').parentElement
    const bounds = list.getBoundingClientRect()
    const elevation = document.querySelector('form[aria-label="Elevation chances"]')
    const side = elevation.getBoundingClientRect()
    const timing = form.getBoundingClientRect()
    const visibleRows = [...list.querySelectorAll('tbody tr')].filter((row) => {
      const rect = row.getBoundingClientRect()
      return rect.top >= bounds.top && rect.bottom <= bounds.bottom
    }).length
    return {
      visibleRows,
      listHeight: bounds.height,
      columns: timing.right <= side.left,
      stacked: side.top >= timing.bottom,
    }
  })
  if (scenario === 'desktop') {
    assert.equal(rulesGeometry.columns, true, 'Timing and elevation use independent columns')
    assert.ok(rulesGeometry.visibleRows >= 6, 'Timing should show at least six complete tag rows')
  } else {
    assert.equal(rulesGeometry.stacked, true, 'Narrow Rules layout stacks elevation after timing')
  }
  const usage = timing.getByRole('button', { name: '120 current definitions', exact: true })
  await usage.click()
  const dialog = page.getByRole('dialog', { name: 'Direct damage definitions', exact: true })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('listitem')).toHaveCount(120)
  await expect(dialog).not.toContainText('internal.fixture')
  const close = dialog.getByRole('button', { name: 'Close Direct damage definitions', exact: true })
  await expect(close).toBeFocused()
  await page.keyboard.press('Tab')
  assert.equal(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    true,
    'Keyboard focus must stay in the modal reader',
  )
  const scroll = await dialog.locator('ul').evaluate((element) => {
    const body = element.parentElement
    return {
      clientHeight: body.clientHeight,
      scrollHeight: body.scrollHeight,
      overflow: getComputedStyle(body).overflowY,
    }
  })
  assert.ok(
    scroll.scrollHeight > scroll.clientHeight,
    'Long definitions need their own scrolling reader',
  )
  assert.equal(scroll.overflow, 'auto')
  await page.screenshot({ path: resolve(output, `${scenario}-definitions.png`), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(usage).toBeFocused()
  await usage.click()
  await page.mouse.click(1, 1)
  await expect(dialog).toBeHidden()
  await expect(usage).toBeFocused()
  await usage.click()
  await close.click()
  await expect(dialog).toBeHidden()
  await expect(usage).toBeFocused()
  const elevation = page.getByRole('form', { name: 'Elevation chances', exact: true })
  for (const level of [1, 2, 3])
    await elevation.getByLabel(`Elevation level ${level} chance (%)`, { exact: true }).fill('100')
  await expect(elevation).not.toContainText('Total:')
  await elevation.getByRole('button', { name: 'Save Changes', exact: true }).click()
  await expect(elevation.getByRole('status')).toContainText('Elevation changes saved')
  if (scenario === 'desktop') {
    const workspace = await page
      .getByTestId('master-panel-shell')
      .locator(':scope > div')
      .evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      }))
    assert.ok(
      workspace.scrollHeight <= workspace.clientHeight + 1,
      `Saved Rules should fit with feedback: ${JSON.stringify(workspace)}`,
    )
  }
  const requests = await page.evaluate(() => window.__operationsRequests)
  const policy = requests.findLast((request) => request.path === '/api/master/combat-elevation')
    .body.policy
  assert.deepEqual(policy, {
    version: 1,
    model: 'independent-highest',
    level1BasisPoints: 10000,
    level2BasisPoints: 10000,
    level3BasisPoints: 10000,
  })
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
  )
  assert.deepEqual(errors, [])
  await page.screenshot({ path: resolve(output, `${scenario}-rules.png`), fullPage: true })
  evidence.push({
    scenario,
    worldGeometry,
    rulesGeometry,
    scroll,
    savedPolicy: policy,
    weatherCadence: 15,
    overrideMinutes: 37,
    reload: true,
    escape: true,
    backdrop: true,
    refocus: true,
    focusContainment: true,
  })
}
try {
  native = await chromium.launchPersistentContext(resolve(profile, 'profile'), {
    executablePath,
    headless: true,
    viewport: null,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--window-size=1366,768',
    ],
  })
  const page = await native.newPage()
  await verify(page, 'desktop')
  if (process.env.AV_PANEL_WORLD_RULES_DESKTOP_ONLY !== '1') {
    const baseline = await page.evaluate(() => ({
      innerWidth,
      dpr: devicePixelRatio,
      cssZoom: getComputedStyle(document.documentElement).zoom,
    }))
    if (process.env.AV_PANEL_WORLD_RULES_NATIVE_ZOOM !== '0') {
      const worker = native.serviceWorkers()[0] ?? (await native.waitForEvent('serviceworker'))
      const zoom = await worker.evaluate(async () => {
        const tab = (await chrome.tabs.query({})).find((tab) =>
          tab.url.startsWith('http://127.0.0.1'),
        )
        await chrome.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-origin' })
        await chrome.tabs.setZoom(tab.id, 2)
        return chrome.tabs.getZoom(tab.id)
      })
      assert.equal(zoom, 2)
      await expect
        .poll(() => page.evaluate(() => innerWidth))
        .toBeLessThan(baseline.innerWidth * 0.6)
      await verify(page, 'native-200-percent')
      const zoomed = await page.evaluate(() => ({
        innerWidth,
        dpr: devicePixelRatio,
        cssZoom: getComputedStyle(document.documentElement).zoom,
      }))
      assert.equal(zoomed.cssZoom, '1')
      assert.ok(
        zoomed.innerWidth > baseline.innerWidth * 0.4 &&
          zoomed.innerWidth < baseline.innerWidth * 0.6,
      )
      evidence.push({ nativeZoom: { readback: zoom, baseline, zoomed } })
    } else {
      // Half-size CSS viewport exercises responsive layout; this is not native browser zoom proof.
      await page.setViewportSize({ width: 683, height: 384 })
      await verify(page, 'effective-200-percent')
      evidence.push({
        nativeZoom: {
          executed: false,
          reason:
            'This Chromium build did not start the extension service worker; Effective-viewport layout coverage is not native zoom acceptance.',
        },
      })
    }
    browser = await chromium.launch({ executablePath, headless: true })
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
    await verify(mobile, 'mobile')
  }
  await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ browser: native.browser().version(), evidence }))
} finally {
  await browser?.close()
  await native?.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
  await fs.rm(profile, { recursive: true, force: true })
}
