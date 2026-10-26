// Actual operational components and native media; HTTP/session boundaries are local fixtures.
// AV_PANEL_MUSIC_COMPILE_ONLY=1 compiles without claiming browser execution.
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'master-operations-'))
const output = process.env.AV_PANEL_MUSIC_EVIDENCE_DIR || resolve(tmpdir(), 'panel-music-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/master-operations-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
const entryPath = resolve(fixture, 'entry.jsx')
let entry = await fs.readFile(entryPath, 'utf8')
entry = entry.replace(
  'let savedMusic = config',
  `config.songLibrary = [config.defaultTrack, ...Array.from({length: 120}, (_, index) => ({...config.defaultTrack, label: 'Library song ' + (index + 1), url: config.defaultTrack.url + '?fixture=' + index}))]
let savedMusic = JSON.parse(sessionStorage.getItem('music-test-settings') ?? 'null') ?? config`,
)
entry = entry.replace(
  'return Response.json({ config: savedMusic })\n  }',
  `sessionStorage.setItem('music-test-settings', JSON.stringify(savedMusic))
    return Response.json({ config: savedMusic })
  }`,
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

if (process.env.AV_PANEL_MUSIC_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log('Actual Music and AudioProvider browser fixture compiled; browser not run.')
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
    process.env.AV_PANEL_MUSIC_BROWSER_EXECUTABLE || '/tmp/task13-recovery-browser/chromium',
})
const evidence = []
try {
  const origin = server.resolvedUrls.local[0]
  for (const viewport of [
    { width: 1366, height: 768, zoom: 1 },
    { width: 390, height: 844, zoom: 1 },
    { width: 1366, height: 768, zoom: 2 },
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(origin + '?view=music')
    await page.locator('body').evaluate((body, zoom) => (body.style.zoom = zoom), viewport.zoom)
    const workspace = page.getByRole('region', { name: 'Site Music', exact: true })
    const pages = workspace.getByRole('navigation', { name: 'Page music', exact: true })
    const library = workspace.getByRole('navigation', { name: 'Song library', exact: true })
    await library.getByRole('button', { name: 'Add song', exact: true }).waitFor()
    const help = workspace.getByRole('button', { name: 'About Music guidance', exact: true })
    await help.click()
    await page.getByRole('dialog', { name: 'Music guidance', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog', { name: 'Music guidance', exact: true }).count(), 0)
    assert.equal(await help.evaluate((element) => element === document.activeElement), true)
    assert.equal(await library.locator('strong').count(), 121)
    const geometry = await pages.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        top: button.offsetTop,
        height: button.offsetHeight,
        scrollHeight: button.scrollHeight,
        clientHeight: button.clientHeight,
      })),
    )
    for (let index = 1; index < geometry.length; index++)
      assert.ok(
        geometry[index].top >= geometry[index - 1].top + geometry[index - 1].height,
        'Page rows overlap',
      )
    for (const row of geometry)
      assert.ok(row.scrollHeight <= row.clientHeight + 1, 'Page row clipped')
    const songRows = await library.locator('button').evaluateAll((buttons) =>
      buttons.slice(1).map((button) => ({
        top: button.offsetTop,
        height: button.offsetHeight,
        clipped: button.scrollHeight > button.clientHeight + 1,
      })),
    )
    for (let index = 1; index < songRows.length; index++)
      assert.ok(
        songRows[index].top >= songRows[index - 1].top + songRows[index - 1].height,
        'Song rows overlap',
      )
    assert.equal(
      songRows.some((row) => row.clipped),
      false,
    )
    if (viewport.width === 1366 && viewport.zoom === 1)
      assert.equal(
        await workspace.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
        true,
        'Desktop workspace grows beyond its fixed frame',
      )
    await workspace.getByRole('button', { name: 'Add song', exact: true }).click()
    await workspace.getByLabel('Track name', { exact: true }).fill('Saved for later')
    const audioUrl = '/media/audio/music/road-to-aurevane.webm?library=1'
    await workspace.getByLabel('Audio URL', { exact: true }).fill(audioUrl)
    await workspace.getByRole('button', { name: 'Add to library', exact: true }).click()
    await workspace.getByRole('button', { name: 'Save Changes', exact: true }).click()
    let saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('music-test-settings')))
    assert.equal(saved.defaultTrack.label, 'Road to Aurevane')
    assert.ok(saved.songLibrary.some((song) => song.label === 'Saved for later'))
    await page.reload()
    await page.locator('body').evaluate((body, zoom) => (body.style.zoom = zoom), viewport.zoom)
    await library.getByRole('button').filter({ hasText: 'Saved for later' }).click()
    const preview = workspace.getByLabel('Track preview', { exact: true })
    const player = page.getByTestId('site-music-player')
    await player.evaluate((element) => element.play())
    await preview.evaluate((element) => element.play())
    await page.waitForFunction(
      () => document.querySelector('[data-testid="site-music-player"]').paused,
    )
    assert.equal(await preview.evaluate((element) => element.paused), false)
    assert.ok(await preview.evaluate((element) => element.currentSrc.endsWith('?library=1')))
    await workspace.getByLabel('Audio URL', { exact: true }).fill(audioUrl.replace('=1', '=2'))
    await workspace.getByRole('button', { name: 'Update song', exact: true }).click()
    await preview.evaluate((element) => element.play())
    assert.equal(await preview.evaluate((element) => element.paused), false)
    assert.ok(await preview.evaluate((element) => element.currentSrc.endsWith('?library=2')))
    await preview.evaluate((element) => element.pause())
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="site-music-player"]').paused,
    )
    await pages.getByRole('button', { name: /^World \/game\/world/ }).click()
    await workspace
      .getByRole('combobox', { name: 'Page music', exact: true })
      .selectOption('custom')
    await workspace
      .getByRole('combobox', { name: 'Library song', exact: true })
      .selectOption(audioUrl.replace('=1', '=2'))
    await workspace.getByRole('button', { name: 'Save Changes', exact: true }).click()
    saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('music-test-settings')))
    assert.equal(
      saved.routeOverrides.find((rule) => rule.pathPrefix === '/game/world').track.label,
      'Saved for later',
    )
    await library.getByRole('button').filter({ hasText: 'Saved for later' }).click()
    await workspace.getByRole('button', { name: 'Delete song', exact: true }).click()
    await workspace.getByRole('status').filter({ hasText: 'still assigned' }).waitFor()
    await library.getByRole('button').filter({ hasText: 'Library song 120' }).click()
    await workspace.getByRole('button', { name: 'Delete song', exact: true }).click()
    await workspace.getByRole('button', { name: 'Save Changes', exact: true }).click()
    saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('music-test-settings')))
    assert.equal(
      saved.songLibrary.some((song) => song.label === 'Library song 120'),
      false,
    )
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      'Horizontal overflow',
    )
    assert.deepEqual(errors, [])
    await page.screenshot({
      path: resolve(output, `music-${viewport.width}-${viewport.zoom}.png`),
      fullPage: true,
    })
    evidence.push({
      viewport,
      pageRows: geometry.length,
      songRows: songRows.length,
      helpFocusAndEscape: true,
      backgroundPreviewHandoff: true,
      nativePreview: true,
      replacementPlayback: true,
      reload: true,
      assignment: true,
      inUseDeletionBlocked: true,
      unusedDeletion: true,
    })
    await page.close()
  }
  await fs.writeFile(resolve(output, 'music-results.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify({ browser: browser.version(), results: evidence }))
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
