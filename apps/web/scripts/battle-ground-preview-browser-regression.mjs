// Production shared preview, isolated canonical forecast fixtures; no account or server mutations.
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
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-ground-preview-'))
const output = process.env.AV_GROUND_PREVIEW_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-ground-preview-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;--av-font-body:Arial;--av-font-display:Georgia;--av-font-mono:monospace}</style></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      'next/image': resolve(fixture, 'next-mock.jsx'),
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
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
  headless: true,
  args: ['--no-sandbox'],
})
const errors = []
let cases = 0
let activePage
let activeCase
try {
  for (const mode of ['pve', 'pvp', 'spectator'])
    for (const width of [1366, 390, 320])
      for (const target of ['unit', 'ground-tile'])
        for (const scenario of ['frozen', 'mixed', 'current']) {
          const page = await browser.newPage({
            viewport: { width, height: 768 },
            isMobile: width < 821,
            hasTouch: width < 821,
          })
          activePage = page
          activeCase = `${mode}-${width}-${target}-${scenario}`
          page.on('pageerror', (error) => errors.push(error.message))
          await page.goto(
            `${server.resolvedUrls.local[0]}?mode=${mode}&target=${target}&scenario=${scenario}`,
          )
          const terrain = page.locator('[data-battle-preview-terrain="true"]')
          await terrain.first().waitFor()
          assert.equal(await terrain.count(), scenario === 'frozen' ? 1 : 2)
          assert.equal(
            await terrain.first().innerText(),
            scenario === 'current'
              ? 'Chilled Ground · 48 tiles · Starts round 4 · 3 rounds'
              : 'Frozen Ground · 48 tiles · 2 rounds',
          )
          if (scenario === 'current') {
            assert.equal(
              await terrain.nth(1).innerText(),
              'Damage Ground · 48 tiles · Starts round 4 · 3 rounds',
            )
            assert.ok(
              !(await page.locator('[data-battle-target-preview]').innerText()).includes(
                'Frozen Ground',
              ),
            )
            assert.ok(
              !(await page.locator('[data-battle-target-preview]').innerText()).includes('AP'),
            )
          }
          if (scenario === 'mixed')
            assert.equal(
              await terrain.nth(1).innerText(),
              'Steam · 5 tiles · Starts round 4 · 3 rounds',
            )
          const pendingField = page.locator('[data-current-ground-phase="pending"]')
          assert.equal(await pendingField.locator('[data-ground-area-clock]').innerText(), '◷3')
          assert.ok(
            (await pendingField.getAttribute('aria-label')).includes(
              'Chilled Ground · Starts round 3 · 3 rounds',
            ),
          )
          const activeField = page.locator('[data-current-ground-phase="active"]')
          assert.equal(await activeField.locator('[data-ground-area-clock]').count(), 0)
          assert.equal(
            await activeField.locator('[data-ground-area-preset="arcane-pulse"]').count(),
            1,
          )
          assert.equal(await activeField.locator('[data-ground-effect-id]').count(), 3)
          assert.ok(
            (await activeField.getAttribute('aria-label')).includes(
              'Guard Ground · 3 rounds remaining',
            ),
          )
          assert.equal(
            await page
              .locator('[data-current-ground-phase="expired"] [data-ground-area-id]')
              .count(),
            0,
          )
          const layout = await page.evaluate(() => {
            const strip = document.querySelector('main')
            const chips = [...document.querySelectorAll('[data-battle-preview-terrain]')]
            const artwork = strip.querySelector('img').getBoundingClientRect()
            return {
              viewport: innerWidth,
              pageWidth: document.documentElement.scrollWidth,
              height: strip.getBoundingClientRect().height,
              artwork: { width: artwork.width, height: artwork.height },
              chips: chips.map((chip) => ({
                client: chip.clientWidth,
                scroll: chip.scrollWidth,
                overflow: getComputedStyle(chip).textOverflow,
              })),
              currentMarkers: [
                ...document.querySelectorAll(
                  '[data-ground-effect-markers] svg, [data-ground-area-clock]',
                ),
              ]
                .filter((marker) => marker.getBoundingClientRect().width > 0)
                .map((marker) => {
                  const rect = marker.getBoundingClientRect(),
                    tile = marker.closest('button').getBoundingClientRect()
                  return {
                    width: rect.width,
                    height: rect.height,
                    tile: tile.width,
                    contained:
                      rect.left >= tile.left &&
                      rect.right <= tile.right &&
                      rect.top >= tile.top &&
                      rect.bottom <= tile.bottom,
                  }
                }),
              markers: [...document.querySelectorAll('[data-terrain-overlay-marker]')].map(
                (marker) => {
                  const elevation = marker.parentElement.querySelector(
                    '[data-terrain-elevation-marker]',
                  )
                  const rect = marker.getBoundingClientRect(),
                    tile = marker.parentElement.getBoundingClientRect()
                  return {
                    text: marker.textContent,
                    font: parseFloat(getComputedStyle(marker).fontSize),
                    elevationFont: parseFloat(getComputedStyle(elevation).fontSize),
                    height: rect.height,
                    width: rect.width,
                    tile: tile.width,
                    contained:
                      rect.left >= tile.left &&
                      rect.right <= tile.right &&
                      rect.top >= tile.top &&
                      rect.bottom <= tile.bottom,
                  }
                },
              ),
              unchanged:
                window.originalGroundPreview === JSON.stringify(window.currentGroundPreview),
            }
          })
          assert.ok(layout.pageWidth <= layout.viewport + 1, JSON.stringify(layout))
          assert.equal(layout.height, 64)
          assert.deepEqual(layout.artwork, { width: 32, height: 32 })
          assert.ok(layout.unchanged)
          for (const marker of layout.currentMarkers) {
            assert.ok(marker.contained, JSON.stringify(marker))
            assert.ok(marker.height <= (width <= 820 ? 8.8 : 12), JSON.stringify(marker))
          }
          assert.deepEqual(
            layout.markers.map((marker) => marker.text),
            ['❄2', '≋2'],
          )
          for (const marker of layout.markers) {
            assert.ok(marker.contained, JSON.stringify(marker))
            if (width <= 820) {
              assert.ok(
                marker.font <= Math.min(8.8, marker.elevationFont) + 0.1,
                JSON.stringify(marker),
              )
              assert.ok(marker.height <= marker.font + 0.2, JSON.stringify(marker))
              assert.ok(marker.width < marker.tile * 0.6, JSON.stringify(marker))
            } else assert.equal(marker.font, 11)
          }
          for (const chip of layout.chips)
            assert.ok(chip.scroll <= chip.client + 1, JSON.stringify(chip))
          await page.screenshot({
            path: resolve(output, `${mode}-${width}-${target}-${scenario}.png`),
          })
          cases++
          await page.close()
        }
  assert.equal(cases, 54)
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        cases,
        errors,
        scope:
          'Production shared preview at desktop/mobile widths; isolated forecast fixtures, not signed-in deployment verification.',
      },
      null,
      2,
    ),
  )
  console.log(`${cases} grouped terrain preview browser cases passed. Evidence: ${output}`)
} catch (error) {
  if (activePage && !activePage.isClosed())
    await activePage.screenshot({ path: resolve(output, `failure-${activeCase}.png`) })
  await fs.writeFile(
    resolve(output, 'partial-results.json'),
    JSON.stringify({ cases, activeCase, errors }, null, 2),
  )
  throw error
} finally {
  await browser.close()
  await server.close()
}
