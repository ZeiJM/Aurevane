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
const selectedViewport = process.env.AV_ARSENAL_ITEMS_VIEWPORT
const includeViewport = ({ width, height }) =>
  !selectedViewport || selectedViewport === `${width}x${height}`
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
  const profile = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await profile.goto(`${server.resolvedUrls.local[0]}?profile`, { waitUntil: 'networkidle' })
  const evasionBonus = profile.locator('[data-equipment-stat-delta="100"]')
  await evasionBonus.hover()
  const sources = profile.getByTestId('profile-detail-popover')
  await expect(sources).toContainText('Wayfarer Hood: +1%')
  await expect(sources).not.toContainText('Base:')
  await expect(sources).not.toContainText('Baseline ability')
  await expect(sources.getByRole('listitem')).toHaveCount(1)
  await profile.keyboard.press('Escape')
  await evasionBonus.click()
  await expect(sources).toContainText('Wayfarer Hood: +1%')
  await profile.screenshot({ path: resolve(output, 'profile-equipment-bonus-sources.png') })
  await profile.keyboard.press('Escape')
  await profile.getByTestId('derived-stat-evasion').focus()
  await profile.keyboard.press('Enter')
  await expect(sources).toContainText('Baseline ability')
  await profile.close()
  console.log(
    'Profile equipment bonuses: hover/click lists only equipment; keyboard stat help remains available',
  )
  const evasion = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await evasion.goto(`${server.resolvedUrls.local[0]}?shell=items&evasion`, {
    waitUntil: 'networkidle',
  })
  await evasion.getByRole('button', { name: 'Head: Wayfarer Hood', exact: true }).click()
  await expect(
    evasion.getByRole('dialog').getByRole('list', { name: 'Equipment stat changes' }),
  ).toHaveCount(0)
  await evasion.close()
  console.log('Armor bonuses: effects remain visible without a duplicate stat footer')
  const automatic = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await automatic.goto(`${server.resolvedUrls.local[0]}?shell=items`, { waitUntil: 'networkidle' })
  const automaticSort = automatic.getByRole('combobox', { name: 'Sort', exact: true })
  await automaticSort.selectOption('quality-points')
  await expect.poll(() => automatic.evaluate(() => window.calls.length)).toBe(1)
  await expect.poll(() => automatic.evaluate(() => window.itemReads)).toBe(1)
  assert.equal((await automatic.evaluate(() => window.calls[0])).action, 'sort')
  await expect(automatic.getByRole('button', { name: 'Save order', exact: true })).toHaveCount(0)
  await expect(automatic.getByRole('button', { name: 'Reload Items', exact: true })).toHaveCount(0)
  await expect(automatic.getByText('Items saved.', { exact: true })).toHaveCount(0)
  await automatic.getByRole('combobox', { name: 'Filter', exact: true }).selectOption('slot:head')
  await automatic.getByRole('button', { name: 'Companion', exact: true }).click()
  await expect(automatic.getByRole('combobox', { name: 'Filter', exact: true })).toHaveCount(0)
  await expect(automatic.getByRole('option', { name: 'Quality Points', exact: true })).toHaveCount(
    0,
  )
  await expect(automatic.getByRole('option', { name: 'Quantity', exact: true })).toHaveCount(1)
  await expect(automatic.locator('[data-inventory-slot] button')).toHaveCount(3)
  await automatic.getByRole('button', { name: 'Consumables', exact: true }).click()
  await expect(automatic.getByRole('option', { name: 'Armor', exact: true })).toHaveCount(0)
  await expect(automatic.getByRole('option', { name: 'Weapon', exact: true })).toHaveCount(0)
  await expect(automatic.getByRole('option', { name: 'Unavailable', exact: true })).toHaveCount(0)
  await automatic.getByRole('button', { name: 'Gear', exact: true }).click()
  await expect(automatic.getByRole('combobox', { name: 'Filter', exact: true })).toHaveValue('all')
  await automatic.evaluate(() => {
    window.testState.failNext = true
  })
  await automaticSort.selectOption('tier')
  await expect.poll(() => automatic.evaluate(() => window.itemReads)).toBe(2)
  await expect(automatic.getByRole('alert')).toContainText('Items changed.')
  await expect(automaticSort).toBeEnabled()
  assert.equal(
    await automatic.evaluate(() => window.calls.length),
    2,
    'stale mutation is not replayed',
  )
  await automatic.evaluate(() => {
    window.testState.rejectNext = 'Inventory space is full.'
  })
  await automaticSort.selectOption('newest')
  await expect.poll(() => automatic.evaluate(() => window.itemReads)).toBe(3)
  await expect(automatic.getByRole('alert')).toContainText('Inventory space is full.')
  assert.equal(
    await automatic.evaluate(() => window.calls.length),
    3,
    'rejected mutation is not replayed',
  )
  await automatic.evaluate(() => {
    window.testState.failNext = true
    window.testState.failRead = true
  })
  await automaticSort.selectOption('class')
  await expect.poll(() => automatic.evaluate(() => window.itemReads)).toBe(4)
  await expect(automaticSort).toBeDisabled()
  await automatic.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => automatic.evaluate(() => window.itemReads)).toBe(5)
  await expect(automaticSort).toBeEnabled()
  assert.equal(
    await automatic.evaluate(() => window.calls.length),
    4,
    'refresh recovery never retries writes',
  )
  await automatic.evaluate(() => window.setBattleLocked(true))
  await automatic.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(automaticSort).toBeDisabled()
  await automatic.evaluate(() => window.setBattleLocked(false))
  await automatic.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(automaticSort).toBeEnabled()
  await automatic.close()
  const recovery = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await recovery.goto(`${server.resolvedUrls.local[0]}?shell=items&missing&read-failure`, {
    waitUntil: 'networkidle',
  })
  await expect(recovery.getByRole('alert')).toContainText('Current Items could not be refreshed.')
  assert.equal(
    await recovery.evaluate(() => window.itemReads),
    1,
    'failed initial load has one bounded read',
  )
  await recovery.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(recovery.locator('[data-inventory-slot]')).toHaveCount(40)
  assert.equal(await recovery.evaluate(() => window.itemReads), 2)
  await recovery.getByRole('button', { name: /Slot \d+: Warden Helm/ }).click()
  await recovery.evaluate(() => {
    window.testState.rejectNext = 'Equipment cannot change during deletion.'
  })
  await recovery.getByRole('button', { name: 'Equip', exact: true }).click()
  await expect(recovery.getByRole('dialog').getByRole('alert')).toContainText(
    'Equipment cannot change during deletion.',
  )
  assert.equal(await recovery.evaluate(() => window.calls.length), 1)
  await expect(
    recovery.getByRole('button', { name: 'Head: Wayfarer Hood', exact: true }),
  ).toBeAttached()
  await expect(recovery.getByRole('button', { name: 'Equip', exact: true })).toBeEnabled()
  await recovery.evaluate(() => {
    window.testState.dropResponse = true
  })
  await recovery.getByRole('button', { name: 'Equip', exact: true }).click()
  await expect(recovery.getByRole('dialog').getByRole('alert')).toContainText(
    'The save confirmation was lost.',
  )
  await expect(
    recovery.getByRole('button', { name: 'Head: Warden Helm', exact: true }),
  ).toBeAttached()
  await expect(recovery.getByRole('button', { name: 'Unequip', exact: true })).toBeEnabled()
  assert.equal(
    await recovery.evaluate(() => window.calls.length),
    2,
    'lost confirmation recovers the committed state without replay',
  )
  assert.equal(await recovery.evaluate(() => window.itemReads), 4)
  await recovery.close()
  const simple = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await simple.route('**/_next/image?*', async (route) => {
    const url = new URL(route.request().url())
    await route.continue({
      url: new URL(url.searchParams.get('url'), server.resolvedUrls.local[0]).href,
    })
  })
  await simple.goto(`${server.resolvedUrls.local[0]}?shell=items`, { waitUntil: 'networkidle' })
  await simple.getByRole('button', { name: /Slot \d+: Ember-Stitched Cowl/ }).click()
  await expect(
    simple.getByRole('dialog').getByRole('button', { name: 'Equip', exact: true }),
  ).toBeVisible()
  await expect(
    simple.getByRole('dialog').getByText('Compare & equip', { exact: true }),
  ).toHaveCount(0)
  await expect(simple.getByRole('dialog').getByRole('combobox')).toHaveCount(0)
  await expect(simple.getByRole('dialog').getByRole('checkbox')).toHaveCount(0)
  await expect(simple.getByRole('dialog').getByLabel('Equipment stat changes')).toBeVisible()
  await expect
    .poll(() =>
      simple
        .getByRole('dialog')
        .locator('img')
        .first()
        .evaluate((image) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true)
  await simple.screenshot({ path: resolve(output, 'arsenal-current-equip-popup-1366.png') })
  await simple.getByRole('dialog').getByRole('button', { name: 'Equip', exact: true }).click()
  await expect(
    simple.getByRole('button', { name: 'Head: Ember-Stitched Cowl', exact: true }),
  ).toBeAttached()
  await simple.getByRole('button', { name: 'Head: Ember-Stitched Cowl', exact: true }).click()
  await expect(
    simple.getByRole('dialog').getByRole('button', { name: 'Unequip', exact: true }),
  ).toBeVisible()
  await expect(simple.getByRole('dialog').locator('[data-equipment-stat-change]')).toHaveCount(0)
  await simple.keyboard.press('Escape')
  await simple.getByRole('button', { name: 'Materials', exact: true }).click()
  await simple.locator('[data-inventory-slot] button').first().click()
  await expect(
    simple.getByRole('dialog').getByRole('button', { name: 'Cannot be equipped', exact: true }),
  ).toBeDisabled()
  await expect(
    simple.getByRole('dialog').getByText('Flavor and future-purpose Item.', { exact: false }),
  ).toHaveCount(0)
  await simple.close()

  console.log(
    'Automatic Item persistence: immediate sort, category controls, single refresh, failure visibility, no mutation replay, focus recovery and battle locks passed',
  )
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
  ].filter(includeViewport)) {
    console.log(`Checking Items shell ${viewport.width}x${viewport.height}`)
    const shellPage = await browser.newPage({ viewport })
    await shellPage.route('**/_next/image?*', async (route) => {
      const url = new URL(route.request().url())
      await route.continue({
        url: new URL(url.searchParams.get('url'), server.resolvedUrls.local[0]).href,
      })
    })
    await shellPage.goto(`${server.resolvedUrls.local[0]}?shell=items&longNames`, {
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
    await shellPage.goto(`${server.resolvedUrls.local[0]}?shell=nexus&longNames`, {
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
    await shellPage.goto(`${server.resolvedUrls.local[0]}?shell=items&longNames`, {
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
    await expect(equipment.getByRole('button')).toHaveCount(8)
    for (const category of ['Gear', 'Consumables']) {
      await shellPage.getByRole('button', { name: category, exact: true }).click()
      await expect(shellPage.locator(`[aria-label="${category} inventory slots"]`)).toBeVisible()
      const nameFit = await shellPage
        .locator(
          '[data-equipment-position] button strong, [data-inventory-slot] [class*="itemName"]',
        )
        .evaluateAll((names) =>
          names.map((name) => {
            const box = name.getBoundingClientRect()
            const card = name.closest('button').getBoundingClientRect()
            const text = name.firstChild
            const wordRects =
              text?.nodeType === Node.TEXT_NODE
                ? [...text.textContent.matchAll(/[^\s-]+/gu)].map((word) => {
                    const range = document.createRange()
                    range.setStart(text, word.index)
                    range.setEnd(text, word.index + word[0].length)
                    return [...range.getClientRects()].map((rect) => ({
                      left: rect.left,
                      right: rect.right,
                    }))
                  })
                : []
            return {
              name: name.textContent,
              contentHeight: name.scrollHeight,
              availableHeight: name.clientHeight,
              contentWidth: name.scrollWidth,
              availableWidth: name.clientWidth,
              nameLeft: box.left,
              nameRight: box.right,
              cardLeft: card.left,
              cardRight: card.right,
              clipped:
                name.scrollHeight > name.clientHeight + 1 ||
                name.scrollWidth > name.clientWidth + 1 ||
                box.bottom > card.bottom + 1 ||
                box.left < card.left - 1 ||
                box.right > card.right + 1,
              brokenWords: wordRects.some((rects) => rects.length > 1),
              outside: wordRects
                .flat()
                .some((rect) => rect.left < box.left - 1 || rect.right > box.right + 1),
            }
          }),
        )
      assert.ok(
        nameFit.every((name) => !name.clipped && !name.brokenWords && !name.outside),
        JSON.stringify({ viewport, category, nameFit }),
      )
    }
    await shellPage.getByRole('button', { name: 'Gear', exact: true }).click()
    await expect(shellPage.locator('[aria-label="Gear inventory slots"]')).toBeVisible()
    const equipmentFit = await equipment.evaluate((panel) => ({
      overflow: panel.scrollHeight - panel.clientHeight,
      panelBottom: panel.getBoundingClientRect().bottom,
      budgetBottom: panel.querySelector('meter').getBoundingClientRect().bottom,
      gridTop: panel.querySelector('[class*="equipment_"]').getBoundingClientRect().top,
      gridBottom: panel.querySelector('[class*="equipment_"]').getBoundingClientRect().bottom,
      attackTop: panel.querySelector('[class*="attack_"]').getBoundingClientRect().top,
      slots: [...panel.querySelectorAll('button')].map((button) => {
        const box = button.getBoundingClientRect()
        const label = button.parentElement
          .querySelector('[class*="positionName"]')
          .getBoundingClientRect()
        const name = button.querySelector('strong').getBoundingClientRect()
        const helper = button.querySelector('small').getBoundingClientRect()
        const image = button.querySelector('img,[class*="emptyIcon"]').getBoundingClientRect()
        return {
          left: box.left,
          right: box.right,
          top: box.top,
          bottom: box.bottom,
          cellBottom: button.parentElement.getBoundingClientRect().bottom,
          labelTop: label.top,
          labelBottom: label.bottom,
          nameTop: name.top,
          nameBottom: name.bottom,
          helperTop: helper.top,
          helperBottom: helper.bottom,
          helperLeft: helper.left,
          helperRight: helper.right,
          imageLeft: image.left,
          imageRight: image.right,
          nameLeft: name.left,
          imageTop: image.top,
          imageBottom: image.bottom,
          imageWidth: image.width,
          imageHeight: image.height,
          centered: Math.abs((image.left + image.right) / 2 - (box.left + box.right) / 2),
        }
      }),
    }))
    if (viewport.width >= 981) {
      assert.ok(equipmentFit.overflow <= 1, JSON.stringify({ viewport, equipmentFit }))
      assert.ok(
        equipmentFit.slots.every((slot) => slot.bottom <= equipmentFit.panelBottom),
        JSON.stringify({ viewport, equipmentFit }),
      )
    }
    assert.ok(
      equipmentFit.gridBottom <= equipmentFit.attackTop + 1,
      JSON.stringify({ viewport, equipmentFit }),
    )
    for (const slot of equipmentFit.slots) {
      assert.ok(
        slot.nameTop >= slot.top &&
          slot.top >= Math.max(equipmentFit.gridTop, equipmentFit.budgetBottom) - 1 &&
          slot.labelTop >= slot.bottom &&
          slot.labelBottom <= slot.cellBottom &&
          slot.labelBottom <= Math.min(equipmentFit.gridBottom, equipmentFit.attackTop) + 1 &&
          (viewport.width >= 981
            ? viewport.height <= 660
              ? slot.imageTop >= slot.top &&
                slot.imageBottom <= slot.bottom &&
                slot.nameLeft >= slot.imageRight + 2 &&
                slot.nameBottom <= slot.helperTop + 1 &&
                slot.helperBottom <= slot.bottom &&
                slot.helperLeft >= slot.left &&
                slot.helperRight <= slot.right
              : slot.imageTop >= slot.top &&
                slot.imageBottom <= slot.nameTop + 1 &&
                slot.nameBottom <= slot.bottom &&
                slot.helperTop >= slot.top &&
                slot.helperBottom <= slot.nameTop + 1 &&
                slot.helperLeft >= slot.left &&
                slot.helperRight <= slot.right &&
                slot.centered <= 1
            : slot.nameBottom <= slot.helperTop + 1 &&
              slot.helperBottom <= slot.imageTop + 1 &&
              slot.imageBottom <= slot.labelTop + 1 &&
              slot.centered <= 1),
        JSON.stringify({ viewport, slot }),
      )
      assert.ok(slot.left >= 0 && slot.right <= viewport.width, JSON.stringify({ viewport, slot }))
    }
    const imageGeometry = await shellPage
      .locator('[data-inventory-slot="1"] img')
      .evaluate((image) => {
        const box = image.getBoundingClientRect()
        return { width: box.width, height: box.height }
      })
    for (const slot of equipmentFit.slots) {
      assert.ok(
        Math.abs(slot.imageWidth - imageGeometry.width) <= 1 &&
          Math.abs(slot.imageHeight - imageGeometry.height) <= 1,
        JSON.stringify({ viewport, slot, imageGeometry }),
      )
    }
    const referenceSize =
      viewport.width <= 820
        ? Math.min(52, Math.max(24, Math.min(viewport.width * 0.11, viewport.height * 0.07)))
        : viewport.width <= 880
          ? viewport.width > 820
            ? viewport.height <= 620
              ? 46
              : 44
            : 68
          : viewport.width <= 1100
            ? viewport.height <= 620
              ? 57
              : 61
            : viewport.height <= 700
              ? 69
              : 81
    assert.ok(
      Math.abs(imageGeometry.width - referenceSize) <= 1,
      JSON.stringify({ viewport, imageGeometry, referenceSize }),
    )
    if (viewport.width >= 981) {
      await shellPage.getByRole('button', { name: /^Consumable 2:/ }).scrollIntoViewIfNeeded()
      const lastEquipment = await shellPage
        .getByRole('button', { name: /^Consumable 2:/ })
        .boundingBox()
      assert.ok(
        lastEquipment.y >= 0 && lastEquipment.y + lastEquipment.height <= viewport.height + 1,
      )
      await equipment.evaluate((panel) => {
        panel.scrollTop = 0
      })
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
    await expect(shellPage.getByRole('button', { name: 'Unequip', exact: true })).toBeVisible()
    if (viewport.width >= 981) {
      const dialogFit = await shellPage.getByRole('dialog').evaluate((dialog) => {
        const body = dialog.querySelector('[class*="dialogBody"]')
        return {
          overflow: body.scrollHeight - body.clientHeight,
          height: body.clientHeight,
          fullHeight: body.scrollHeight,
          sections: [...body.children].map((child) => ({
            height: child.getBoundingClientRect().height,
            width: child.getBoundingClientRect().width,
            text: child.textContent.slice(0, 100),
          })),
        }
      })
      if (dialogFit.overflow > 1)
        await shellPage.screenshot({
          path: resolve(output, `arsenal-dialog-fit-${viewport.width}-${viewport.height}.png`),
        })
      assert.ok(dialogFit.overflow <= 1, JSON.stringify({ viewport, dialogFit }))
    }
    await shellPage.keyboard.press('Escape')
    if ([1366, 390, 412].includes(viewport.width)) {
      for (const [name, technique, artwork] of [
        ['Stormcaller Staff', 'Storm Ward', 'stormcaller-staff'],
        ['Twinfang Blade', 'Quickstep', 'twinfang-blade'],
        ['Tower Shield', 'Tower Guard', 'tower-shield'],
        ['Emberbrand', 'Kindle', 'emberbrand'],
      ]) {
        await shellPage
          .getByRole('button', { name: new RegExp(`^Slot \\d+: ${name},`) })
          .first()
          .click()
        const popup = shellPage.getByRole('dialog')
        await expect(popup.getByRole('img', { name, exact: true })).toBeVisible()
        await popup.getByRole('tab', { name: 'Imbued Technique', exact: true }).click()
        const image = popup.getByRole('img', { name: technique, exact: true })
        await expect(image).toBeVisible()
        await expect
          .poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0))
          .toBe(true)
        assert.ok((await image.getAttribute('src')).includes(`${artwork}-technique-v01.webp`))
        await popup.getByRole('tab', { name: 'Imbued Technique', exact: true }).press('Home')
        await expect(popup.getByRole('img', { name, exact: true })).toBeVisible()
        await expect(popup.getByRole('img', { name: technique, exact: true })).toHaveCount(0)
        await shellPage.keyboard.press('Escape')
      }
    }
    await shellPage.locator('[data-inventory-slot="40"]').scrollIntoViewIfNeeded()
    if (viewport.width >= 981) {
      assert.ok((await measure()).mainOverflowY <= 1)
      const last = await shellPage.locator('[data-inventory-slot="40"]').boundingBox()
      assert.ok(last.y >= 0 && last.y + last.height <= viewport.height + 1)
    }
    await shellPage.close()
  }
  console.log(
    'Arsenal production shell: nine viewports, shared header geometry, no-scroll equipment fit, inventory reachability and hand details passed',
  )
  for (const presentation of selectedViewport ? [] : ['masculine', 'feminine', 'androgynous']) {
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
  ].filter(includeViewport)) {
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
    await expect(page.getByText('66 / 100 QP', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: /Slot \d+: Warden Helm/ }).click()
    let dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('combobox')).toHaveCount(0)
    await expect(dialog.getByRole('checkbox')).toHaveCount(0)
    const close = dialog.getByRole('button', { name: 'Close', exact: true })
    const equip = dialog.getByRole('button', { name: 'Equip', exact: true })
    const closeBox = await close.boundingBox()
    assert.ok(closeBox.width < 140 && closeBox.height >= (viewport.width < 500 ? 44 : 34))
    await close.focus()
    await page.keyboard.press('Tab')
    await expect(equip).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(close).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(equip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('87 / 100 QP', { exact: true })).toBeVisible()
    let last = await page.evaluate(() => window.calls.at(-1))
    assert.deepEqual(last.replacePositions, ['head'])
    assert.equal(last.expectedRevision, 1)
    await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('quality-points')
    await expect(page.getByRole('combobox', { name: 'Sort', exact: true })).toBeEnabled()
    assert.equal((await page.evaluate(() => window.calls.at(-1))).action, 'sort')
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
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Sunsplitter')
    await expect(page.locator('[data-inventory-slot] button')).toHaveCount(1)
    await page.locator('[data-inventory-slot] button').click()
    await expect(page.getByRole('button', { name: 'Equip', exact: true })).toBeDisabled()
    await expect(page.getByRole('dialog').getByRole('status')).toContainText('exceed 100 QP')
    await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(0)
    await page.keyboard.press('Escape')
    // A player explicitly removes a piece; Equip never picks extra gear just to fit the budget.
    await page.getByRole('button', { name: 'Body: Stormweave Robe', exact: true }).click()
    await page.getByRole('button', { name: 'Unequip', exact: true }).click()
    await page.locator('[data-inventory-slot] button').click()
    await page.getByRole('button', { name: 'Equip', exact: true }).click()
    await expect(page.getByText('92 / 100 QP', { exact: true })).toBeVisible()
    last = await page.evaluate(() => window.calls.at(-1))
    assert.deepEqual(last.replacePositions, ['main-hand', 'off-hand'])
    await expect(
      page.getByRole('button', { name: 'Off Hand: Occupied by two-handed weapon', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'Main Hand: Sunsplitter', exact: true }).click()
    await page.getByRole('button', { name: 'Unequip', exact: true }).click()
    await expect(page.getByText('42 / 100 QP', { exact: true })).toBeVisible()
    // Clicking empty Head shows only owned headwear in a wrapped compact picker.
    await page.getByRole('button', { name: 'Head: Warden Helm', exact: true }).click()
    await page.getByRole('button', { name: 'Unequip', exact: true }).click()
    await page.getByRole('button', { name: 'Head: Empty', exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Wayfarer Hood', exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Iron Shortsword/ })).toHaveCount(0)
    await dialog.getByRole('button', { name: 'Wayfarer Hood', exact: true }).click()
    assert.equal((await page.evaluate(() => window.calls.at(-1))).position, 'head')
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('')
    await page.getByRole('button', { name: 'Consumable 1: Empty', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Mender Salve/ })
      .click()
    await expect(
      page.getByRole('button', { name: 'Consumable 1: Mender Salve', exact: true }),
    ).toContainText('×12')
    await page.getByRole('button', { name: 'Consumable 2: Empty', exact: true }).click()
    await expect(
      page.getByRole('dialog').getByRole('button', { name: /Mender Salve/ }),
    ).toHaveCount(0)
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Clarity Draught/ })
      .click()
    last = await page.evaluate(() => window.calls.at(-1))
    assert.equal(last.position, 'consumable-2')
    await page.reload({ waitUntil: 'networkidle' })
    await expect(
      page.getByRole('button', { name: 'Consumable 2: Clarity Draught', exact: true }),
    ).toBeVisible()
    // Preserve the established Support chooser, late-read guard and fallback coverage.
    await page.getByRole('button', { name: 'Off Hand: Empty', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Wardstone Bracer/ })
      .click()
    await page.getByRole('button', { name: 'Main Hand: Empty', exact: true }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Emberbrand/ })
      .click()
    await page.getByRole('button', { name: /Manage Techniques/ }).click()
    const supportTab = page.getByRole('tab', { name: 'Support', exact: true })
    if (await supportTab.isVisible()) await supportTab.click()
    await expect(page.getByRole('radio', { name: 'Warding Prayer', exact: true })).toHaveCount(0)
    await page.getByRole('radio', { name: 'Kindle', exact: true }).click()
    if (viewport.width < 500)
      await page.getByRole('button', { name: 'Use as Support Action', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await page.evaluate(() => {
      window.testState.deferRead = true
    })
    await page.getByRole('button', { name: /Manage Techniques/ }).click()
    if (await supportTab.isVisible()) await supportTab.click()
    await expect(page.getByRole('radio', { name: 'Kindle', exact: true })).toBeChecked()
    await page.getByRole('radio', { name: 'HP Recovery', exact: true }).click()
    if (viewport.width < 500)
      await page.getByRole('button', { name: 'Use as Support Action', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'HP Recovery', exact: true })).toBeChecked()
    await page.evaluate(() => window.releaseItemRead())
    await expect(page.getByRole('radio', { name: 'HP Recovery', exact: true })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Kindle', exact: true })).not.toBeChecked()
    await page.getByRole('radio', { name: 'Kindle', exact: true }).click()
    if (viewport.width < 500)
      await page.getByRole('button', { name: 'Use as Support Action', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Main Hand: Emberbrand', exact: true }).click()
    await page.getByRole('button', { name: 'Unequip', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    assert.deepEqual(await page.evaluate(() => window.itemSnapshot().selectedSupport), {
      kind: 'basic',
      actionId: 'basic.recover',
    })
    await expect(page.getByText('Items saved.', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Materials', exact: true }).click()
    await page.locator('[data-inventory-slot] button').first().click()
    dialog = page.getByRole('dialog')
    await expect(
      dialog.getByRole('button', { name: 'Cannot be equipped', exact: true }),
    ).toBeDisabled()
    const dialogWidth = await dialog.locator(':scope > section').boundingBox()
    assert.ok(dialogWidth.width <= 600 && dialogWidth.width <= viewport.width)
    await page.screenshot({ path: resolve(output, `arsenal-item-material-${viewport.width}.png`) })
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.archiveEquipment())
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(page.getByText('Repair equipment', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Head: Unavailable Item', exact: true }).click()
    await page.getByRole('button', { name: 'Unequip', exact: true }).click()
    await expect(page.getByText('Repair equipment', { exact: true })).toHaveCount(0)
    // The Equipped pill remains distinct from stock quantity and does not resize artwork.
    await page.getByRole('button', { name: 'Consumables', exact: true }).click()
    const badgeFit = await page
      .locator('[data-inventory-slot] button')
      .filter({ hasText: 'Mender Salve' })
      .evaluate((card) => {
        const badge = card.querySelector('[class*="equipped_"]').getBoundingClientRect()
        const quantity = card.querySelector('[class*="quantity_"]').getBoundingClientRect()
        return {
          text: card.querySelector('[class*="equipped_"]').textContent,
          separate: badge.top >= quantity.bottom || badge.right <= quantity.left,
        }
      })
    assert.ok(
      badgeFit.text.includes('✓') && badgeFit.separate,
      JSON.stringify({ viewport, badgeFit }),
    )
    const postsBeforeDepletion = await page.evaluate(() => window.calls.length)
    await page.evaluate(() => window.depleteFixtureStack('consumable-1'))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(
      page.getByRole('button', { name: 'Consumable 1: Empty', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Slot \d+: Mender Salve, quantity 3/ }),
    ).toBeAttached()
    assert.equal(
      await page.evaluate(() => window.calls.length),
      postsBeforeDepletion,
      'authoritative depletion never equips another stack automatically',
    )
    await page.getByRole('button', { name: 'Head: Empty', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.disablePositionItems('head'))
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page.getByRole('button', { name: 'Head: Empty', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('status')).toContainText(
      'No owned Items can be equipped in Head.',
    )
    await page.keyboard.press('Escape')
    await page.screenshot({
      path: resolve(output, `arsenal-items-${viewport.width}.png`),
      fullPage: true,
    })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
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
      `Arsenal ${viewport.width}: direct actions, stat deltas, owned pickers, distinct consumables, budget/repair guards, automatic refresh, compact dialogs and deletion focus passed`,
    )
  }
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
