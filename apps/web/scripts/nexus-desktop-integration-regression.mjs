// Render production management panels with production global CSS and authoritative-response fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/technique-eligibility-browser-regression.mjs
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { createServer } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const h = await fs.mkdtemp(resolve(tmpdir(), 'nexus-desktop-'))
const output = process.env.AV_NEXUS_DESKTOP_EVIDENCE_DIR || resolve(h, 'evidence')
await fs.copyFile(
  resolve(web, 'e2e/fixtures/technique-eligibility-harness.jsx'),
  resolve(h, 'entry.jsx'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(h, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(h, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(h, 'production-styles.js'),
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
const server = await createServer({
  configFile: false,
  root: h,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/image': resolve(h, 'next-mock.jsx'),
      'next/navigation': resolve(h, 'next-mock.jsx'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root, h] } },
  optimizeDeps: { include: ['react', 'react-dom/client'] },
})
await server.listen()
const browser = await chromium.launch({
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
  args: ['--no-sandbox'],
  headless: true,
})

const errors = []
const checks = []
await fs.mkdir(output, { recursive: true })
console.log(
  `Technique eligibility browser: ${browser.version()}; executable: ${process.env.AV_CHROMIUM_EXECUTABLE || chromium.executablePath()}`,
)
try {
  for (const [build, width, height] of [
    ['pure', 1280, 720],
    ['pure', 1366, 768],
    ['pure', 1536, 614],
    ['pure', 1920, 1080],
    ['mixed', 1366, 768],
    ['mixed', 1440, 900],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(
      server.resolvedUrls.local[0] +
        '?profilePanel=techniques' +
        (build === 'pure' ? '&pure=1' : ''),
    )
    await page.getByRole('dialog').waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    for (const card of await page.locator('[data-technique-card]:has(input)').all())
      await card.hover()
    const metrics = await page.evaluate(() => {
      const box = (e) => {
        const r = e.getBoundingClientRect()
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          right: r.right,
          bottom: r.bottom,
        }
      }
      const overflow = (e) => ({
        x: e.scrollWidth - e.clientWidth,
        y: e.scrollHeight - e.clientHeight,
      })
      const dialog = document.querySelector('[role="dialog"]')
      const groups = [...dialog.querySelectorAll('[data-technique-grid]')]
      return {
        width: innerWidth,
        height: innerHeight,
        dialog: box(dialog),
        overflow: overflow(dialog),
        groups: groups.map((g) => ({
          box: box(g),
          overflow: overflow(g),
          cards: [...g.querySelectorAll('[data-technique-card]')].map((c) => ({
            box: box(c),
            overflow: overflow(c),
            art: box(c.querySelector('[data-technique-art]')),
            contents: [...c.querySelectorAll('label,select,strong,small')]
              .filter((e) => e.getBoundingClientRect().height)
              .map(box),
          })),
        })),
      }
    })
    await page.screenshot({ path: resolve(output, `${build}-${width}-${height}.png`) })
    await fs.writeFile(
      resolve(output, `${build}-${width}-${height}.json`),
      JSON.stringify(metrics, null, 2),
    )
    assert.deepEqual(metrics.overflow, { x: 0, y: 0 }, `${build}: ${JSON.stringify(metrics)}`)
    assert.equal(metrics.groups.length, 2)
    for (const group of metrics.groups) {
      assert.equal(group.cards.length, 8)
      assert.deepEqual(group.overflow, { x: 0, y: 0 })
      assert.ok(
        Math.max(...group.cards.map((c) => c.box.y)) -
          Math.min(...group.cards.map((c) => c.box.y)) <=
          1,
      )
      for (const card of group.cards) {
        assert.ok(Math.abs(card.art.width - metrics.groups[0].cards[0].art.width) <= 1)
        assert.ok(Math.abs(card.art.width - card.art.height) <= 1)
        assert.ok(card.art.width >= 64, `readable art ${card.art.width}`)
        assert.ok(card.art.y >= card.box.y - 1 && card.art.bottom <= card.box.bottom + 1)
        assert.ok(
          card.box.bottom <= metrics.dialog.bottom && card.box.right <= metrics.dialog.right,
        )
        assert.deepEqual(card.overflow, { x: 0, y: 0 })
        for (const c of card.contents)
          assert.ok(
            c.x >= card.box.x - 1 &&
              c.y >= card.box.y - 1 &&
              c.right <= card.box.right + 1 &&
              c.bottom <= card.box.bottom + 1,
            JSON.stringify({ card: card.box, c }),
          )
      }
    }
    checks.push({ build, width, height })
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ checks, errors }))
} finally {
  await browser.close()
  await server.close()
  await fs.rm(h, { recursive: true, force: true })
}
