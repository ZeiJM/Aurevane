// Mount the production Battle Hall and styles; no account or battle writes are needed.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-launch-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-launch-'))
const output = process.env.AV_HALL_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-launch-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>#root{width:calc(100% - 112px);height:calc(100dvh - 120px);margin:60px auto}@media(max-width:760px){#root{width:calc(100% - 24px);height:auto;margin:12px auto}}</style></head><body><main id="root"></main><script type="module" src="/entry.jsx"></script></body></html>',
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
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/image': resolve(fixture, 'next-mock.jsx'),
      'next/navigation': resolve(fixture, 'next-mock.jsx'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root, fixture] } },
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
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const report = []
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1536, height: 614 },
    { width: 1100, height: 650 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(server.resolvedUrls.local[0])
    const allies = page.getByLabel('AI sparring allies')
    const enemies = page.getByLabel('AI sparring enemies')
    await allies.waitFor()
    await page.evaluate(() => document.fonts.ready)
    const geometry = await allies.evaluate((element) => {
      const arena = document.querySelector('[aria-label="AI sparring arena"]')
      const fieldset = element.closest('fieldset')
      const section = element.closest('[data-hall-workspace]')
      const rect = (node) => {
        const box = node.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      }
      return {
        arena: rect(arena),
        fieldset: rect(fieldset),
        controls: [...fieldset.querySelectorAll('select')].map((node) => ({
          ...rect(node),
          label: node.getAttribute('aria-label'),
          height: node.getBoundingClientRect().height,
          overflow: node.scrollWidth - node.clientWidth,
        })),
        labels: [...fieldset.querySelectorAll('label > span')].map((node) => ({
          ...rect(node),
          text: node.textContent,
          overflow: node.scrollWidth - node.clientWidth,
        })),
        overflow: [section, section.querySelector('[data-hall-scroll-body]')].map((node) => ({
          x: node.scrollWidth - node.clientWidth,
          y: node.scrollHeight - node.clientHeight,
        })),
      }
    })
    report.push({ viewport, ...geometry })
    const stem = `${viewport.width}x${viewport.height}`
    await page.screenshot({ path: resolve(output, `hall-${stem}.png`), fullPage: true })
    await fs.writeFile(resolve(output, 'geometry.json'), JSON.stringify(report, null, 2))
    for (const control of geometry.controls) {
      assert.ok(
        control.left >= geometry.arena.left - 1,
        `${stem}: ${control.label} begins within Arena select`,
      )
      assert.ok(
        control.right <= geometry.arena.right + 1,
        `${stem}: ${control.label} ends within Arena select`,
      )
      assert.ok(
        control.left >= geometry.fieldset.left,
        `${stem}: ${control.label} inside Participants`,
      )
      assert.ok(
        control.right <= geometry.fieldset.right,
        `${stem}: ${control.label} inside Participants`,
      )
      assert.ok(control.height >= 44, `${stem}: ${control.label} touch height`)
      assert.ok(control.overflow <= 1, `${stem}: ${control.label} no horizontal overflow`)
    }
    for (const label of geometry.labels) {
      assert.ok(
        label.left >= geometry.fieldset.left,
        `${stem}: ${label.text} label inside Participants`,
      )
      assert.ok(
        label.right <= geometry.fieldset.right,
        `${stem}: ${label.text} label inside Participants`,
      )
      assert.ok(label.overflow <= 1, `${stem}: ${label.text} label fully visible`)
    }
    for (const overflow of geometry.overflow) {
      assert.ok(overflow.x <= 1, `${stem}: no horizontal workspace scrolling`)
      if (viewport.width > 760)
        assert.ok(overflow.y <= 1, `${stem}: no vertical workspace scrolling`)
    }
    for (const count of [0, 1, 2]) {
      await allies.selectOption('0')
      await enemies.selectOption('5')
      await allies.selectOption(String(count))
      assert.equal(await enemies.inputValue(), String(5 - count))
      assert.equal(await enemies.locator('option').count(), 5 - count)
      assert.equal(1 + Number(await allies.inputValue()) + Number(await enemies.inputValue()), 6)
    }
    await page.getByRole('button', { name: 'Guided Fundamentals', exact: false }).click()
    assert.equal(await allies.count(), 0)
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(server.resolvedUrls.local[0] + '?screen=skill&profilePanel=techniques')
  const preview = page.getByTestId('technique-preview')
  await preview.waitFor()
  assert.equal(
    await preview.locator('small').first().innerText(),
    'Combatant steadies their blade for Forceful Strike.',
    'Nexus preview resolves authored flavor tokens with neutral identity',
  )
  assert.equal(await preview.locator('dt').count(), 10)
  assert.equal(await preview.getByLabel('Effect explanations').count(), 1)
  assert.doesNotMatch(await preview.innerText(), /Single target|Affects:/)
  await page.screenshot({ path: resolve(output, 'technique-neutral-flavor.png') })
  assert.deepEqual(errors, [])
  console.log(
    `Battle Hall: all 7 sizes keep Allies/Enemies within Arena; six-participant options preserved. Evidence: ${output}`,
  )
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
