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
const { expect } = require('@playwright/test')
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'runtime-item-editor-browser-'))
const output =
  process.env.AV_ITEM_EDITOR_EVIDENCE_DIR ||
  resolve(tmpdir(), 'runtime-item-editor-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/runtime-item-editor-harness.jsx'),
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
// next/image is reached by AbilityEffectEditor → SummonProfileEditor → SkillMediaEditor.
// Next replaces these public build constants; this standalone Vite fixture must do so too.
// Keep real image components and never expose a process object or server environment.
const nextImageBrowserDefines = {
  'process.env.__NEXT_IMAGE_OPTS': 'undefined',
  'process.env.NEXT_DEPLOYMENT_ID': 'undefined',
  'process.env.NEXT_SUPPORTS_IMMUTABLE_ASSETS': 'false',
}
const config = {
  define: nextImageBrowserDefines,
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      '@baseline-cohort': resolve(
        root,
        'docs/superpowers/specs/2026-10-18-modular-correction-cohort.json',
      ),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
    rolldownOptions: { transform: { define: nextImageBrowserDefines } },
  },
}

const server = await createServer(config)
await server.listen()
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
})
try {
  const passivePage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await passivePage.goto(`${server.resolvedUrls.local[0]}?item=wardstone-bracer&ability=missing`, {
    waitUntil: 'networkidle',
  })
  await passivePage.getByRole('button', { name: 'Add behavior groups', exact: true }).click()
  const added = await passivePage.evaluate(() => window.itemEditorValue)
  assert.ok(
    added.ability.behaviors.every(
      (group) => group.activation === 'ongoing' && group.mode === 'modifier',
    ),
  )
  assert.deepEqual(added.actions, {})
  await passivePage.getByRole('button', { name: 'Save definition JSON' }).click()
  await expect(passivePage.getByRole('alert')).toHaveCount(0)
  await passivePage.close()
  const repairPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await repairPage.goto(`${server.resolvedUrls.local[0]}?item=wardstone-bracer&legacy-active`, {
    waitUntil: 'networkidle',
  })
  const retained = await repairPage.evaluate(() => window.itemEditorValue)
  await repairPage.getByRole('button', { name: 'Keep passive effects only', exact: true }).click()
  const repaired = await repairPage.evaluate(() => window.itemEditorValue)
  assert.deepEqual(repaired, {
    ...retained,
    actions: {},
    ability: {
      ...retained.ability,
      behaviors: retained.ability.behaviors.filter((group) => group.activation === 'ongoing'),
    },
  })
  await repairPage.getByRole('button', { name: 'Save definition JSON' }).click()
  await expect(repairPage.getByRole('alert')).toHaveCount(0)
  await repairPage.close()
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/_next/image?*', async (route) => {
      const url = new URL(route.request().url())
      await route.continue({
        url: new URL(url.searchParams.get('url'), server.resolvedUrls.local[0]).href,
      })
    })
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
    const editor = page.getByRole('region', { name: 'Master Item editor', exact: true })
    const original = await page.evaluate(() => structuredClone(window.itemEditorValue))
    await expect(
      editor.getByRole('spinbutton', { name: 'Display order', exact: true }),
    ).toHaveCount(0)
    await editor.getByRole('textbox', { name: 'Description', exact: true }).fill('A'.repeat(1200))
    await editor
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill('A very long authored Item name that still fits inside its editor')
    const geometry = await editor.evaluate((element) => {
      const panel = element.getBoundingClientRect()
      return [...element.querySelectorAll('input, select, textarea')]
        .filter(
          (field) =>
            field.getClientRects().length &&
            !field.closest('dialog:not([open]),details:not([open])'),
        )
        .map((field) => {
          const bounds = field.getBoundingClientRect()
          return {
            label: field.getAttribute('aria-label') ?? field.type,
            contained: bounds.left >= panel.left - 1 && bounds.right <= panel.right + 1,
          }
        })
    })
    assert.ok(geometry.length > 5)
    assert.deepEqual(
      geometry.filter((field) => !field.contained),
      [],
    )
    await page.screenshot({
      path: resolve(output, `item-editor-long-fields-${viewport.width}.png`),
      fullPage: true,
    })
    const labelCenter = await editor
      .locator('label')
      .filter({ hasText: /^Description$/ })
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return bounds.y + bounds.height / 2
      })
    const helpCenter = await editor
      .getByRole('button', { name: 'About Description', exact: true })
      .evaluate((element) => {
        const bounds = element.getBoundingClientRect()
        return bounds.y + bounds.height / 2
      })
    assert.ok(
      Math.abs(labelCenter - helpCenter) < 1,
      'Description label and help stay on one compact row',
    )
    const descriptionHint = 'Shown in inventory Item details and Master preview.'
    await expect(editor.getByText(descriptionHint, { exact: true })).toHaveCount(1)
    await expect(editor.getByText(descriptionHint, { exact: true })).not.toBeVisible()
    await editor.getByRole('button', { name: 'About Description', exact: true }).click()
    await expect(
      page.getByRole('dialog', { name: 'About Description', exact: true }),
    ).toContainText(descriptionHint)
    await page.getByRole('button', { name: 'Close About Description', exact: true }).click()
    await expect(
      editor.getByRole('combobox', { name: 'Consumable action', exact: true }),
    ).toHaveCount(0)

    await editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }).fill('21')
    await editor.getByRole('spinbutton', { name: 'Battle uses', exact: true }).fill('4')
    await editor
      .getByRole('textbox', { name: 'Consumable action name', exact: true })
      .fill('Test Draught')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    const reader = page.getByRole('region', { name: 'Saved player Item reader', exact: true })
    const edited = await page.evaluate(() => window.itemEditorValue)
    assert.equal(edited.sortOrder, 317)
    assert.deepEqual(edited.actions, {
      ...original.actions,
      use: { ...original.actions.use, name: 'Test Draught' },
    })
    assert.deepEqual(edited.ability, original.ability)
    assert.deepEqual(edited.media, original.media)

    await expect(reader.getByRole('heading', { name: 'Test Draught', exact: true })).toBeVisible()
    await expect(
      reader.getByText('Uses per battle', { exact: true }).locator('..').locator('dd'),
    ).toHaveText('4')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(
      editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }),
    ).toHaveValue('21')
    await expect(editor.getByRole('spinbutton', { name: 'Battle uses', exact: true })).toHaveValue(
      '4',
    )
    const beforeClassChoice = await page.evaluate(() => window.itemEditorValue)
    await editor.getByRole('combobox', { name: 'Class', exact: true }).selectOption('gear')
    await editor.getByRole('combobox', { name: 'Type', exact: true }).selectOption('weapon')
    assert.deepEqual(await page.evaluate(() => window.itemEditorValue), beforeClassChoice)
    await expect(
      editor.getByRole('button', { name: 'Apply class and reset behaviors' }),
    ).toBeVisible()
    await editor.getByRole('button', { name: 'Apply class and reset behaviors' }).click()
    await editor.getByRole('combobox', { name: 'Hands', exact: true }).selectOption('2')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await expect(
      reader.getByText('Position', { exact: true }).locator('..').locator('dd'),
    ).toContainText('Main Hand')
    await expect(
      editor.getByRole('combobox', { name: 'Basic Attack action', exact: true }),
    ).toHaveCount(0)
    assert.equal(await page.evaluate(() => window.itemEditorValue.equipment.hands), 2)
    assert.ok(await page.evaluate(() => window.itemEditorValue.actions.attack.behaviorId))
    await editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }).fill('101')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await expect(editor.getByRole('alert')).toContainText('1–100')
    await editor.getByRole('spinbutton', { name: 'Quality Points', exact: true }).fill('50')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
    )
    assert.deepEqual(errors, [])

    await page.goto(new URL('?item=emberbrand', server.resolvedUrls.local[0]).href, {
      waitUntil: 'networkidle',
    })
    const imbuedWeapon = await page.evaluate(() => structuredClone(window.itemEditorValue))
    await expect(editor.getByRole('combobox', { name: 'Support action', exact: true })).toHaveCount(
      0,
    )
    await editor
      .getByRole('textbox', { name: 'Basic Attack name', exact: true })
      .fill('Preserved Strike')
    assert.deepEqual(await page.evaluate(() => window.itemEditorValue), {
      ...imbuedWeapon,
      actions: {
        ...imbuedWeapon.actions,
        attack: { ...imbuedWeapon.actions.attack, name: 'Preserved Strike' },
      },
    })
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await page.goto(
      new URL('?item=sunsplitter&binding=missing', server.resolvedUrls.local[0]).href,
      { waitUntil: 'networkidle' },
    )
    const invalidWeapon = await page.evaluate(() => structuredClone(window.itemEditorValue))
    const repair = editor.getByRole('combobox', { name: 'Basic Attack action', exact: true })
    await expect(repair).toContainText('Unavailable action')
    await expect(repair).toContainText('Behavior 1')
    await repair.selectOption('attack')
    assert.deepEqual(await page.evaluate(() => window.itemEditorValue), {
      ...invalidWeapon,
      actions: {
        ...invalidWeapon.actions,
        attack: { ...invalidWeapon.actions.attack, behaviorId: 'attack' },
      },
    })
    await expect(repair).toHaveCount(0)
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await page.goto(new URL('?item=wardstone-bracer', server.resolvedUrls.local[0]).href, {
      waitUntil: 'networkidle',
    })
    const passive = await page.evaluate(() => structuredClone(window.itemEditorValue))
    await expect(editor.getByRole('combobox', { name: 'Hands', exact: true })).toHaveCount(0)
    await expect(editor.getByRole('combobox', { name: 'Position', exact: true })).toHaveValue(
      'hand',
    )
    await editor.getByRole('combobox', { name: 'Position', exact: true }).selectOption('body')
    assert.deepEqual(await page.evaluate(() => window.itemEditorValue), {
      ...passive,
      itemClass: 'armor',
      equipment: { slot: 'body', hands: 1 },
    })
    await expect(editor.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue('armor')
    await expect(
      editor.getByRole('button', { name: 'Apply class and reset behaviors' }),
    ).toHaveCount(0)
    await editor.getByRole('combobox', { name: 'Position', exact: true }).selectOption('hand')
    assert.deepEqual(await page.evaluate(() => window.itemEditorValue), passive)
    await expect(editor.getByRole('combobox', { name: 'Type', exact: true })).toHaveValue(
      'hand-armor',
    )
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    assert.deepEqual(await page.evaluate(() => window.itemEditorValue), passive)
    await editor.getByRole('spinbutton', { name: 'Minimum level', exact: true }).fill('4')
    await editor.getByRole('spinbutton', { name: 'Base Might', exact: true }).fill('13')
    await editor.getByRole('checkbox', { name: 'Fixture Artificer', exact: true }).check()
    const requirements = {
      minimumLevel: 4,
      minimumCoreStats: { might: 13 },
      disciplineIds: ['discipline.fixture-artificer'],
    }
    assert.deepEqual(
      await page.evaluate(() => window.itemEditorValue.equipRequirements),
      requirements,
    )
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    assert.deepEqual(
      await page.evaluate(() => window.itemEditorValue.equipRequirements),
      requirements,
    )
    await expect(reader).toContainText('Level 4')
    await expect(reader).toContainText('Base Might 13')
    await editor
      .getByRole('textbox', { name: 'Description', exact: true })
      .fill('Preserves optional equip requirements.')
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    assert.deepEqual(
      await page.evaluate(() => window.itemEditorValue.equipRequirements),
      requirements,
    )
    await editor.getByRole('spinbutton', { name: 'Minimum level', exact: true }).fill('')
    await editor.getByRole('spinbutton', { name: 'Base Might', exact: true }).fill('')
    await editor.getByRole('checkbox', { name: 'Fixture Artificer', exact: true }).uncheck()
    await editor.getByRole('button', { name: 'Save definition JSON' }).click()
    await page.reload({ waitUntil: 'networkidle' })
    assert.equal(await page.evaluate(() => window.itemEditorValue.equipRequirements), undefined)
    await page.screenshot({
      path: resolve(output, `item-editor-${viewport.width}.png`),
      fullPage: true,
    })
    console.log(
      `Item editor ${viewport.width}: field containment, single popup help, exact hidden-order/binding preservation, repair, armor positions, serialization, explicit class reset and limits passed.`,
    )
    await page.close()
  }
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
