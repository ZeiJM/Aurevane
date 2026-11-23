// Render production management panels with production global CSS and authoritative-response fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/nexus-desktop-integration-regression.mjs
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
const reportChecks = []
async function verifySupportReports(page, viewport, touch = false) {
  if (touch) await page.getByRole('tab', { name: 'Support', exact: true }).click()
  const preview = page.getByTestId('technique-preview')
  let baseline
  for (const [name, cost, effect] of [
    ['HP Recovery', '50 AP', 'HP Recovery'],
    ['MP Recovery', '50 AP', 'MP Recovery'],
    ['Pilfer', '15 AP', 'Pierce'],
    ['Fleetstep', '30 AP', 'Move'],
    ['Invocation', '45 AP / 10 MP', 'Summon'],
  ]) {
    const input = page.getByRole('radio', { name, exact: true })
    if (touch) await input.locator('xpath=ancestor::label').click()
    else await input.focus()
    await page.waitForFunction(
      (name) =>
        document.querySelector('[data-testid="technique-preview"] strong')?.textContent === name,
      name,
    )
    const dl = preview.locator('dl').first()
    const metrics = await dl.evaluate((table) => {
      const rect = table.getBoundingClientRect()
      const rows = [...table.children].map((row) => {
        const term = row.querySelector('dt')
        const value = row.querySelector('dd')
        const a = term.getBoundingClientRect()
        const b = value.getBoundingClientRect()
        return {
          label: term.textContent,
          value: value.textContent,
          display: getComputedStyle(row).display,
          aligned: b.left >= a.right - 1 && b.right <= rect.right + 1,
          valueFont: getComputedStyle(value).fontSize,
          valueAlign: getComputedStyle(value).textAlign,
        }
      })
      const notes = table.closest('[data-technique-preview-details]').querySelector('ul')
      return {
        display: getComputedStyle(table).display,
        overflowX: table.scrollWidth - table.clientWidth,
        rows,
        explanationFont: getComputedStyle(notes).fontSize,
      }
    })
    await page.screenshot({
      path: resolve(output, `support-${viewport}-${name.replaceAll(' ', '-')}.png`),
    })
    assert.equal(metrics.display, 'grid', `${name} uses the same compact report table`)
    assert.deepEqual(
      metrics.rows.map((row) => row.label),
      [
        'Skill Type',
        'Cost',
        'Cooldown',
        'Requirements',
        'Effects',
        'Target Method',
        'Target Elevation',
        'Line of Sight',
      ],
    )
    assert.ok(
      metrics.rows.every((row) => row.display === 'grid' && row.aligned),
      `${name} keeps labels beside values`,
    )
    assert.ok(metrics.overflowX <= 1, `${name} report fits horizontally`)
    assert.equal(metrics.rows.find((row) => row.label === 'Cost').value, cost)
    assert.ok(metrics.rows.find((row) => row.label === 'Effects').value.includes(effect))
    if (!baseline) baseline = metrics
    assert.equal(metrics.rows[0].valueFont, baseline.rows[0].valueFont)
    assert.equal(metrics.rows[0].valueAlign, baseline.rows[0].valueAlign)
    assert.equal(metrics.explanationFont, baseline.explanationFont)
    await dl
      .locator('dt')
      .filter({ hasText: /^Line of Sight$/ })
      .scrollIntoViewIfNeeded()
    if (touch) {
      const action = page.locator('[data-technique-preview-actions] button')
      await action.waitFor({ state: 'visible' })
      assert.equal(
        await action.innerText(),
        name === 'HP Recovery' ? '✓ Current Support Action' : 'Use as Support Action',
      )
    }
    assert.equal(
      await page.evaluate(() => window.calls.length),
      0,
      'Reading Support reports submits no command',
    )
    reportChecks.push({ viewport, name, metrics })
  }
}
await fs.mkdir(output, { recursive: true })
console.log(
  `Nexus desktop browser: ${browser.version()}; executable: ${process.env.AV_CHROMIUM_EXECUTABLE || chromium.executablePath()}`,
)
try {
  for (const [build, width, height, discipline = 'vanguard', equipmentReadError = false] of [
    ['pure', 1280, 720, 'ironfist'],
    ['pure', 1366, 768, 'ironfist'],
    ['pure', 1280, 720],
    ['pure', 1366, 768],
    ['pure', 1536, 614],
    ['pure', 1920, 1080],
    ['mixed', 1366, 768],
    ['mixed', 1440, 900],
    ['pure', 1280, 720, 'ironfist', true],
    ['pure', 1536, 614, 'vanguard', true],
    ['mixed', 1366, 768, 'vanguard', true],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(
      server.resolvedUrls.local[0] +
        '?profilePanel=techniques' +
        `&discipline=${discipline}` +
        (equipmentReadError ? '&equipmentReadError=1' : '') +
        (build === 'pure' ? '&pure=1' : ''),
    )
    await page.getByRole('dialog').waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    for (const card of await page.locator('[data-technique-card]:has(input)').all())
      await card.hover()
    if (discipline === 'ironfist') {
      await page.getByRole('checkbox', { name: 'Select Counter Palm', exact: true }).focus()
      assert.match(await page.getByTestId('technique-preview').innerText(), /Counter Palm/)
    }
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
      const support = dialog.querySelector('[role="radiogroup"][aria-label="Support Action"]')
      return {
        width: innerWidth,
        height: innerHeight,
        dialog: box(dialog),
        overflow: overflow(dialog),
        groups: groups.map((g) => ({
          box: box(g),
          overflow: overflow(g),
          cards: [...g.querySelectorAll('[data-technique-card]')].map((c) => ({
            name: c.querySelector('strong')?.textContent,
            box: box(c),
            overflow: overflow(c),
            art: box(c.querySelector('[data-technique-art]')),
            contents: [...c.querySelectorAll('label,select,strong,small')]
              .filter((e) => e.getBoundingClientRect().height)
              .map(box),
          })),
        })),
        support: {
          box: box(support),
          overflow: overflow(support),
          cards: [...support.querySelectorAll('article')].map((c) => ({
            name: c.querySelector('input').getAttribute('aria-label'),
            box: box(c),
            overflow: overflow(c),
            art: box(c.querySelector('[data-av-square-media]')),
          })),
        },
      }
    })
    const evidenceName = `${build}${discipline === 'vanguard' ? '' : `-${discipline}`}-${width}-${height}${equipmentReadError ? '-equipment-error' : ''}`
    await page.screenshot({ path: resolve(output, `${evidenceName}.png`) })
    await fs.writeFile(resolve(output, `${evidenceName}.json`), JSON.stringify(metrics, null, 2))
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
        assert.deepEqual(
          card.overflow,
          { x: 0, y: 0 },
          `${build} ${width}x${height}: ${card.name} stays inside its card`,
        )
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
    assert.deepEqual(metrics.support.overflow, { x: 0, y: 0 })
    assert.deepEqual(metrics.support.cards.map((card) => card.name).sort(), [
      'Fleetstep',
      'HP Recovery',
      'Invocation',
      'MP Recovery',
      'Pilfer',
    ])
    assert.ok(
      Math.max(...metrics.support.cards.map((card) => card.box.y)) -
        Math.min(...metrics.support.cards.map((card) => card.box.y)) <=
        1,
      'All current Support choices share one desktop row without compressing the Skill galleries',
    )
    for (const card of metrics.support.cards) {
      assert.deepEqual(card.overflow, { x: 0, y: 0 }, `${card.name} stays inside its card`)
      assert.ok(Math.abs(card.art.width - card.art.height) <= 1)
      assert.ok(card.art.width >= 64, `readable Support art ${card.name}: ${card.art.width}`)
      assert.ok(card.art.y >= card.box.y - 1 && card.art.bottom <= card.box.bottom + 1)
      assert.ok(card.box.bottom <= metrics.dialog.bottom && card.box.right <= metrics.dialog.right)
    }
    assert.equal(await page.getByRole('alert').count(), equipmentReadError ? 1 : 0)
    checks.push({ build, discipline, width, height, equipmentReadError })
    await verifySupportReports(page, evidenceName)
    await page.close()
  }
  for (const [width, height] of [
    [360, 780],
    [390, 844],
    [393, 852],
    [844, 390],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0] + '?profilePanel=techniques')
    await page.getByRole('dialog').waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await verifySupportReports(page, `touch-${width}x${height}`, true)
    await page.close()
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify({ checks, reportChecks, errors }, null, 2),
  )
  console.log(JSON.stringify({ checks, supportReports: reportChecks.length, errors }))
} finally {
  await browser.close()
  await server.close()
  await fs.rm(h, { recursive: true, force: true })
}
