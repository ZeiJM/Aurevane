// Real production Ground renderer and CSS in native Chromium; isolated read-only fixtures.
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-ground-presets-'))
const output = process.env.AV_GROUND_PRESETS_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-ground-presets-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#171e19;color:#eee2c8;--av-font-mono:monospace}</style></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
const server = await createServer({
  configFile: false,
  root: fixture,
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
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
const errors = [],
  results = []
try {
  for (const mode of ['pve', 'pvp', 'spectator'])
    for (const width of [1366, 390, 320])
      for (const reducedMotion of ['no-preference', 'reduce']) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          reducedMotion,
          isMobile: width < 821,
          hasTouch: width < 821,
        })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`${server.resolvedUrls.local[0]}?mode=${mode}`)
        await page.locator('[data-case="current-spores"]').waitFor()
        const palette = await page.evaluate(() =>
          [...document.querySelectorAll('[data-preset-card]')].map((card) => {
            const layers = [...card.querySelectorAll('[data-ground-area-preset]')]
            const layer = layers[0],
              material = layer.querySelector('i'),
              css = getComputedStyle(material)
            return {
              id: card.dataset.presetCard,
              presets: layers.map((entry) => entry.dataset.groundAreaPreset),
              animation: css.animationName,
              iterations: css.animationIterationCount,
              pointerEvents: getComputedStyle(layer).pointerEvents,
              background: css.backgroundImage,
              effects: [
                ...card
                  .querySelector('[data-case^="current-"]')
                  .querySelectorAll('[data-ground-effect-id]'),
              ].map((marker) => marker.dataset.groundEffectId),
              title: layer.title,
              historicalMarker: card.querySelector('[data-case^="historical-"] b')?.textContent,
            }
          }),
        )
        assert.equal(palette.length, 20)
        for (const preset of palette) {
          assert.deepEqual(preset.presets, [preset.id, preset.id])
          assert.deepEqual(preset.effects, ['damage', 'status:frozen'])
          assert.equal(preset.pointerEvents, 'none')
          assert.ok(preset.title.includes('Damage Ground · 3 rounds remaining'))
          assert.equal(preset.historicalMarker, '3')
          assert.equal(
            preset.animation === 'none',
            reducedMotion === 'reduce',
            JSON.stringify(preset),
          )
          if (reducedMotion !== 'reduce') assert.equal(preset.iterations, 'infinite')
        }
        if (reducedMotion !== 'reduce') {
          assert.equal(
            new Set(palette.map((preset) => preset.animation)).size,
            20,
            'Each preset needs its own motion family',
          )
          const sample = async (time) =>
            page.evaluate((time) => {
              for (const animation of document.getAnimations()) {
                animation.pause()
                animation.currentTime = time
              }
              return [
                ...document.querySelectorAll(
                  '[data-case^="current-"] [data-ground-area-preset] > i',
                ),
              ].map((node) => {
                const css = getComputedStyle(node)
                return [css.transform, css.opacity, css.backgroundPosition, css.filter].join('|')
              })
            }, time)
          const first = await sample(900),
            second = await sample(2100)
          for (let index = 0; index < palette.length; index++)
            assert.notEqual(
              first[index],
              second[index],
              `${palette[index].id} must visibly progress`,
            )
        }
        const lifecycle = await page.evaluate(() => {
          const node = (name) => document.querySelector(`[data-case="${name}"]`)
          return {
            pending: getComputedStyle(
              node('pending').querySelector('[data-ground-area-preset] > i'),
            ).animationName,
            clock: node('pending').querySelector('[data-ground-area-clock]')?.textContent,
            expired: node('expired').querySelectorAll('[data-ground-area-id]').length,
            overlap: node('overlap').querySelectorAll('[data-ground-area-id]').length,
            overlapMarkers: node('overlap').querySelectorAll('[data-ground-effect-id]').length,
            steam: node('steam').querySelectorAll('[data-ground-steam-mist]').length,
            steamFields: node('steam').querySelectorAll('[data-ground-area-id]').length,
            overflow: document.documentElement.scrollWidth > innerWidth,
          }
        })
        assert.deepEqual(lifecycle, {
          pending: 'none',
          clock: '◷2',
          expired: 0,
          overlap: 2,
          overlapMarkers: 2,
          steam: 1,
          steamFields: 0,
          overflow: false,
        })
        const markers = await page.evaluate(() =>
          [...document.querySelectorAll('[data-ground-effect-id] svg, [data-ground-area-clock]')]
            .filter((marker) => marker.getBoundingClientRect().width > 0)
            .map((marker) => {
              const box = marker.getBoundingClientRect()
              const tile = marker.closest('button').getBoundingClientRect()
              return {
                width: box.width,
                height: box.height,
                tile: tile.width,
                contained:
                  box.left >= tile.left &&
                  box.right <= tile.right &&
                  box.top >= tile.top &&
                  box.bottom <= tile.bottom,
              }
            }),
        )
        for (const marker of markers) {
          assert.equal(marker.tile, width < 821 ? 32 : 64)
          assert.ok(marker.contained, JSON.stringify(marker))
          assert.ok(marker.height <= (width < 821 ? 8.8 : 12), JSON.stringify(marker))
        }
        await page.locator('[data-case="current-water"]').click({ position: { x: 10, y: 10 } })
        assert.equal(await page.evaluate(() => window.groundTileClicks), 1)
        await page.screenshot({
          path: resolve(output, `${mode}-${width}-${reducedMotion}.png`),
          fullPage: true,
        })
        results.push({
          mode,
          width,
          reducedMotion,
          presets: palette.map(({ id, animation }) => ({ id, animation })),
        })
        await page.close()
      }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        cases: results.length,
        errors,
        results,
        scope:
          'Native Chromium with production shared layer and CSS; isolated fixtures, no account or hosted mutations.',
      },
      null,
      2,
    ),
  )
  console.log(
    `${results.length} native Ground palette cases passed; 20 presets each. Evidence: ${output}`,
  )
} finally {
  await browser.close()
  await server.close()
}
