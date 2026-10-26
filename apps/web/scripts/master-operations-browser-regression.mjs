// Actual operational components and native media; HTTP/session boundaries are local fixtures.
// AV_MASTER_OPERATIONS_COMPILE_ONLY=1 compiles without claiming browser execution.
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
const worldEnvironmentOnly = process.env.AV_MASTER_WORLD_CONTROLS_ONLY === '1'
const playersReaderOnly = process.env.AV_MASTER_PLAYERS_READER_ONLY === '1'
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'master-operations-'))
const output =
  process.env.AV_MASTER_OPERATIONS_EVIDENCE_DIR || resolve(tmpdir(), 'master-operations-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/master-operations-harness.jsx'),
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

if (process.env.AV_MASTER_OPERATIONS_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log(
      'Actual Rules, World, Music and AudioProvider browser fixture compiled; browser not run.',
    )
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
  process.exit(0)
}
const server = await createServer(config)
await server.listen()
const executablePath = process.env.AV_MASTER_OPERATIONS_BROWSER_EXECUTABLE
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
})
console.log(
  `Operational browser: ${browser.version()}; executable: ${executablePath || chromium.executablePath()}`,
)
try {
  const origin = server.resolvedUrls.local[0]
  const { protectedPlayerReader } = await server.ssrLoadModule(
    resolve(web, 'e2e/master-zoom-workflows.ts'),
  )
  const playerEvidence = []
  for (const viewport of [
    { width: 1366, height: 768, zoom: 1 },
    { width: 390, height: 844, zoom: 1 },
    ...(playersReaderOnly || worldEnvironmentOnly ? [] : [{ width: 1366, height: 768, zoom: 1.5 }]),
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => {
      errors.push(String(error))
      console.error('Operational browser error:', String(error))
    })
    for (const view of playersReaderOnly
      ? ['players']
      : worldEnvironmentOnly
        ? ['world']
        : ['rules', 'world', 'music', 'players']) {
      if (view === 'world' && !worldEnvironmentOnly)
        await page.clock.install({ time: new Date('2026-10-23T00:00:00Z') })
      await page.goto(`${origin}?view=${view}`)
      await page.locator('body').evaluate((body, zoom) => {
        body.style.zoom = zoom
      }, viewport.zoom)
      await page
        .getByRole('heading', {
          name:
            view === 'players'
              ? 'Players'
              : view === 'rules'
                ? 'Combat Rules'
                : view === 'world'
                  ? 'World Environment'
                  : 'Site Music',
          exact: true,
        })
        .first()
        .waitFor()
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${view} horizontal overflow`,
      )
      assert.equal(await page.getByText(/Revision \d|Policy version|Reason for/).count(), 0)
      if (view === 'players') {
        await page.getByLabel('Character name', { exact: true }).fill('Reader Target')
        await page.getByRole('button', { name: 'Find players', exact: true }).click()
        await page.getByRole('button', { name: 'Inspect Reader Target', exact: true }).click()
        const refresh = page.getByRole('button', { name: 'Refresh player', exact: true })
        await refresh.waitFor()
        assert.equal(await refresh.count(), 1)
        // The real outer MasterPanelShell and nested PlayersWorkspace card both match.
        const broadMatches = await page.locator('section').filter({ has: refresh }).count()
        assert.equal(broadMatches, 2)
        const reader = protectedPlayerReader(page)
        const count = await reader.count()
        await page.screenshot({
          path: resolve(output, `players-nesting-${viewport.width}-${viewport.zoom}.png`),
          fullPage: true,
        })
        await fs.writeFile(
          resolve(output, `players-nesting-${viewport.width}-${viewport.zoom}.json`),
          JSON.stringify(
            {
              browser: browser.version(),
              viewport,
              broadMatches,
              readerCount: count,
              scope:
                'Actual MasterPanelShell and PlayersWorkspace, controlled HTTP/identity/shell-frame fixture; ordinary local browser, not authenticated native or genuine zoom evidence.',
            },
            null,
            2,
          ),
        )
        assert.equal(
          count,
          1,
          'Protected facts must resolve one actual card, not the outer Master shell',
        )
        assert.equal(await reader.getAttribute('data-testid'), null)
        assert.equal(
          await reader
            .locator('xpath=ancestor::section[@data-testid="master-panel-shell"]')
            .count(),
          1,
        )
        assert.equal(
          await reader.getByRole('navigation', { name: 'Master Panel navigation' }).count(),
          0,
        )
        assert.equal(
          await reader.getByRole('heading', { name: 'Find a player', exact: true }).count(),
          0,
        )
        assert.equal(
          await reader.getByRole('heading', { name: 'Reader Target', exact: true }).count(),
          1,
        )
        assert.match(await reader.innerText(), /Identity and account access are protected\./)
        assert.equal(await reader.isVisible(), true)
        const geometry = await reader.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }))
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1)
        await refresh.focus()
        await page.keyboard.press('Enter')
        await page.waitForFunction(
          () =>
            window.__operationsRequests.filter((row) => row.body.operation === 'read').length === 2,
        )
        assert.equal(await protectedPlayerReader(page).count(), 1)
        playerEvidence.push({ viewport, broadMatches, readerCount: count, geometry })
      } else if (view === 'rules') {
        await page.getByLabel('Search effect tags').fill('damage')
        await page.getByLabel('Sort effect tags').selectOption('timing-desc')
        await page.getByRole('button', { name: '1 current definitions', exact: true }).click()
        await page.getByText('Fixture Strike', { exact: false }).first().waitFor()
        await page.getByRole('dialog').press('Escape')
        const elevation = page.getByRole('form', { name: 'Elevation chances', exact: true })
        const chance = (level) =>
          elevation.getByLabel(`Elevation level ${level} chance (%)`, { exact: true })
        const save = elevation.getByRole('button', { name: 'Save Changes', exact: true })
        await chance(1).fill('0')
        await chance(2).fill('0')
        await chance(3).fill('101')
        assert.equal(await save.isDisabled(), true)
        await chance(3).fill('99')
        assert.equal(await save.isEnabled(), true)
        await chance(3).fill('100')
        await save.click()
        await elevation
          .getByRole('status')
          .filter({ hasText: 'Elevation changes saved.' })
          .waitFor()
        const request = await page.evaluate(() => window.__operationsRequests.at(-1))
        assert.equal(request.path, '/api/master/combat-elevation')
        assert.deepEqual(request.body, {
          policy: {
            version: 1,
            model: 'independent-highest',
            level1BasisPoints: 0,
            level2BasisPoints: 0,
            level3BasisPoints: 10000,
          },
        })
      } else if (view === 'world') {
        await page.getByLabel('Day length (real minutes)').fill(worldEnvironmentOnly ? '1' : '120')
        assert.equal(
          await page.getByLabel('Weather selection', { exact: true }).count(),
          0,
          'Legacy exact label includes select option text',
        )
        const weather = page.getByRole('combobox', { name: 'Weather selection', exact: true })
        assert.equal(await weather.count(), 1)
        await weather.selectOption(worldEnvironmentOnly ? 'rain' : 'storm')
        await page
          .getByLabel('Forced weather duration (minutes)')
          .fill(worldEnvironmentOnly ? '1' : '37')
        await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'saved' }).waitFor()
        const body = await page.evaluate(() => window.__operationsRequests.at(-1).body)
        assert.equal(body.change.dayLengthMinutes, worldEnvironmentOnly ? 1 : 120)
        assert.equal(body.change.durationMinutes, worldEnvironmentOnly ? 1 : 37)
        assert.equal('reason' in body, false)
        await page.getByTestId('world-environment-current').filter({ hasText: 'forced' }).waitFor()
        if (!worldEnvironmentOnly) {
          await page.clock.fastForward(37 * 60_000 + 1000)
          await page
            .getByTestId('world-environment-current')
            .filter({ hasText: 'ordinary weather' })
            .waitFor()
        }
      } else {
        await page.getByLabel('Global selection').selectOption('silent')
        await page.getByLabel('Search pages').fill('world')
        await page.getByRole('button', { name: /^World \/game\/world/ }).click()
        await page.getByRole('combobox', { name: 'Page music', exact: true }).selectOption('custom')
        await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'published' }).waitFor()
        await page.getByRole('button', { name: 'Visit World', exact: true }).click()
        const player = page.getByTestId('site-music-player')
        if (await player.evaluate((element) => element.paused))
          await page.getByRole('button', { name: 'Play music', exact: true }).click()
        await page.waitForFunction(
          () => !document.querySelector('[data-testid="site-music-player"]').paused,
        )
        const source = await player.evaluate((element) => element.currentSrc)
        assert.ok(source)
        assert.equal(await player.evaluate((element) => element.loop), true)
        await page.getByLabel('Search pages').fill('Character')
        await page.getByRole('button', { name: /^Character \/game\/character/ }).click()
        await page.getByRole('combobox', { name: 'Page music', exact: true }).selectOption('custom')
        await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
        await page.waitForFunction(
          () => document.querySelector('[data-testid="site-music-player"]').duration > 0,
        )
        const position = await player.evaluate((element) => {
          element.currentTime = Math.min(10, element.duration / 2)
          element.dataset.crossPageReloads = '0'
          element.addEventListener('emptied', () => {
            element.dataset.crossPageReloads = String(Number(element.dataset.crossPageReloads) + 1)
          })
          return element.currentTime
        })
        await page.getByRole('button', { name: 'Visit Character', exact: true }).click()
        await page.locator('[data-fixture-path]').filter({ hasText: '/game/character' }).waitFor()
        assert.equal(await player.evaluate((element) => element.dataset.crossPageReloads), '0')
        assert.equal(await player.evaluate((element) => element.currentSrc), source)
        assert.ok((await player.evaluate((element) => element.currentTime)) >= position)
        const preview = page.getByLabel('Track preview')
        await preview.evaluate((element) => element.play())
        assert.equal(await player.evaluate((element) => element.paused), true)
        await preview.evaluate((element) => element.pause())
        await page.waitForFunction(
          () => !document.querySelector('[data-testid="site-music-player"]').paused,
        )
        await page.getByRole('button', { name: 'Reset to Global', exact: true }).click()
        await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
        await page.waitForFunction(
          () => !document.querySelector('[data-testid="site-music-player"]').getAttribute('src'),
        )
      }
      console.log(`Passed ${view}: ${viewport.width}x${viewport.height}, CSS zoom ${viewport.zoom}`)
      await page.screenshot({
        path: resolve(output, `${view}-${viewport.width}-${viewport.zoom}.png`),
        fullPage: true,
      })
    }
    assert.deepEqual(errors, [])
    await page.close()
  }
  await fs.writeFile(
    resolve(output, 'players-reader-results.json'),
    JSON.stringify(playerEvidence, null, 2),
  )
  console.log(
    worldEnvironmentOnly
      ? 'Mounted World save controls passed; no live cadence or expiry claim.'
      : playersReaderOnly
        ? 'Real nested Master shell/Players reader regression passed.'
        : 'Master operational desktop/mobile/150% controls, native playback and nested Players reader passed.',
  )
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
