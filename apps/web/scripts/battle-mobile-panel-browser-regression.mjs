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
      'width: 9,',
      'width: Number(new URLSearchParams(location.search).get("columns")) || 9,',
    )
    .replace(
      'length: 63',
      'length: (Number(new URLSearchParams(location.search).get("columns")) || 9) * 7',
    )
    .replace(
      'x: i % 9, y: Math.floor(i / 9)',
      'x: i % (Number(new URLSearchParams(location.search).get("columns")) || 9), y: Math.floor(i / (Number(new URLSearchParams(location.search).get("columns")) || 9))',
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
      return bounds.bottom <= footer.getBoundingClientRect().top - 4 && bounds.top >= 0
    })
    return page
      .locator('main[data-pvp-battle] > footer')
      .evaluate((el) => el.getBoundingClientRect().height)
  }
  await chat.click()
  await panel.waitFor({ state: 'visible' })
  const initialFooterHeight = await expectAboveFooter()
  await page.screenshot({ path: resolve(output, `${label}-chat.png`) })
  const rotated = viewport.height < 500 ? { width: 390, height: 844 } : { width: 844, height: 390 }
  await page.setViewportSize(rotated)
  const resizedFooterHeight = await expectAboveFooter()
  assert.notEqual(
    resizedFooterHeight,
    initialFooterHeight,
    'Chat follows the actual footer when rotation changes its height',
  )
  await chat.click()
  await panel.waitFor({ state: 'hidden' })
  await chat.click()
  await panel.waitFor({ state: 'visible' })
  await panel.getByRole('button', { name: 'Close battle communication', exact: true }).click()
  await panel.waitFor({ state: 'hidden' })
  await page.setViewportSize(viewport)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  })
}
async function verifyMobileChronicleUpdates(page, geometry, frozen, label) {
  const panel = page.locator('[data-battle-mobile-lower-panel]')
  const actions = page.locator('[data-chronicle-action]')
  const readScrollMetrics = () =>
    page.evaluate(() => {
      const measure = (selector) => {
        const el = document.querySelector(selector)
        return {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          display: getComputedStyle(el).display,
          height: el.getBoundingClientRect().height,
        }
      }
      return {
        lower: measure('[data-battle-mobile-lower-panel]'),
        reader: measure('[data-battle-chronicle]'),
        actions: document.querySelectorAll('[data-chronicle-action]').length,
        scrolls: window.chronicleScrollDiagnostics,
      }
    })
  await page.evaluate(() => {
    window.chronicleScrollDiagnostics = []
    for (const selector of ['[data-battle-mobile-lower-panel]', '[data-battle-chronicle]']) {
      const el = document.querySelector(selector)
      el.addEventListener('scroll', () =>
        window.chronicleScrollDiagnostics.push({
          selector,
          top: el.scrollTop,
          height: el.scrollHeight,
          client: el.clientHeight,
          actions: document.querySelectorAll('[data-chronicle-action]').length,
          time: performance.now(),
        }),
      )
    }
  })
  const settle = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
  const append = async (count) => {
    await page.evaluate((count) => {
      window.fixtureLogCount = count
      window.advanceBattle()
    }, count)
    await page.waitForFunction(
      (count) => document.querySelectorAll('[data-chronicle-action]').length === count,
      count,
    )
    await settle()
    const { reader } = await readScrollMetrics()
    assert.ok(
      reader.scrollHeight <= reader.clientHeight + 1,
      'Appended entries stay inside Chronicle parchment',
    )
  }
  const assertFrozen = async () => {
    const current = await geometry()
    for (const key of ['board', 'header', 'rails', 'footer'])
      assert.deepEqual(current[key], frozen[key], `Live Chronicle append preserves ${key}`)
  }
  // Let opening's initial scroll and reading-round update finish before choosing live follow.
  await settle()
  await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await settle()
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[data-battle-mobile-lower-panel]')
      return panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 2
    },
    undefined,
    { timeout: 2000 },
  )
  const atEnd = await readScrollMetrics()
  assert.ok(
    atEnd.reader.scrollHeight <= atEnd.reader.clientHeight + 1,
    'Chronicle parchment contains full reader content; lower panel owns scrolling',
  )
  await append(32)
  await page
    .waitForFunction(
      () => {
        const panel = document.querySelector('[data-battle-mobile-lower-panel]')
        return panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 2
      },
      undefined,
      { timeout: 2000 },
    )
    .catch(() => {})
  const afterAppend = await readScrollMetrics()
  console.log(JSON.stringify({ chronicleCase: label, atEnd, afterAppend }))
  const bottomDistance = await panel.evaluate(
    (el) => el.scrollHeight - el.clientHeight - el.scrollTop,
  )
  assert.ok(
    bottomDistance <= 2,
    `Live Chronicle follows appended entries in the lower panel (distance ${bottomDistance})`,
  )
  await assertFrozen()

  const anchor = actions.nth(4)
  const anchorId = await anchor.getAttribute('data-chronicle-action')
  await anchor.evaluate((el) => {
    const panel = el.closest('[data-battle-mobile-lower-panel]')
    panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12
  })
  await settle()
  const relativeTop = () =>
    anchor.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        el.closest('[data-battle-mobile-lower-panel]').getBoundingClientRect().top,
    )
  const before = await relativeTop()
  await append(40)
  await page
    .waitForFunction(
      ({ anchorId, before }) => {
        const anchor = [...document.querySelectorAll('[data-chronicle-action]')].find(
          (el) => el.getAttribute('data-chronicle-action') === anchorId,
        )
        if (!anchor) return false
        const panel = anchor.closest('[data-battle-mobile-lower-panel]')
        return (
          Math.abs(
            anchor.getBoundingClientRect().top - panel.getBoundingClientRect().top - before,
          ) <= 1
        )
      },
      { anchorId, before },
      { timeout: 2000 },
    )
    .catch(() => {})
  assert.equal(await anchor.getAttribute('data-chronicle-action'), anchorId)
  assert.ok(
    Math.abs((await relativeTop()) - before) <= 1,
    'Reviewed history retains its visible action anchor when live entries append',
  )
  await assertFrozen()
}
async function verifyMobileGuardFrame(page, geometry, label) {
  // Clear the fixture's Suppress so this is a legal Guard transition from a local turn.
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
  const panel = page.locator('[data-battle-mobile-lower-panel]')
  const anchor = page.locator('[data-chronicle-action]').first()
  await anchor.evaluate((el) => {
    const panel = el.closest('[data-battle-mobile-lower-panel]')
    panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top
  })
  const settle = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
  await settle()
  const anchorTop = () =>
    anchor.evaluate(
      (el) =>
        el.getBoundingClientRect().top -
        el.closest('[data-battle-mobile-lower-panel]').getBoundingClientRect().top,
    )
  const before = await geometry()
  const anchorBefore = await anchorTop()
  const proposed = page
    .locator('[data-unified-battle-economy] small')
    .filter({ hasText: 'proposed' })
  assert.match(await proposed.textContent(), /30 proposed/)
  const headerText = await page.locator('[data-unified-battle-economy]').evaluate((el) => {
    const box = (node) => {
      const r = node.getBoundingClientRect()
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
    }
    const ap = el.querySelector('strong')
    const cost = el.querySelector('small')
    const clock = el.querySelector('[data-battle-turn-clock-slot] > span > span')
    return {
      economy: box(el),
      track: box(el.querySelector('[role="progressbar"]')),
      ap: box(ap),
      cost: box(cost),
      clock: box(clock),
      clockText: clock.textContent,
      clockOverflow: clock.scrollWidth - clock.clientWidth,
      costOverflow: cost.scrollWidth - cost.clientWidth,
      costFont: getComputedStyle(cost).font,
      costText: cost.textContent,
      costSpacing: getComputedStyle(cost).letterSpacing,
    }
  })
  console.log(JSON.stringify({ guardHeader: label, headerText }))
  assert.ok(
    headerText.ap.right + 1 <= headerText.cost.x,
    'Proposed AP cost does not overlap remaining AP',
  )
  assert.ok(
    headerText.cost.right <= headerText.economy.right + 1,
    'Complete proposed AP cost stays within economy header',
  )
  assert.ok(headerText.costOverflow <= 1, 'Proposed AP cost remains readable')
  for (const part of ['ap', 'cost', 'clock']) {
    assert.ok(
      headerText[part].y >= headerText.economy.y - 1 &&
        headerText[part].bottom <= headerText.track.y + 1,
      `${part} stays above AP track inside economy header`,
    )
  }
  assert.ok(
    headerText.clock.bottom <= headerText.ap.y + 1 &&
      headerText.clock.bottom <= headerText.cost.y + 1,
    'Clock and AP details occupy separate rows',
  )
  assert.match(headerText.clockText, /\d+s/)
  assert.ok(
    headerText.clockOverflow <= 1 && headerText.clock.width > 0,
    'Countdown remains readable',
  )
  await page.screenshot({ path: resolve(output, `${label}-guard-before.png`) })
  await page.evaluate(() => {
    window.fixtureLogCount = 41
    window.applyFixtureGuard()
  })
  await page.waitForFunction(
    () => document.querySelectorAll('[data-chronicle-action]').length === 41,
  )
  await settle()
  const paid = await page.evaluate(() => window.fixtureGuardReceipt)
  assert.equal(paid.before - paid.after, 30, 'Real Guard transition spends 30 AP')
  const after = await geometry()
  for (const key of ['header', 'rails', 'board', 'footer', 'lower'])
    assert.deepEqual(after[key], before[key], `Guard preserves frozen ${key}`)
  const anchorAfter = await anchorTop()
  assert.ok(Math.abs(anchorAfter - anchorBefore) <= 1, 'Guard preserves reviewed Chronicle anchor')
  assert.equal(
    await page.locator('[data-battle-mobile-chronicle-toggle]').getAttribute('aria-expanded'),
    'true',
  )
  assert.equal(await panel.isVisible(), true)
  await page.screenshot({ path: resolve(output, `${label}-guard-after.png`) })
  return { before, after, anchorBefore, anchorAfter, headerText, paid }
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
        const toggle = page.locator('[data-battle-mobile-chronicle-toggle]')
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
          await toggle.waitFor({ state: 'visible' })
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
                footerButtons: [
                  ...document.querySelectorAll('[data-battle-mobile-footer] button'),
                ].map((el) => {
                  const r = el.getBoundingClientRect()
                  return { label: el.textContent, x: r.x, y: r.y, right: r.right, bottom: r.bottom }
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
          await toggle.click()
          await page.screenshot({
            path: resolve(output, `${mode}-${columns}-${viewport.width}-chronicle.png`),
          })
          await page.waitForFunction(
            () => document.querySelector('[data-battle-mobile-lower-panel]').scrollTop > 0,
          )
          assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
          const after = await geometry()
          assert.deepEqual(after.board, before.board, `${mode}: Chronicle preserves board`)
          assert.deepEqual(after.header, before.header, `${mode}: Chronicle preserves header`)
          assert.deepEqual(after.footer, before.footer, `${mode}: toggle remains frozen`)
          await verifyMobileChronicleUpdates(
            page,
            geometry,
            before,
            `${mode}-${columns}-${viewport.width}`,
          )
          const guard =
            mode !== 'spectator'
              ? await verifyMobileGuardFrame(page, geometry, `${mode}-${columns}-${viewport.width}`)
              : null
          await page
            .locator('[data-battle-mobile-lower-panel]')
            .evaluate((el) => el.scrollTo(0, el.scrollHeight))
          await toggle.click()
          assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
          assert.equal(
            await page.locator('[data-battle-mobile-lower-panel]').evaluate((el) => el.scrollTop),
            0,
          )
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
          assert.equal(await toggle.isVisible(), false, 'Desktop retains existing Chronicle rail')
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
