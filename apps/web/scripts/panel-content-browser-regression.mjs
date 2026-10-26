// Actual operational components and native media; HTTP/session boundaries are local fixtures.
// AV_PANEL_CONTENT_COMPILE_ONLY=1 compiles without claiming browser execution.
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
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'panel-content-'))
const output =
  process.env.AV_PANEL_CONTENT_EVIDENCE_DIR || resolve(tmpdir(), 'panel-content-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/panel-content-harness.jsx'),
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
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
const sharp = require('sharp')
await sharp(resolve(web, 'public/media/skills/phase3/vanguard-shield-bash.webp'))
  .resize(192, 192)
  .png()
  .toFile(resolve(fixture, 'fixture-finalized.png'))
const config = {
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@/components/shell/authenticated-game-shell': resolve(fixture, 'shell.jsx'),
      '@/lib/supabase/client': resolve(fixture, 'supabase.js'),
      'server-only': resolve(fixture, 'server-only.js'),
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

if (process.env.AV_PANEL_CONTENT_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log('Actual Game Content and Players fixture compiled; browser not run.')
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
  process.exit(0)
}
const server = await createServer(config)
await server.listen()
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.AV_PANEL_CONTENT_BROWSER_EXECUTABLE || '/tmp/task13-recovery-browser/chromium',
})
const evidence = [],
  failures = []
