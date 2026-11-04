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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'arsenal-items-browser-'))
const output =
  process.env.AV_ARSENAL_ITEMS_EVIDENCE_DIR || resolve(tmpdir(), 'arsenal-items-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/arsenal-items-harness.jsx'),
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
// next/image is reached by AbilityEffectEditor → SummonProfileEditor → SkillMediaEditor.
// Next replaces these public build constants; this standalone Vite fixture must do so too.
// Keep real image components and never expose a process object or server environment.
const nextImageBrowserDefines = {
  'process.env.__NEXT_IMAGE_OPTS': 'undefined',
  'process.env.NEXT_DEPLOYMENT_ID': 'undefined',
  'process.env.NEXT_SUPPORTS_IMMUTABLE_ASSETS': 'false',
}
await fs.writeFile(resolve(fixture, 'empty.js'), 'export {}')
await fs.writeFile(
  resolve(fixture, 'next-link.jsx'),
  `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>} `,
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
)
const config = {
  define: nextImageBrowserDefines,
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@item-art-manifest': resolve(root, 'docs/artwork/2026-11-03-starter-items.json'),
      'server-only': resolve(fixture, 'empty.js'),
      'next/navigation': resolve(fixture, 'next-mock.jsx'),
      'next/link': resolve(fixture, 'next-link.jsx'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      '@aurevane/ui': resolve(root, 'packages/ui/src/index.ts'),
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
  for (const viewport of [
    { width: 1728, height: 885 },
    { width: 1536, height: 614 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 1024, height: 576 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    const shellPage = await browser.newPage({ viewport })
    await shellPage.goto(`${server.resolvedUrls.local[0]}?shell=items`, {
      waitUntil: 'networkidle',
    })
    await expect(shellPage.locator('[data-inventory-slot]')).toHaveCount(40)
    await expect(shellPage.getByRole('heading', { name: 'Ready for the road' })).toHaveCount(0)
    await expect(shellPage.getByRole('button', { name: 'Reload Items', exact: true })).toHaveCount(
      0,
    )
    const itemsHeader = await shellPage
      .getByRole('navigation', { name: 'Arsenal sections' })
      .boundingBox()
    await shellPage.goto(`${server.resolvedUrls.local[0]}?shell=nexus`, {
      waitUntil: 'networkidle',
    })
    const nexusHeader = await shellPage
      .getByRole('navigation', { name: 'Arsenal sections' })
      .boundingBox()
    for (const key of ['x', 'y', 'width', 'height']) {
      assert.ok(
        Math.abs(itemsHeader[key] - nexusHeader[key]) <= 1,
        JSON.stringify({ viewport, key, itemsHeader, nexusHeader }),
      )
    }
    await shellPage.goto(`${server.resolvedUrls.local[0]}?shell=items`, {
      waitUntil: 'networkidle',
    })
    const measure = () =>
      shellPage.evaluate(() => {
        const main = document.querySelector('#game-main')
        return {
          mainOverflowY: main.scrollHeight - main.clientHeight,
          pageOverflowX: document.documentElement.scrollWidth - innerWidth,
          pageOverflowY: document.documentElement.scrollHeight - innerHeight,
        }
      })
    const fit = await measure()
    assert.ok(
      fit.pageOverflowX <= 1 &&
        (viewport.width < 981 || (fit.mainOverflowY <= 1 && fit.pageOverflowY <= 1)),
      JSON.stringify({ viewport, fit }),
    )
    const equipment = shellPage.getByRole('region', { name: 'Equipment', exact: true })
    const inventory = shellPage.getByRole('region', { name: 'Inventory', exact: true })
    await expect(equipment.getByRole('button')).toHaveCount(8)
    if (viewport.width >= 981) {
      const equipmentFit = await equipment.evaluate((panel) => ({
        overflow: panel.scrollHeight - panel.clientHeight,
        gridBottom: panel.querySelector('[class*="equipment_"]').getBoundingClientRect().bottom,
        attackTop: panel.querySelector('[class*="attack_"]').getBoundingClientRect().top,
        slots: [...panel.querySelectorAll('button')].map((button) => {
          const box = button.getBoundingClientRect()
          const label = button.querySelector('span').getBoundingClientRect()
          const name = button.querySelector('strong').getBoundingClientRect()
          const helper = button.querySelector('small').getBoundingClientRect()
          return {
            top: box.top,
            bottom: box.bottom,
            labelBottom: label.bottom,
            nameTop: name.top,
            nameBottom: name.bottom,
            helperTop: helper.top,
            helperBottom: helper.bottom,
          }
        }),
      }))
      assert.ok(equipmentFit.overflow <= 1, JSON.stringify({ viewport, equipmentFit }))
      assert.ok(
        equipmentFit.gridBottom <= equipmentFit.attackTop + 1,
        JSON.stringify({ viewport, equipmentFit }),
      )
      for (const slot of equipmentFit.slots)
        assert.ok(
          slot.top >= 0 && slot.bottom <= viewport.height,
          JSON.stringify({ viewport, slot }),
        )
      for (const slot of equipmentFit.slots)
        assert.ok(
          slot.labelBottom <= slot.nameTop + 1 &&
            slot.nameBottom <= slot.helperTop + 1 &&
            slot.helperBottom <= slot.bottom,
          JSON.stringify({ viewport, slot }),
        )
      const inventoryFit = await inventory.evaluate((panel) => {
        const grid = panel.querySelector('[data-inventory-slot]')
        return { toolbar: grid.getBoundingClientRect().top - panel.getBoundingClientRect().top }
      })
      assert.ok(inventoryFit.toolbar <= 176, JSON.stringify({ viewport, inventoryFit }))
    }
    if (viewport.width >= 1280) {
      const firstRow = await shellPage.locator('[data-inventory-slot]').evaluateAll((cells) => {
        const top = cells[0].getBoundingClientRect().top
        return cells.filter((cell) => Math.abs(cell.getBoundingClientRect().top - top) <= 1).length
      })
      assert.equal(firstRow, 6)
    }
    const cardFit = await shellPage.locator('[data-inventory-slot="1"] button').evaluate((card) => {
      const image = card.querySelector('img').getBoundingClientRect()
      const name = card.querySelector('[class*="itemName"]').getBoundingClientRect()
      return {
        imageRatio: image.width / image.height,
        bottomGap: card.getBoundingClientRect().bottom - name.bottom,
      }
    })
    assert.ok(Math.abs(cardFit.imageRatio - 1) <= 0.02, JSON.stringify({ viewport, cardFit }))
    assert.ok(cardFit.bottomGap <= 12, JSON.stringify({ viewport, cardFit }))
    await shellPage.screenshot({
      path: resolve(output, `arsenal-items-shell-${viewport.width}-${viewport.height}.png`),
    })
    await shellPage.getByRole('button', { name: /^Off Hand:/ }).click()
    await expect(shellPage.getByRole('dialog')).toBeVisible()
    await expect(shellPage.getByRole('region', { name: 'Equipment comparison' })).toHaveCount(0)
    await expect(
      shellPage.getByRole('button', { name: 'Unequip Off Hand', exact: true }),
    ).toBeVisible()
    if (viewport.width >= 981) {
      const dialogFit = await shellPage.getByRole('dialog').evaluate((dialog) => {
        const body = dialog.querySelector('[class*="dialogBody"]')
        return body.scrollHeight - body.clientHeight
      })
      assert.ok(dialogFit <= 1, JSON.stringify({ viewport, dialogFit }))
    }
    await shellPage.keyboard.press('Escape')
    await shellPage.locator('[data-inventory-slot="40"]').scrollIntoViewIfNeeded()
    if (viewport.width >= 981) {
      assert.ok((await measure()).mainOverflowY <= 1)
      const last = await shellPage.locator('[data-inventory-slot="40"]').boundingBox()
      assert.ok(last.y >= 0 && last.y + last.height <= viewport.height + 1)
    }
    await shellPage.close()
  }
  console.log(
    'Arsenal production shell: nine viewports, shared header geometry, internal scroll reachability and hand details passed',
  )
  for (const presentation of ['masculine', 'feminine', 'androgynous']) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    await page.goto(`${server.resolvedUrls.local[0]}?shell=items&presentation=${presentation}`, {
      waitUntil: 'networkidle',
    })
    const template = page.locator(`[data-equipment-template="${presentation}"] img`)
    await expect(template).toHaveAttribute(
      'src',
      `/media/art/items/equipment-${presentation}-v01.webp`,
    )
    await template.evaluate((image) => image.decode())
    assert.ok(await template.evaluate((image) => image.naturalHeight > 0))
    await expect(page.locator('[data-equipment-position]')).toHaveCount(8)
    await page.screenshot({ path: resolve(output, `arsenal-equipment-${presentation}.png`) })
    await page.close()
  }
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ]) {
    const page = await browser.newPage({
      viewport,
      ...(viewport.width < 500 ? { hasTouch: true, isMobile: true } : {}),
    })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/_next/image?*', async (route) => {
      const url = new URL(route.request().url())
      await route.continue({
        url: new URL(url.searchParams.get('url'), server.resolvedUrls.local[0]).href,
      })
    })
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
    await expect(page.locator('[data-inventory-slot]')).toHaveCount(40)
    await expect(page.getByText('66 / 100 QP', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Slot 2: Ember-Stitched Cowl/ }).click()
    const cowlDialog = page.getByRole('dialog')
    const reportRows = cowlDialog.locator('[data-ability-parameters] dl > div')
    assert.ok((await reportRows.count()) >= 8)
    const rowFit = await reportRows.first().evaluate((row) => {
      const label = row.querySelector('dt').getBoundingClientRect()
      const value = row.querySelector('dd').getBoundingClientRect()
      return {
        sameRow: Math.abs(label.top - value.top) <= 1,
        separateColumns: value.left >= label.right,
      }
    })
    assert.ok(rowFit.sameRow && rowFit.separateColumns, JSON.stringify({ viewport, rowFit }))
    if (viewport.width >= 981) {
      const fit = await cowlDialog.evaluate((dialog) => {
        const body = dialog.querySelector('[class*="dialogBody"]')
        return body.scrollHeight - body.clientHeight
      })
      assert.ok(fit <= 1, JSON.stringify({ viewport, cowlDialogOverflow: fit }))
    }
    await page.screenshot({ path: resolve(output, `arsenal-cowl-detail-${viewport.width}.png`) })
    await page.keyboard.press('Escape')
    const image = page
      .locator('img[src="/media/art/items/thumbnails/wayfarer-hood-v01.webp"]')
      .first()
    assert(
      await image.evaluate((img) => img.complete && img.naturalWidth === 256),
      'real thumbnail decoded',
    )
    const hood = page.getByRole('button', { name: /Slot 1: Wayfarer Hood/ })
    await hood.focus()
    await page.keyboard.press('Enter')
    let dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator(':scope > section')).toHaveAttribute('data-av-surface', 'ink')
    await expect(dialog.getByRole('img', { name: 'Wayfarer Hood', exact: true })).toBeVisible()
    const bounds = await dialog.locator(':scope > section').boundingBox()
    assert(
      bounds.x >= 8 && bounds.x + bounds.width <= viewport.width - 8,
      'detail panel fits inside viewport',
    )
    await page.screenshot({
      path: resolve(output, `arsenal-item-detail-${viewport.width}.png`),
      fullPage: false,
    })
    await page.keyboard.press('Tab')
    assert(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      'detail retains keyboard focus',
    )
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(hood).toBeFocused()
    await hood.click()
    if (viewport.width < 500) await page.touchscreen.tap(2, 2)
    else await page.mouse.click(2, 2)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(hood).toBeFocused()
    await page.evaluate(() => window.setItemEnabled('iron-shortsword', false))
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('combobox', { name: 'Filter', exact: true }).selectOption('unavailable')
    await expect(page.locator('[data-inventory-slot] button')).toHaveCount(2)
    await expect(page.locator('[data-inventory-slot="1"] button')).toHaveCount(1)
    await expect(page.locator('[data-inventory-slot="2"] button')).toHaveCount(1)
    await expect(page.locator('[data-inventory-slot="3"] button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Slot \d+: Iron Shortsword/ })).toBeVisible()
    await page.getByRole('combobox', { name: 'Filter', exact: true }).selectOption('equippable')
    await expect(page.getByRole('button', { name: /Slot \d+: Iron Shortsword/ })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Filter', exact: true }).selectOption('all')
    await expect(page.locator('[data-inventory-slot] button')).toHaveCount(22)
    await page.evaluate(() => window.setItemEnabled('iron-shortsword', true))
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Slot \d+: Warden Helm/ }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Confirm replacement: Head/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirm swap · Head', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('87 / 100 QP', { exact: true })).toBeVisible()
    let last = await page.evaluate(() => window.calls.at(-1))
    assert.deepEqual(last.replacePositions, ['head'])
    assert.equal(last.expectedRevision, 1)
    assert.equal(last.catalogueToken, 'a'.repeat(32))
    await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('quality-points')
    await page.getByRole('button', { name: 'Save order', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('Items saved.')
    const before = await page
      .locator('[data-inventory-slot] button')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')))
    await page.reload({ waitUntil: 'networkidle' })
    assert.deepEqual(
      await page
        .locator('[data-inventory-slot] button')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label'))),
      before,
    )
    await expect(page.getByRole('button', { name: 'Head: Warden Helm', exact: true })).toBeVisible()
    const callsBeforeSearch = await page.evaluate(() => window.calls.length)
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Sunsplitter')
    await expect(page.locator('[data-inventory-slot] button')).toHaveCount(1)
    await expect(page.locator('[data-inventory-slot="1"] button')).toHaveAttribute(
      'title',
      'Sunsplitter',
    )
    assert.equal(await page.evaluate(() => window.calls.length), callsBeforeSearch)
    await page.getByRole('button', { name: /Slot \d+: Sunsplitter/ }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Short by 12 QP/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirm swap · Main Hand' })).toBeDisabled()
    // Follow the real forward tab order, then reverse it, without locator.focus or pointer input.
    const closeItem = dialog.getByRole('button', { name: 'Close', exact: true })
    const equipPosition = dialog.getByRole('combobox', { name: 'Equip position' })
    const comparison = dialog.locator('summary')
    const optionalRemovals = await dialog.getByRole('checkbox').all()
    const confirmSwap = dialog.getByRole('button', { name: 'Confirm swap · Main Hand' })
    if (!(await closeItem.evaluate((el) => el === document.activeElement)))
      await page.keyboard.press('Tab')
    await expect(closeItem).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(equipPosition).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(comparison).toBeFocused()
    for (const checkbox of optionalRemovals) {
      await page.keyboard.press('Tab')
      await expect(checkbox).toBeFocused()
      if (
        (await checkbox.getAttribute('type')) === 'checkbox' &&
        (await checkbox.locator('..').textContent()).includes('Body · Stormweave Robe')
      ) {
        await page.keyboard.press('Space')
        await expect(checkbox).toBeChecked()
      }
    }
    await expect(dialog.getByText(/Confirm replacement:.*Body \(Stormweave Robe\)/)).toBeVisible()
    await expect(confirmSwap).toBeEnabled()
    await page.keyboard.press('Tab')
    await expect(confirmSwap).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeItem).toBeFocused()
    const forwardOrder = [closeItem, equipPosition, comparison, ...optionalRemovals, confirmSwap]
    for (const control of [...forwardOrder].reverse()) {
      await page.keyboard.press('Shift+Tab')
      await expect(control).toBeFocused()
    }
    for (const control of forwardOrder.slice(1)) {
      await page.keyboard.press('Tab')
      await expect(control).toBeFocused()
    }
    await page.screenshot({ path: resolve(output, `arsenal-keyboard-swap-${viewport.width}.png`) })
    await page.keyboard.press('Enter')
    await expect(page.getByText('92 / 100 QP', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Off Hand: Occupied by two-handed weapon', exact: true }),
    ).toBeVisible()
    last = await page.evaluate(() => window.calls.at(-1))
    assert.deepEqual(last.replacePositions, ['main-hand', 'off-hand', 'body'])
    await page.getByRole('button', { name: 'Main Hand: Sunsplitter', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Unequip Main Hand', exact: true })
      .click()
    await expect(page.getByText('42 / 100 QP', { exact: true })).toBeVisible()
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('')
    await page.getByRole('button', { name: 'Battle Items', exact: true }).click()
    await page.getByRole('button', { name: /Slot 1: Mender Salve, quantity 12/ }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/3 uses per battle\. Uses refill/)).toBeVisible()
    await expect(dialog.locator('[data-ability-parameters]')).toHaveCount(1)
    await dialog.getByRole('button', { name: 'Equip · Consumable 1', exact: true }).click()
    await page.getByRole('button', { name: /Slot 1: Mender Salve, quantity 12/ }).click()
    await page
      .getByRole('dialog')
      .getByRole('combobox', { name: 'Equip position' })
      .selectOption('consumable-2')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Equip · Consumable 2', exact: true })
      .click()
    await expect(page.getByText('58 / 100 QP', { exact: true })).toBeVisible()
    await page.reload({ waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: 'Consumable 1: Mender Salve', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Consumable 2: Mender Salve', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Consumable 2: Mender Salve', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Unequip Consumable 2', exact: true })
      .click()
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Wardstone')
    await page.getByRole('button', { name: /Slot \d+: Wardstone Bracer/ }).click()
    await page
      .getByRole('dialog')
      .getByRole('combobox', { name: 'Equip position' })
      .selectOption('off-hand')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Equip · Off Hand', exact: true })
      .click()
    // Existing single Support selector, with five current Basic choices and equipped grants.
    await page.getByRole('button', { name: /Manage Techniques/ }).click()
    const supportTab = page.getByRole('tab', { name: 'Support', exact: true })
    if (await supportTab.isVisible()) await supportTab.click()
    await expect(
      page.getByRole('radio', { name: 'Warding Prayer · Off Hand', exact: true }),
    ).toBeVisible()
    await page.getByRole('radio', { name: 'Warding Prayer · Off Hand', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    last = await page.evaluate(() => window.calls.at(-1))
    assert.deepEqual(last.selection, {
      kind: 'equipment',
      position: 'off-hand',
      itemId: 'wardstone-bracer',
      behaviorId: 'ward',
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(() => {
      window.testState.deferRead = true
    })
    await page.getByRole('button', { name: /Manage Techniques/ }).click()
    if (await supportTab.isVisible()) await supportTab.click()
    await expect(
      page.getByRole('radio', { name: 'Warding Prayer · Off Hand', exact: true }),
    ).toBeChecked()
    await page.getByRole('radio', { name: 'HP Recovery', exact: true }).click()
    if (viewport.width < 500)
      await page.getByRole('button', { name: 'Use as Support Action', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'HP Recovery', exact: true })).toBeChecked()
    // A late GET from opening the selector must not restore the old equipment choice.
    await page.evaluate(() => window.releaseItemRead())
    await expect(page.getByRole('radio', { name: 'HP Recovery', exact: true })).toBeChecked()
    await expect(
      page.getByRole('radio', { name: 'Warding Prayer · Off Hand', exact: true }),
    ).not.toBeChecked()
    await page.getByRole('radio', { name: 'Warding Prayer · Off Hand', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Off Hand: Wardstone Bracer', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Unequip Off Hand', exact: true })
      .click()
    await expect(page.getByRole('status')).toContainText('previous Basic Support Action')
    await page.evaluate(() => window.archiveEquipment())
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('Repair equipment', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Head: Unavailable Item', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Unequip Head', exact: true })
      .click()
    await expect(page.getByText('Repair equipment', { exact: true })).toHaveCount(0)
    await page.evaluate(() => {
      window.testState.failNext = true
    })
    await page.getByRole('button', { name: 'Save order', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Items changed.')
    await expect(page.getByRole('button', { name: 'Save order', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Reload Items', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save order', exact: true })).toBeEnabled()
    await page.evaluate(() => window.setBattleLocked(true))
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('status')).toContainText('locked during a pending or active battle')
    await expect(page.getByRole('button', { name: 'Save order', exact: true })).toBeDisabled()
    await page.evaluate(() => window.setBattleLocked(false))
    await page.getByRole('button', { name: 'Reload Items', exact: true }).click()
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('')
    await page.screenshot({
      path: resolve(output, `arsenal-items-${viewport.width}.png`),
      fullPage: true,
    })
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'page does not overflow',
    )
    // Exercise the two existing callers of the shared dialog, including pending-request behavior.
    await page.goto(`${server.resolvedUrls.local[0]}?roster`, { waitUntil: 'networkidle' })
    for (const caller of [
      {
        opener: 'Delete Character',
        name: 'Schedule deletion of Aurelia?',
        input: /Type exactly:/,
        value: 'DELETE Aurelia',
        cancel: 'Cancel',
        confirm: 'Start 24-hour deletion',
      },
      {
        opener: 'Permanently delete login and game data',
        name: 'Delete your entire AUREVANE account?',
        input: 'Current account password',
        value: 'native-fixture-only',
        cancel: 'Never mind',
        confirm: 'Start 24-hour account deletion',
      },
    ]) {
      const opener = page.getByRole('button', { name: caller.opener, exact: true })
      await opener.click()
      const modal = page.getByRole('dialog', { name: caller.name, exact: true })
      const input = modal.getByLabel(caller.input)
      const cancel = modal.getByRole('button', { name: caller.cancel, exact: true })
      const confirm = modal.getByRole('button', { name: caller.confirm, exact: true })
      await input.fill(caller.value)
      await expect(input).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(cancel).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(confirm).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(input).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(confirm).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(cancel).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(input).toBeFocused()
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      await expect(input).toBeDisabled()
      await expect(modal.locator(':scope > section')).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(modal.locator(':scope > section')).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(modal).toBeVisible()
      if (viewport.width < 500) await page.touchscreen.tap(2, 2)
      else await page.mouse.click(2, 2)
      await expect(modal).toBeVisible()
      await page.evaluate(() => window.releaseDeletion())
      await expect(input).toBeEnabled()
      await page.keyboard.press('Tab')
      await expect(input).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(modal).toHaveCount(0)
      await expect(opener).toBeFocused()
      await opener.click()
      if (viewport.width < 500) await page.touchscreen.tap(2, 2)
      else await page.mouse.click(2, 2)
      await expect(modal).toHaveCount(0)
      await expect(opener).toBeFocused()
    }
    assert.deepEqual(await page.evaluate(() => window.deletionCalls), [
      { url: '/api/characters/roster-fixture/deletion', method: 'POST' },
      { url: '/api/account/deletion', method: 'POST' },
    ])
    assert.equal(await page.evaluate(() => document.documentElement.style.overflow), '')
    assert.deepEqual(errors, [])
    await page.close()
    console.log(
      `Arsenal ${viewport.width}: keyboard swap, reverse traversal, deletion caller busy/focus, request CAS, QP, dual stacks, Support fallback, repair, reload, art and layout passed`,
    )
  }
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
