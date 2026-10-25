// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-mobile-panel-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-mobile-panel-'))
const output = process.env.AV_MOBILE_PANEL_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
// Use the complete route boundary, including mode-specific production presentation layers.
const harness = await fs.readFile(
  resolve(web, 'e2e/fixtures/battle-ally-inspection-harness.jsx'),
  'utf8',
)
await fs.writeFile(
  resolve(fixture, 'entry.jsx'),
  harness
    .replace(
      'const body = options.body ? JSON.parse(options.body) : null',
      'if (path.includes("/api/pvp/spectate/")) return Response.json({ spectator: { battle: window.fixtureBattle, mode: "2v2", battleKey: metadata.battleKey, participants }, participantTitles: {} })\n  if (path.endsWith("/turn-clock")) return Response.json({ tick: { clock: { active: true, turnNumber: window.fixtureBattle.snapshot.tactical.battle.turnNumber, combatantId: "character:player", deadlineAt: new Date(window.fixtureTurnDeadline ??= Date.now() + 60000).toISOString(), expired: false, turnTimerSeconds: 60 }, battle: null, timedOut: false } })\n  const body = options.body ? JSON.parse(options.body) : null',
    )
    .replace(
      'window.restoreCanonicalBattle = () => {',
      `window.applyFixtureGuard = () => {
        const before = readPv1fActionEconomy(window.fixtureBattle.snapshot).current
        const transition = executePv1fAction(window.fixtureBattle.snapshot, 'basic.guard', { kind: 'self' })
        window.fixtureGuardReceipt = { before, after: readPv1fActionEconomy(transition.state).current }
        window.fixtureBattle = { ...window.fixtureBattle, battleVersion: window.fixtureBattle.battleVersion + 1, snapshot: transition.state }
        window.publishBattle()
      }
      window.restoreCanonicalBattle = () => {`,
    )
    .replace(
      'entries: suppressChronicleEntries',
      'entries: Array.from({ length: window.fixtureLogCount ?? 24 }, (_, index) => suppressChronicleEntries.map(entry => ({ ...entry, battleVersion: index + 1 }))).flat()',
    )
    .replace(
      'import { BattleExperience }',
      "import { BattleClientBoundary } from '@/components/battle/battle-client-boundary'\nimport { BattleExperience }",
    )
    .replace(
      /<BattleInteractionLifecycleProvider>[\s\S]*?<\/BattleInteractionLifecycleProvider>/,
      '<BattleClientBoundary initialBattle={initialBattle} runtime={runtime} />',
    ),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/percentage-dot-viewer-state.ts'),
  resolve(fixture, 'percentage-dot-viewer-state.ts'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
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
await fs.writeFile(
  resolve(fixture, 'next-link.jsx'),
  `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}`,
)
await fs.writeFile(
  resolve(fixture, 'next-dynamic.jsx'),
  `import React from 'react';export default function dynamic(loader){const Component=React.lazy(()=>loader().then(value=>({default:value})));return props=><React.Suspense fallback={null}><Component {...props}/></React.Suspense>}`,
)
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/audio': resolve(root, 'packages/audio/src/index.ts'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/link': resolve(fixture, 'next-link.jsx'),
      'next/dynamic': resolve(fixture, 'next-dynamic.jsx'),
      'next/image': resolve(fixture, 'next-mock.jsx'),
      'next/navigation': resolve(fixture, 'next-mock.jsx'),
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
  args: ['--no-sandbox'],
  headless: true,
})
async function verifyMobileChatFooter(page, viewport, label) {
  const chat = page.locator('main > footer button').filter({ hasText: /^Chat/ })
  const panel = page.locator('#pvp-battle-chat-panel[data-open]')
  const expectAboveFooter = async () => {
    await page.waitForFunction(() => {
      const panel = document.querySelector('#pvp-battle-chat-panel[data-open]')
      const footer = document.querySelector('main[data-pvp-battle] > footer')
      if (!panel || !footer || panel.hasAttribute('data-desktop')) return false
      const bounds = panel.getBoundingClientRect()
      const lower = document
        .querySelector('[data-battle-mobile-lower-panel]')
        .getBoundingClientRect()
      return (
        bounds.bottom <= footer.getBoundingClientRect().top - 4 &&
        bounds.top >= 0 &&
        Math.abs(bounds.top - lower.top) <= 1 &&
        Math.abs(bounds.bottom - lower.bottom) <= 1 &&
        Math.abs(bounds.width - lower.width) <= 1
      )
    })
    return page
      .locator('main[data-pvp-battle] > footer')
      .evaluate((el) => el.getBoundingClientRect().height)
  }
  await chat.click()
  await panel.waitFor({ state: 'visible' })
  const initialFooterHeight = await expectAboveFooter()
  assert.equal(initialFooterHeight, 44, 'Mobile PvP retains its original single-row footer height')
  assert.equal(
    await panel.getByRole('tab', { name: 'Battle Log', exact: true }).count(),
    0,
    'Chat contains messages instead of a log tab',
  )
  const composer = panel.getByRole('textbox', { name: 'Battle chat message' })
  await composer.fill('Draft survives rotation and toggling')
  await page.screenshot({ path: resolve(output, `${label}-chat.png`) })
  const rotated = viewport.height < 500 ? { width: 390, height: 844 } : { width: 844, height: 390 }
  await page.setViewportSize(rotated)
  const resizedFooterHeight = await expectAboveFooter()
  assert.equal(
    resizedFooterHeight,
    initialFooterHeight,
    'Rotation retains the single-row footer while Chat fills the lower workspace',
  )
  assert.equal(await composer.inputValue(), 'Draft survives rotation and toggling')
  await chat.click()
  await panel.waitFor({ state: 'hidden' })
  await chat.click()
  await panel.waitFor({ state: 'visible' })
  assert.equal(await composer.inputValue(), 'Draft survives rotation and toggling')
  assert.equal(
    await panel
      .getByRole('button', { name: 'Close battle communication', exact: true })
      .isVisible(),
    false,
    'Mobile Chat uses the footer toggle instead of a close X',
  )
  await chat.click()
  await panel.waitFor({ state: 'hidden' })
  await page.setViewportSize(viewport)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
async function verifyMobileChronicleUpdates(page, geometry, frozen, label) {
  const strip = page.locator('[data-battle-mobile-chronicle-strip]')
  const track = strip.locator('[data-battle-action-strip]')
  const actions = track.getByRole('button', { name: /Show Chronicle details/i })
  await strip.waitFor({ state: 'visible' })
  await actions.first().waitFor({ state: 'visible' })
  const stripBefore = await strip.boundingBox()
  assert.ok(stripBefore && stripBefore.height <= 65, 'Timeline stays a single compact fixed row')
  const initial = await actions.count()
  assert.ok(initial >= 1, 'Recorded actions are available from the compact Chronicle')
  const assertFrozen = async (context) => {
    const current = await geometry()
    for (const key of ['board', 'header', 'rails', 'footer'])
      assert.deepEqual(current[key], frozen[key], context + ': preserved ' + key)
  }
  await actions.last().click()
  const inline = (await page.locator('[data-battle-cockpit-history]').count()) > 0
  const commandDeck = page.locator('[data-unified-command-deck]')
  const hasCommands = (await commandDeck.count()) > 0
  const restoredControls = hasCommands
    ? commandDeck
    : page.getByRole('button', { name: 'Inspect', exact: true })
  const popup = inline
    ? page.getByRole('region', { name: /Chronicle action/i })
    : strip.getByRole('dialog', { name: /Chronicle action/i })
  await popup.waitFor({ state: 'visible' })
  assert.equal(await popup.count(), 1, 'One Chronicle reader replaces the cockpit')
  await actions.first().click()
  assert.equal(await popup.count(), 1, 'Selecting another action replaces the cockpit reader')
  await page.keyboard.press('Escape')
  await popup.waitFor({ state: 'hidden' })
  await actions.first().click()
  await popup.waitFor({ state: 'visible' })
  await actions.first().click()
  await popup.waitFor({ state: 'hidden' })
  await actions.first().click()
  await popup.getByRole('button', { name: 'Close Chronicle action' }).click()
  await popup.waitFor({ state: 'hidden' })
  if (inline) await restoredControls.waitFor({ state: 'visible' })
  assert.equal(await page.getByRole('dialog', { name: /Chronicle action/i }).count(), 0)
  await assertFrozen('Chronicle popover interactions')
  // Appended actions extend the timeline horizontally without expanding its vertical footprint.
  await page.evaluate(() => {
    window.fixtureLogCount = 32
    window.advanceBattle()
  })
  await page.waitForFunction(
    (count) =>
      document.querySelectorAll('[data-battle-action-strip] button[aria-expanded]').length >= count,
    32,
  )
  await assertFrozen('Chronicle appended actions')
  const stripAfter = await strip.boundingBox()
  assert.ok(
    stripAfter && Math.abs(stripAfter.height - stripBefore.height) <= 1,
    'Chronicle timeline height remains fixed while history grows',
  )
  await page.screenshot({ path: resolve(output, label + '-timeline.png') })
  if (inline && hasCommands) {
    await actions.first().click()
    await popup.waitFor({ state: 'visible' })
    await page.getByRole('button', { name: 'Terrain', exact: true }).click()
    await page.locator('[data-terrain-preview-picker]').waitFor({ state: 'visible' })
    await popup.waitFor({ state: 'hidden' })
    await actions.first().click()
    await popup.waitFor({ state: 'visible' })
    await popup.getByRole('button', { name: 'Close Chronicle action' }).click()
    await restoredControls.waitFor({ state: 'visible' })
  }
  if (inline) {
    await actions.first().click()
    await popup.waitFor({ state: 'visible' })
    await page.evaluate(() => {
      window.savedHistoryFetch = window.fetch
      window.fetch = (url, options) =>
        String(url).endsWith('/events')
          ? Promise.resolve(
              Response.json(
                { error: { message: 'History temporarily unavailable' } },
                { status: 503 },
              ),
            )
          : window.savedHistoryFetch(url, options)
      window.advanceBattle()
    })
    await popup.waitFor({ state: 'hidden' })
    await restoredControls.waitFor({ state: 'visible' })
    await assertFrozen('Failed history refresh restores cockpit')
    await page.evaluate(() => {
      window.fetch = window.savedHistoryFetch
      window.advanceBattle()
    })
    await actions.first().waitFor({ state: 'visible' })
  }
}

async function verifyMobileGuardFrame(page, geometry, label) {
  await page.evaluate(() => {
    const next = structuredClone(window.fixtureBattle)
    next.battleVersion++
    next.snapshot.statusState = next.snapshot.statusState.map((row) => ({ ...row, statuses: [] }))
    next.snapshot.tactical.battle.currentTurn.combatantId = 'character:player'
    window.fixtureBattle = next
    window.publishBattle()
  })
  const main = page.locator('main[data-unified-battle]')
  await main.evaluate((el) => el.focus({ preventScroll: true }))
  await page.keyboard.press('Digit3')
  await page.waitForFunction(
    () => document.querySelector('main[data-unified-battle]').dataset.battleActionMode === 'guard',
  )
  const before = await geometry()
  const headerText = await page.locator('[data-unified-battle-economy]').evaluate((el) => {
    const box = (node) => {
      if (!node) return null
      const r = node.getBoundingClientRect()
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    }
    const clock = el.querySelector('[data-battle-turn-clock-slot]')
    const track = el.querySelector('[role="progressbar"]')
    const ap = el.querySelector('strong')
    return {
      economy: box(el),
      track: box(track),
      ap: box(ap),
      clock: box(clock),
      clockText: clock?.textContent,
      clockFont: clock ? parseFloat(getComputedStyle(clock).fontSize) : 0,
    }
  })
  assert.ok(headerText.clock && headerText.ap, 'Countdown and AP counter remain visible')
  assert.ok(
    headerText.clock.right <= headerText.economy.right + 1,
    'Countdown fits in the compact AP row',
  )
  assert.ok(headerText.track.width <= 200, '100 AP uses a restrained visual bar length')
  assert.ok(
    headerText.ap.bottom <= headerText.track.y + 1,
    'AP counter stays above its progress bar',
  )
  await page.evaluate(() => {
    window.fixtureLogCount = 41
    window.applyFixtureGuard()
  })
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-battle-action-strip] button[aria-expanded]').length >= 41,
  )
  const paid = await page.evaluate(() => window.fixtureGuardReceipt)
  assert.equal(paid.before - paid.after, 30, 'Guard spends 30 AP')
  const after = await geometry()
  for (const key of ['header', 'rails', 'board', 'footer', 'lower'])
    assert.deepEqual(after[key], before[key], 'Guard preserves ' + key)
  await page.screenshot({ path: resolve(output, label + '-guard-after.png') })
  return { before, after, headerText, paid }
}
const errors = []
const receipts = []
try {
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const columns of [9, 12, 15]) {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 320, height: 568 },
        { width: 412, height: 839 },
        { width: 812, height: 375 },
        { width: 844, height: 390 },
        { width: 1366, height: 768 },
      ]) {
        if (columns !== 9 && ![390, 844].includes(viewport.width)) continue
        if (
          process.env.AV_MOBILE_PANEL_SCENE &&
          process.env.AV_MOBILE_PANEL_SCENE !== `${mode}-${columns}-${viewport.width}`
        )
          continue
        const page = await browser.newPage({ viewport, hasTouch: viewport.width <= 980 })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(
          server.resolvedUrls.local[0] + `?mode=${mode}&columns=${columns}&suppress=active`,
        )
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
        })
        await page.waitForTimeout(500)
        await page.locator('[data-board-auto-fit]').waitFor()
        assert.equal(
          await page.locator('[data-board-auto-fit]').getAttribute('data-board-auto-fit'),
          `${columns}x7`,
        )
        const mobile = viewport.width <= 980
        const chronicleStrip = page.locator('[data-battle-mobile-chronicle-strip]')
        if (mode === 'pvp') {
          const shapes = await page
            .locator('[data-pvp-spectator-key], [data-pvp-footer-presence] > button')
            .evaluateAll((elements) =>
              elements.map((element) => {
                const rect = element.getBoundingClientRect()
                return {
                  height: rect.height,
                  radius: parseFloat(getComputedStyle(element).borderTopLeftRadius),
                  overflowY: element.scrollHeight - element.clientHeight,
                }
              }),
            )
          assert.equal(shapes.length, 2)
          for (const shape of shapes) {
            assert.ok(
              shape.radius >= shape.height / 2 - 1,
              'PvP spectator controls retain pill shape',
            )
            assert.ok(shape.overflowY <= 1, 'PvP spectator control text fits')
          }
          assert.ok(
            Math.abs(shapes[0].height - shapes[1].height) <= 1,
            'PvP spectator controls retain equal height',
          )
          const presence = page.locator('[data-pvp-footer-presence] > button')
          await presence.click()
          await page
            .getByRole('dialog', { name: 'Current spectators' })
            .waitFor({ state: 'visible' })
          await presence.click()
        }

        if (mobile) {
          if (mode === 'pvp')
            await verifyMobileChatFooter(page, viewport, `${mode}-${columns}-${viewport.width}`)
          await chronicleStrip.waitFor({ state: 'visible' })
          const geometry = () =>
            page.evaluate(() => {
              const box = (selector) => {
                const r = document.querySelector(selector).getBoundingClientRect()
                return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom }
              }
              return {
                board: box('[data-board-auto-fit]'),
                battlefield: box('#battlefield'),
                rails: [
                  ...document.querySelectorAll(
                    '[data-battle-side="local"] > [data-battle-combatant-card]',
                  ),
                ].map((el) => ({
                  x: el.getBoundingClientRect().x,
                  y: el.getBoundingClientRect().y,
                })),
                footer: box('[data-battle-mobile-footer]'),
                header: box('main[data-battle-concept] > header'),
                lower: box('[data-battle-mobile-lower-panel]'),
                footerButtons: [...document.querySelectorAll('[data-battle-mobile-footer] button')]
                  .filter((el) => {
                    const r = el.getBoundingClientRect()
                    return r.width > 0 && r.height > 0
                  })
                  .map((el) => {
                    const r = el.getBoundingClientRect()
                    return {
                      label: el.textContent,
                      x: r.x,
                      y: r.y,
                      right: r.right,
                      bottom: r.bottom,
                    }
                  }),
                footerChildren: [
                  ...document.querySelector('[data-battle-mobile-footer]').children,
                ].map((el) => ({
                  text: el.textContent,
                  gridColumn: getComputedStyle(el).gridColumn,
                  gridRow: getComputedStyle(el).gridRow,
                  width: getComputedStyle(el).width,
                  height: el.getBoundingClientRect().height,
                })),
                clientWidth: document.documentElement.clientWidth,
                documentWidth: document.documentElement.scrollWidth,
                documentHeight: document.documentElement.scrollHeight,
                scrollY: window.scrollY,
              }
            })
          const before = await geometry()
          const clippedControls = await page.evaluate(() => {
            const width = document.documentElement.clientWidth
            return [
              ...document.querySelectorAll(
                '[data-av-site-header] a, [data-av-site-header] button, main[data-battle-concept] > header button, [data-battle-side="local"] > [data-battle-combatant-card]',
              ),
            ]
              .filter((el) => {
                const r = el.getBoundingClientRect()
                return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > width + 1)
              })
              .map((el) => el.textContent)
          })
          assert.deepEqual(
            clippedControls,
            [],
            `${mode}: site controls, battle controls and both rails fit visible viewport`,
          )

          await page.screenshot({
            path: resolve(output, `${mode}-${columns}-${viewport.width}-before.png`),
          })
          assert.ok(before.documentWidth <= before.clientWidth + 1, `${mode}: document width fits`)
          assert.ok(before.documentHeight <= viewport.height + 1, `${mode}: document height fits`)
          assert.ok(
            before.lower.height >= 99,
            `${mode}: lower controls retain usable reading space`,
          )
          assert.ok(before.board.height >= 100, `${mode}: readable complete board`)
          assert.ok(
            before.board.x >= before.battlefield.x &&
              before.board.x + before.board.width <=
                before.battlefield.x + before.battlefield.width,
            `${mode}: all board columns fit`,
          )
          assert.ok(
            before.board.y >= before.battlefield.y &&
              before.board.bottom <= before.battlefield.bottom,
            `${mode}: all board rows fit`,
          )
          for (let i = 0; i < before.footerButtons.length; i++) {
            const a = before.footerButtons[i]
            assert.ok(
              a.x >= before.footer.x - 1 &&
                a.right <= before.footer.x + before.footer.width + 1 &&
                a.y >= before.footer.y - 1 &&
                a.bottom <= before.footer.bottom + 1,
              `${mode}: ${a.label} stays fully within footer`,
            )
            for (const b of before.footerButtons.slice(i + 1)) {
              const overlapX = Math.min(a.right, b.right) - Math.max(a.x, b.x)
              const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
              assert.ok(
                overlapX <= 1 || overlapY <= 1,
                `${mode}: footer controls ${a.label} and ${b.label} do not overlap`,
              )
            }
          }
          assert.equal(before.rails.length, 2)
          assert.ok(
            Math.abs(before.rails[0].y - before.rails[1].y) < 1,
            `${mode}: summaries are side by side`,
          )
          assert.ok(
            before.board.bottom <= before.lower.y + 1 ||
              before.board.x + before.board.width <= before.lower.x + 1,
            `${mode}: complete board above lower panel`,
          )
          const after = await geometry()
          await verifyMobileChronicleUpdates(
            page,
            geometry,
            before,
            mode + '-' + columns + '-' + viewport.width,
          )
          const guard =
            mode !== 'spectator'
              ? await verifyMobileGuardFrame(
                  page,
                  geometry,
                  mode + '-' + columns + '-' + viewport.width,
                )
              : null
          if (mode !== 'spectator') {
            const finish = page.locator('[data-battle-command="finish"]')
            await finish.scrollIntoViewIfNeeded()
            const finishBox = await finish.boundingBox()
            assert.ok(
              finishBox &&
                finishBox.y >= before.lower.y - 1 &&
                finishBox.y + finishBox.height <= before.lower.bottom + 1,
              `${mode}: End Turn reachable inside lower panel`,
            )
            assert.deepEqual(
              (await geometry()).board,
              before.board,
              `${mode}: reaching End Turn preserves board`,
            )
            await page.locator('[data-battle-command="inspect"]').click()
            assert.equal(
              await page
                .locator('main[data-unified-battle]')
                .getAttribute('data-battle-action-mode'),
              'inspect',
            )
            assert.equal(await page.evaluate(() => window.scrollY), 0)
          }
          receipts.push({ mode, columns, viewport, before, after, guard })
        } else
          assert.equal(
            await chronicleStrip.isVisible(),
            false,
            'Desktop retains existing Chronicle rail',
          )
        await page.screenshot({ path: resolve(output, `${mode}-${columns}-${viewport.width}.png`) })
        await page.close()
      }
    }
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(resolve(output, 'metrics.json'), JSON.stringify(receipts, null, 2))
  console.log(`PASS mobile lower-panel geometry and Chronicle interactions; evidence ${output}`)
} finally {
  await browser.close()
  await server.close()
}
