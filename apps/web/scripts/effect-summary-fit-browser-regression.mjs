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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'effect-summary-fit-'))
const output =
  process.env.AV_EFFECT_FIT_EVIDENCE_DIR || resolve(tmpdir(), 'effect-summary-fit-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/effect-summary-fit-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'production-styles.js'),
  "import '@aurevane/ui/styles.css';import '@/app/globals.css';import '@/app/approved-adventure.css'",
)
const imageDefines = {
  'process.env.__NEXT_IMAGE_OPTS': 'undefined',
  'process.env.NEXT_DEPLOYMENT_ID': 'undefined',
  'process.env.NEXT_SUPPORTS_IMMUTABLE_ASSETS': 'false',
}
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  define: imageDefines,
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
    rolldownOptions: { transform: { define: imageDefines } },
  },
})
await server.listen()
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
})
const errors = []
const evidence = []
async function measure(locator) {
  return locator.evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      const range = document.createRange()
      range.selectNodeContents(element)
      const text = range.getBoundingClientRect()
      const cell =
        element.closest('dd')?.getBoundingClientRect() ??
        element.parentElement.getBoundingClientRect()
      const reader = element.closest('[data-fit-reader], [role="dialog"]')?.getBoundingClientRect()
      const label = element.closest('dd')?.previousElementSibling
      return {
        text: element.textContent,
        overflow: element.scrollWidth - element.clientWidth,
        left: Math.min(box.left, text.left),
        right: Math.max(box.right, text.right),
        cellLeft: cell.left,
        cellRight: cell.right,
        readerLeft: reader?.left,
        readerRight: reader?.right,
        label: label?.textContent,
        labelHeight: label?.getBoundingClientRect().height,
        labelLineHeight: label ? parseFloat(getComputedStyle(label).lineHeight) : null,
        height: box.height,
        textHeight: text.height,
        lineHeight: parseFloat(getComputedStyle(element).lineHeight),
        fontSize: parseFloat(getComputedStyle(element).fontSize),
      }
    }),
  )
}
function assertFits(rows, name) {
  assert.ok(rows.length >= 34, `${name}: all effects rendered`)
  for (const row of rows) {
    assert.ok(row.overflow <= 1, `${name}: horizontal effect scrolling ${JSON.stringify(row)}`)
    assert.ok(
      row.left >= row.cellLeft - 1 && row.right <= row.cellRight + 1,
      `${name}: clipped effect ${JSON.stringify(row)}`,
    )
    assert.ok(
      row.cellLeft >= row.readerLeft - 1 && row.cellRight <= row.readerRight + 1,
      `${name}: value column fits its reader ${JSON.stringify(row)}`,
    )
    if (row.label === 'Effects')
      assert.ok(
        row.labelHeight <= row.labelLineHeight + 1,
        `${name}: readable row label ${JSON.stringify(row)}`,
      )
    assert.ok(
      row.textHeight <= row.height + 1,
      `${name}: clipped multiline text ${JSON.stringify(row)}`,
    )
    assert.ok(row.fontSize >= 11, `${name}: readable font ${JSON.stringify(row)}`)
  }
  assert.ok(
    rows.some((row) => /Fire.*99999/.test(row.text)),
    `${name}: full Fire damage`,
  )
  assert.ok(
    rows.some((row) => /Conditional Cleanse.*Chilled/.test(row.text)),
    `${name}: full conditional cleanse`,
  )
  assert.ok(
    rows.some((row) => /999% Pierce \/ Fire \/ Water \/ Ice \/ Storm.*99 Turns/.test(row.text)),
    `${name}: all scoped parameters`,
  )
}
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/_next/image?*', async (route) => {
      const url = new URL(route.request().url())
      await route.continue({
        url: new URL(url.searchParams.get('url'), server.resolvedUrls.local[0]).href,
      })
    })
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Effect summary fit', exact: true }).waitFor()
    for (const name of [
      'ItemDetails',
      'AbilityParameters',
      'SkillDetails',
      'BattleSkillParameters',
    ]) {
      const rows = await measure(
        page.locator(`[data-fit-reader="${name}"] [data-compact-skill-effect]`),
      )
      assertFits(rows, `${viewport.width} ${name}`)
      evidence.push({
        viewport: viewport.width,
        reader: name,
        effects: rows.length,
        wrapped: rows.filter((row) => row.height > row.lineHeight + 1).length,
      })
    }
    const [short] = await measure(
      page.locator('[data-short-reference] [data-compact-skill-effect]'),
    )
    assert.ok(
      short.textHeight <= short.lineHeight + 1,
      `Short effect stays one line: ${JSON.stringify(short)}`,
    )
    const colors = await page
      .locator('[data-short-reference]')
      .evaluate((element) =>
        ['label', 'magnitude', 'timing', 'target'].map(
          (part) => getComputedStyle(element.querySelector(`[data-compact-effect-${part}]`)).color,
        ),
      )
    assert.equal(new Set(colors).size, 4, 'Name, amount, timing and target retain distinct colors')
    await page.screenshot({ path: resolve(output, `readers-${viewport.width}.png`) })
    await page.getByRole('button', { name: 'Open battle effects', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Battle effects', exact: true })
    await dialog.waitFor()
    const popupRows = await measure(dialog.locator('[data-compact-skill-effect]'))
    assertFits(popupRows, `${viewport.width} Battle popup`)
    evidence.push({
      viewport: viewport.width,
      reader: 'Battle popup',
      effects: popupRows.length,
      wrapped: popupRows.filter((row) => row.height > row.lineHeight + 1).length,
    })
    await page.screenshot({
      path: resolve(output, `effects-${viewport.width}.png`),
      fullPage: true,
    })
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Page fits viewport',
    )
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Explain Dmg', exact: true }).click()
    const help = page.getByRole('dialog', { name: 'Dmg', exact: true })
    assert.equal(
      await help.locator('p').innerText(),
      'Read the complete captured damage parameters.',
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ evidence, runtimeErrors: errors, output }))
} finally {
  await browser.close()
  await server.close()
}