try {
  const origin = server.resolvedUrls.local[0]
  for (const scenario of [
    { label: 'desktop', width: 1366, height: 768, cssZoom: 1, deviceScaleFactor: 1 },
    { label: 'mobile', width: 390, height: 844, cssZoom: 1, deviceScaleFactor: 1 },
    { label: 'desktop-css-200', width: 1366, height: 768, cssZoom: 2, deviceScaleFactor: 1 },
    { label: 'effective-native-200', width: 683, height: 384, cssZoom: 1, deviceScaleFactor: 2 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.deviceScaleFactor,
    })
    const page = await context.newPage(),
      errors = []
    await page.route('**/api/master/combat-content/media/*', (route) =>
      route.fulfill({ path: resolve(fixture, 'fixture-finalized.png'), contentType: 'image/png' }),
    )
    page.on('pageerror', (error) => errors.push(String(error)))
    const check = (value, message) => {
      if (!value) {
        failures.push({ scenario: scenario.label, message })
        console.error('FAIL', scenario.label, message)
      }
    }
    const timing = {}
    try {
      await page.goto(origin + '?view=content')
      await page
        .locator('body')
        .evaluate((body, zoom) => (body.style.zoom = zoom), scenario.cssZoom)
      const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
      await workspace.getByRole('button', { name: 'Commit Now', exact: true }).waitFor()
      const tabs = workspace.getByRole('group', { name: 'Editor sections', exact: true })
      assert.deepEqual(await tabs.getByRole('button').allTextContents(), [
        'Parameters',
        'Skills',
        'Resonances',
        'Text',
        'History',
        'Identity & Relations',
      ])
      assert.equal(await page.locator('[aria-label="Content previews"]').count(), 0)
      const columns = await workspace
        .getByRole('navigation', { name: 'Content records', exact: true })
        .evaluate((element) => ({
          template: getComputedStyle(element.parentElement).gridTemplateColumns,
          panes: [...element.parentElement.children].map((child) => ({
            left: child.getBoundingClientRect().left,
            width: child.getBoundingClientRect().width,
          })),
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
        }))
      if (scenario.label === 'desktop') {
        check(
          columns.template.split(' ').length === 2,
          'Desktop reserves an unused Preview grid column: ' + columns.template,
        )
        check(
          columns.panes[1].width > columns.panes[0].width * 1.8,
          'Selected editor does not receive the intended main width',
        )
        check(
          columns.scrollHeight > columns.clientHeight,
          'Content record list does not scroll internally',
        )
        check(
          await workspace.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
          'Game Content workspace grows beyond its frame',
        )
      }
      const currentImage = workspace.getByRole('img', { name: 'Current artwork', exact: true })
      await currentImage.evaluate((image) => image.decode())
      assert.ok(await currentImage.evaluate((image) => image.naturalWidth > 0))
      await tabs.getByRole('button', { name: 'Text', exact: true }).click()
      const description = workspace.getByRole('textbox', { name: 'Description', exact: true })
      await description.fill('First committed current text.')
      await page.evaluate(() => (window.__contentFixture.holdCommit = true))
      await workspace.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await page.waitForFunction(() => typeof window.__releaseContentCommit === 'function')
      assert.equal(await description.isEnabled(), true)
      await description.fill('Newer local edit while the first commit is in flight.')
      await page.evaluate(() => window.__releaseContentCommit())
      await workspace
        .getByText('Saved earlier changes; newer local edits remain unsaved.', { exact: true })
        .waitFor()
      assert.equal(
        await description.inputValue(),
        'Newer local edit while the first commit is in flight.',
      )
      assert.equal(
        await page.evaluate(
          () => window.__contentFixture.records.get('bastion').current.definition.description,
        ),
        'First committed current text.',
      )
      await workspace.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await workspace
        .getByText('Changes committed and available to the game.', { exact: true })
        .waitFor()
      const records = workspace.getByRole('navigation', { name: 'Content records', exact: true })
      await records.locator('[data-content-key="discipline.fixture.0"]').click()
      await records.locator('[data-content-key="bastion"]').click()
      await tabs.getByRole('button', { name: 'Text', exact: true }).click()
      assert.equal(
        await description.inputValue(),
        'Newer local edit while the first commit is in flight.',
      )
      await page.evaluate(() => (window.__contentFixture.failCommit = true))
      await description.fill('Local text retained after server rejection.')
      await workspace.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await workspace
        .getByRole('alert')
        .filter({ hasText: 'Fixture server rejected this commit.' })
        .waitFor()
      assert.equal(await description.inputValue(), 'Local text retained after server rejection.')
      await tabs.getByRole('button', { name: 'Identity & Relations', exact: true }).click()
      await workspace.getByRole('button', { name: 'Discard local edits', exact: true }).click()
      await tabs.getByRole('button', { name: 'History', exact: true }).click()
      const history = workspace.getByRole('region', { name: 'Content history', exact: true })
      await history.getByText('Previous settings', { exact: true }).click()
      await history.getByText('First committed current text.', { exact: true }).waitFor()
      const currentVersion = await page.evaluate(
        () => window.__contentFixture.records.get('bastion').current.contentVersion,
      )
      await history.getByRole('button', { name: 'Restore Previous', exact: true }).click()
      await workspace
        .getByText('Previous settings loaded. Review them, then Commit Now to apply.', {
          exact: true,
        })
        .waitFor()
      assert.equal(
        await page.evaluate(
          () => window.__contentFixture.records.get('bastion').current.contentVersion,
        ),
        currentVersion,
      )
      await tabs.getByRole('button', { name: 'Text', exact: true }).click()
      assert.equal(await description.inputValue(), 'First committed current text.')
      await workspace.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await workspace
        .getByText('Changes committed and available to the game.', { exact: true })
        .waitFor()
      await tabs.getByRole('button', { name: 'Skills', exact: true }).click()
      const skillId = await page.evaluate(() => window.__contentFixture.skillId)
      const skillName = await page.evaluate(
        (key) => window.__contentFixture.records.get(key).current.definition.name,
        skillId,
      )
      await workspace.getByRole('button', { name: skillName, exact: true }).click()
      await workspace.getByRole('button', { name: 'Back to Discipline', exact: true }).waitFor()
      await tabs.getByRole('button', { name: 'Text', exact: true }).click()
      await description.fill('Long authored description. '.repeat(150))
      const requestsBefore = await page.evaluate(() => window.__contentRequests.length)
      const typed =
        ' Each typed character remains immediate and local while editing this long form.'
      await description.focus()
      await description.press('End')
      const typingStart = performance.now()
      await description.pressSequentially(typed, { delay: 2 })
      timing.typingMs = performance.now() - typingStart
      timing.typedCharacters = typed.length
      assert.ok((await description.inputValue()).endsWith(typed))
      assert.equal(
        await page.evaluate(() => window.__contentRequests.length),
        requestsBefore,
        'Typing emits server requests',
      )
      const tabStart = performance.now()
      await tabs.getByRole('button', { name: 'Parameters', exact: true }).click()
      await workspace.getByRole('textbox', { name: 'Name', exact: true }).waitFor()
      timing.parameterTabMs = performance.now() - tabStart
      await workspace.getByRole('button', { name: 'Back to Discipline', exact: true }).click()
      await tabs.getByRole('button', { name: 'Resonances', exact: true }).click()
      const resonanceName = await page.evaluate(
        () =>
          window.__contentFixture.records.get(window.__contentFixture.resonanceId).current
            .definition.name,
      )
      await workspace.getByRole('button', { name: 'Edit ' + resonanceName, exact: true }).click()
      await workspace.getByRole('button', { name: 'Back to Discipline', exact: true }).click()
      await tabs.getByRole('button', { name: 'Parameters', exact: true }).click()
      await workspace
        .getByLabel('Upload content media', { exact: true })
        .setInputFiles(resolve(fixture, 'fixture-finalized.png'))
      await workspace.getByLabel('Actual crop preview', { exact: true }).waitFor()
      await page.evaluate(() => (window.__contentFixture.failMedia = true))
      await workspace.getByRole('button', { name: 'Upload file', exact: true }).click()
      await workspace.getByRole('alert').filter({ hasText: 'Fixture media rejection' }).waitFor()
      assert.equal(
        await workspace.getByRole('button', { name: 'Upload file', exact: true }).isEnabled(),
        true,
      )
      await workspace.getByRole('button', { name: 'Upload file', exact: true }).click()
      const replacement = workspace.getByRole('img', {
        name: 'Finalized artwork crop',
        exact: true,
      })
      await replacement.evaluate((image) => image.decode())
      assert.ok(await replacement.evaluate((image) => image.naturalWidth > 0))
      assert.equal(await currentImage.count(), 0)
      await workspace.getByRole('button', { name: 'Remove uploaded artwork', exact: true }).click()
      await currentImage.evaluate((image) => image.decode())
      check(
        !(await records.locator('[data-content-key="bastion"]').textContent()).includes(
          'local edits',
        ),
        'Reverting media leaves a stale local-edits marker while the content is Current',
      )
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'Content horizontal overflow',
      )
      assert.deepEqual(errors, [])
      await page.evaluate(() => {
        for (const element of document.querySelectorAll('*'))
          if (element.scrollTop) element.scrollTop = 0
        window.scrollTo(0, 0)
      })
      await page.screenshot({
        path: resolve(output, 'content-' + scenario.label + '.png'),
        fullPage: true,
      })
      evidence.push({
        scenario: scenario.label,
        view: 'content',
        columns,
        timing,
        commitInFlight: true,
        reopenCurrent: true,
        serverErrorRetained: true,
        previousBeforeRestore: true,
        relatedNavigation: true,
        currentAndReplacementImage: true,
        mediaFailureRetained: true,
      })
    } catch (error) {
      failures.push({ scenario: scenario.label, view: 'content', message: String(error) })
      console.error('CONTENT FAILURE', scenario.label, String(error))
      await page.screenshot({
        path: resolve(output, 'content-failure-' + scenario.label + '.png'),
        fullPage: true,
      })
    }
    try {
      await page.goto(origin + '?view=players')
      await page
        .locator('body')
        .evaluate((body, zoom) => (body.style.zoom = zoom), scenario.cssZoom)
      await page.getByRole('textbox', { name: 'Character name', exact: true }).fill('Reader')
      await page.getByRole('button', { name: 'Find players', exact: true }).click()
      await page.getByRole('button', { name: 'Inspect Reader Target', exact: true }).click()
      const refresh = page.getByRole('button', { name: 'Refresh player', exact: true })
      await refresh.waitFor()
      const playerWorkspace = refresh.locator('xpath=ancestor::section[1]/..')
      const geometry = await playerWorkspace.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        width: element.getBoundingClientRect().width,
        children: [...element.children]
          .filter((child) => child.tagName === 'SECTION')
          .map((child) => ({
            width: child.getBoundingClientRect().width,
            height: child.getBoundingClientRect().height,
            scrollHeight: child.scrollHeight,
            clientHeight: child.clientHeight,
          })),
        results: (() => {
          const list = element.querySelector('ul')
          return { scrollHeight: list.scrollHeight, clientHeight: list.clientHeight }
        })(),
      }))
      if (scenario.label === 'desktop') {
        check(
          geometry.scrollHeight <= geometry.clientHeight + 1,
          'Players workspace grows beyond fixed main frame',
        )
        check(
          geometry.children[0].width < geometry.width * 0.45,
          'Player search consumes the selected main editor width',
        )
        check(
          geometry.results.scrollHeight > geometry.results.clientHeight,
          'Player search results do not scroll internally',
        )
        check(
          geometry.children[1].scrollHeight > geometry.children[1].clientHeight,
          'Selected player editor does not scroll internally',
        )
      }
      await page.getByLabel('Total XP', { exact: true }).fill('125')
      await page.getByRole('button', { name: 'Review correction', exact: true }).click()
      await page.getByRole('heading', { name: 'Review correction', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Cancel review', exact: true }).click()
      check(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        'Players horizontal overflow',
      )
      assert.deepEqual(errors, [])
      await page.evaluate(() => {
        for (const element of document.querySelectorAll('*'))
          if (element.scrollTop) element.scrollTop = 0
        window.scrollTo(0, 0)
      })
      await page.screenshot({
        path: resolve(output, 'players-' + scenario.label + '.png'),
        fullPage: true,
      })
      evidence.push({
        scenario: scenario.label,
        view: 'players',
        geometry,
        searchAndSelectedReview: true,
      })
    } catch (error) {
      failures.push({ scenario: scenario.label, view: 'players', message: String(error) })
      console.error('PLAYERS FAILURE', scenario.label, String(error))
      await page.screenshot({
        path: resolve(output, 'players-failure-' + scenario.label + '.png'),
        fullPage: true,
      })
    }
    await context.close()
  }
  await fs.writeFile(
    resolve(output, 'content-results.json'),
    JSON.stringify({ browser: browser.version(), evidence, failures }, null, 2),
  )
  console.log(JSON.stringify({ browser: browser.version(), evidence, failures }))
  assert.deepEqual(failures, [])
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
