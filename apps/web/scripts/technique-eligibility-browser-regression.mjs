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
const h = await fs.mkdtemp(resolve(tmpdir(), 'technique-eligibility-'))
const output = process.env.AV_TECHNIQUE_ELIGIBILITY_EVIDENCE_DIR || resolve(h, 'evidence')
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
  for (const [width, height] of [
    [390, 844],
    [320, 740],
    [844, 390],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0] + '?profilePanel=techniques')
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
    })
    const cards = dialog.locator('[data-technique-category="primary"] article[data-technique-card]')
    assert.equal(await cards.count(), 8)
    const preview = dialog.getByTestId('technique-preview')
    const previewBefore = await preview.boundingBox()
    const primary = dialog.getByRole('tab', { name: 'Discipline 1', exact: true })
    assert.equal(await primary.getAttribute('aria-selected'), 'true')
    assert.equal(await preview.locator('img').count(), 0)
    const measured = []
    for (const card of await cards.all()) {
      assert.equal(
        await card.getByRole('combobox').count(),
        0,
        'Skill cards do not expose provenance controls',
      )
      await card.scrollIntoViewIfNeeded()
      const geometry = await card.evaluate((node) => {
        const box = (element) => element.getBoundingClientRect().toJSON()
        const identity = node.querySelector('label')
        const art = identity.querySelector('img')
        const name = identity.querySelector('strong')
        const range = document.createRange()
        range.selectNodeContents(name)
        return {
          name: name.textContent,
          card: box(node),
          art: box(art),
          nameBox: box(name),
          glyphs: [...range.getClientRects()].map((rect) => rect.toJSON()),
        }
      })
      await page.screenshot({ path: resolve(output, `geometry-${width}-${measured.length}.png`) })
      assert.ok(
        geometry.art.bottom <= geometry.nameBox.top + 1,
        `Artwork overlaps Skill identity: ${JSON.stringify(geometry)}`,
      )
      for (const glyph of geometry.glyphs)
        assert.ok(
          glyph.top >= geometry.nameBox.top - 1 &&
            glyph.bottom <= geometry.nameBox.bottom + 1 &&
            glyph.left >= geometry.nameBox.left - 1 &&
            glyph.right <= geometry.nameBox.right + 1,
          `Skill name is clipped: ${JSON.stringify(geometry)}`,
        )
      assert.ok(
        geometry.art.width >= (width === 844 ? 23 : 40) &&
          geometry.art.height >= (width === 844 ? 23 : 40),
        'Chooser artwork retains its mobile size',
      )
      assert.ok(
        geometry.nameBox.bottom <= geometry.card.bottom + 1,
        'Skill identity remains inside its card',
      )
      measured.push(geometry)
    }
    assert.deepEqual(
      await preview.boundingBox(),
      previewBefore,
      'Chooser scrolling preserves the lower preview',
    )
    assert.equal(await page.evaluate(() => window.calls.length), 0)
    const skills = await page.evaluate(() => window.fixtureSkills)
    const equip = dialog.getByRole('button', { name: 'Equip technique', exact: true })
    async function choose(index) {
      const card = cards.nth(index)
      assert.equal(
        await card.locator('label').count(),
        1,
        'Only the actual Skill selection label remains',
      )
      assert.equal(await card.locator('label:has(input[type="checkbox"])').count(), 1)
      await card.tap()
      assert.equal(await primary.getAttribute('aria-selected'), 'true')
      await preview.getByText(await card.locator('strong').innerText(), { exact: true }).waitFor()
    }
    await choose(0)
    assert.equal(
      await page.evaluate(() => window.calls.length),
      0,
      'Touch only previews before Equip',
    )
    await equip.tap()
    await dialog.getByRole('button', { name: 'Remove from loadout', exact: true }).waitFor()
    for (const index of [1, 2, 3]) {
      await choose(index)
      await equip.tap()
      await dialog.getByRole('button', { name: 'Remove from loadout', exact: true }).waitFor()
    }
    const calls = await page.evaluate(() => window.calls)
    assert.equal(calls.length, 4)
    assert.deepEqual(
      calls.map((call) => call.expectedBuildVersion),
      [1, 2, 3, 4],
    )
    assert.equal(new Set(calls.map((call) => call.idempotencyKey)).size, 4)
    assert.deepEqual(calls[0].eligibilitySelections, [
      { skillId: skills[0].id, eligibilityDisciplineId: 'vanguard' },
    ])
    assert.deepEqual(
      calls[3].skillIds,
      skills.slice(0, 4).map((skill) => skill.id),
    )
    assert.deepEqual(
      calls[3].eligibilitySelections.map((choice) => choice.eligibilityDisciplineId),
      ['vanguard', 'vanguard', 'vanguard', 'lifebinder'],
    )
    assert.match(await dialog.getByTestId('skill-capacity').innerText(), /4 \/ 4 selected/i)
    await choose(4)
    assert.equal(await equip.isDisabled(), true, 'Four Skill capacity still prevents a fifth equip')
    assert.equal(await page.evaluate(() => window.calls.length), 4)
    await choose(0)
    await page.evaluate(() => {
      window.rejectNext = true
    })
    await dialog.getByRole('button', { name: 'Remove from loadout', exact: true }).tap()
    await dialog.getByText('Build changed. Refresh and try again.', { exact: true }).waitFor()
    assert.equal(
      await cards.nth(0).getByRole('checkbox').isChecked(),
      true,
      'Conflict restores the committed selection',
    )
    assert.equal(await page.evaluate(() => window.calls.at(-1).expectedBuildVersion), 5)
    await dialog.getByRole('tab', { name: 'Support', exact: true }).tap()
    assert.equal(
      await dialog.getByRole('tab', { name: 'Support', exact: true }).getAttribute('aria-selected'),
      'true',
    )
    await primary.tap()
    assert.equal(await primary.getAttribute('aria-selected'), 'true')
    assert.equal(await cards.nth(0).getByRole('checkbox').isChecked(), true)
    assert.equal(await preview.locator('img').count(), 0)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({ path: resolve(output, `final-${width}.png`) })
    checks.push({
      width,
      height,
      cards: measured,
      submittedBuildVersions: calls.map((call) => call.expectedBuildVersion),
    })
    console.log(
      `Passed ${width}x${height}: eight shared identities without source controls, touch preview, automatic grant submission/conflict, four Skill capacity and tabs`,
    )
    await context.close()
  }
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const page = await desktop.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(server.resolvedUrls.local[0] + '?profilePanel=techniques')
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  assert.equal(await dialog.getByRole('combobox').count(), 0)
  const cards = dialog.locator('[data-technique-category="primary"] article[data-technique-card]')
  assert.equal(await cards.count(), 8)
  for (const index of [0, 1, 2, 3]) {
    await cards.nth(index).getByRole('checkbox').check()
    await page.waitForFunction((expected) => window.calls.length === expected, index + 1)
    assert.equal(await cards.nth(index).getByRole('checkbox').isChecked(), true)
  }
  const calls = await page.evaluate(() => window.calls)
  assert.deepEqual(
    calls[3].eligibilitySelections.map((choice) => choice.eligibilityDisciplineId),
    ['vanguard', 'vanguard', 'vanguard', 'lifebinder'],
  )
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({ path: resolve(output, 'final-1366.png') })
  checks.push({
    width: 1366,
    height: 768,
    submittedBuildVersions: calls.map((call) => call.expectedBuildVersion),
  })
  console.log(
    'Passed 1366x768: direct checkbox selection, automatic shared provenance and no source controls',
  )
  await desktop.close()
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify({ browser: browser.version(), checks, errors }, null, 2),
  )
} finally {
  await browser.close()
  await server.close()
  await fs.rm(h, { recursive: true, force: true })
}
