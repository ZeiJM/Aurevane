// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-command-feedback-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-command-feedback-'))
const output = process.env.AV_COMMAND_FEEDBACK_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-ally-inspection-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
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
const errors = []
async function verifyChatComposer(page) {
  await page.locator('main > footer button').filter({ hasText: /^Chat/ }).click()
  const panel = page.locator('#pvp-battle-chat-panel[data-open]')
  await panel.waitFor({ state: 'visible' })
  await panel.getByText('A local fixture message for checking battle chat layout.').waitFor()
  const read = () =>
    panel.evaluate((element) => {
      const input = element.querySelector('input[aria-label="Battle chat message"]')
      const form = input.closest('form')
      const messages = element.querySelector('[aria-live="polite"]')
      const footer = document.querySelector('main[data-pvp-battle] > footer')
      return {
        inputHeight: input.getBoundingClientRect().height,
        panelBottom: element.getBoundingClientRect().bottom,
        footerTop: footer.getBoundingClientRect().top,
        composerHeight: form.getBoundingClientRect().height,
        messageHeight: messages.getBoundingClientRect().height,
        insidePanel:
          form.getBoundingClientRect().bottom <= element.getBoundingClientRect().bottom + 1,
        noHorizontalOverflow: element.scrollWidth <= element.clientWidth + 1,
      }
    })
  for (const errorState of [false, true]) {
    if (errorState) {
      await panel.getByRole('textbox', { name: 'Battle chat message' }).fill('Local fixture text')
      await panel.getByRole('button', { name: 'Send', exact: true }).click()
      await panel.getByText('Fixture send unavailable.').waitFor()
    }
    const geometry = await read()
    assert.ok(
      geometry.panelBottom <= geometry.footerTop - 4,
      `Chat stays above the actual footer: ${JSON.stringify(geometry)}`,
    )
    assert.ok(geometry.inputHeight <= 48, 'Chat input stays one compact row')
    assert.ok(geometry.composerHeight <= 80, 'Chat composer cannot fill the message area')
    assert.ok(
      geometry.messageHeight > geometry.composerHeight,
      'Messages receive the flexible space',
    )
    assert.equal(geometry.insidePanel, true, 'Chat composer stays inside its window')
    assert.equal(geometry.noHorizontalOverflow, true, 'Chat controls do not overflow horizontally')
  }
  await page.screenshot({ path: resolve(output, `chat-composer-${page.viewportSize().width}.png`) })
  await page.locator('main > footer button').filter({ hasText: /^Chat/ }).click()
  await panel.waitFor({ state: 'hidden' })
}
async function verifyTabGuard(page) {
  await page.evaluate(() => {
    if (document.querySelector('[data-fixture-text-entry]')) return
    const input = document.createElement('input')
    input.dataset.fixtureTextEntry = 'true'
    input.setAttribute('aria-label', 'Fixture text entry')
    document.body.append(input)
    const next = document.createElement('input')
    next.dataset.fixtureNextEntry = 'true'
    document.body.append(next)
  })
  const map = page.locator('#battlefield button').first()
  const cardButtons = page.locator('[data-battle-combatant-card] button:visible')
  const card = (await cardButtons.count())
    ? cardButtons.first()
    : page.locator('main button:visible').first()
  const input = page.getByRole('textbox', { name: 'Fixture text entry' })
  const before = await page.evaluate(
    () => window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)).length,
  )
  for (const control of [map, card, input]) {
    await control.focus()
    for (const key of ['Tab', 'Shift+Tab']) {
      await page.keyboard.press(key)
      assert.equal(
        await control.evaluate((element) => document.activeElement === element),
        true,
        `${key} keeps focus on the current battlefield/control/text entry`,
      )
      if (control === map)
        assert.equal(
          await map.evaluate((tile) => getComputedStyle(tile).outlineStyle),
          'none',
          'Keyboard input cannot paint an unrelated rectangle on an unselected map tile',
        )
    }
  }
  await input.fill('Entry remains available')
  await page.keyboard.press('KeyW')
  assert.equal(
    await input.inputValue(),
    'Entry remains availablew',
    'Text entry remains independent of combat shortcuts',
  )
  const shortcuts = await page.evaluate(() => {
    const modified = ['ctrlKey', 'altKey', 'metaKey'].map((modifier) => {
      const event = new KeyboardEvent('keydown', {
        code: 'Tab',
        key: 'Tab',
        bubbles: true,
        cancelable: true,
        [modifier]: true,
      })
      document.activeElement.dispatchEvent(event)
      return event.defaultPrevented
    })
    const escape = new KeyboardEvent('keydown', {
      code: 'Escape',
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    document.activeElement.dispatchEvent(escape)
    return { modified, escape: escape.defaultPrevented }
  })
  assert.deepEqual(
    shortcuts.modified,
    [false, false, false],
    'Browser modifier shortcuts pass through',
  )
  assert.equal(shortcuts.escape, false, 'Escape passes through the Tab guard')
  assert.equal(
    await page.evaluate(
      () => window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)).length,
    ),
    before,
    'Tab, Shift+Tab and typing cannot submit battle commands',
  )
}
async function verifyTabRestoredAfterUnmount(page) {
  await page.evaluate(() => window.unmountBattle())
  const first = page.getByRole('textbox', { name: 'Fixture text entry' })
  const next = page.locator('[data-fixture-next-entry]')
  await first.focus()
  await page.keyboard.press('Tab')
  assert.equal(
    await next.evaluate((element) => document.activeElement === element),
    true,
    'Tab cycles normally after leaving the mounted battle',
  )
  await page.keyboard.press('Shift+Tab')
  assert.equal(
    await first.evaluate((element) => document.activeElement === element),
    true,
    'Shift+Tab cycles normally after leaving the mounted battle',
  )
}
async function verifyFinalFacing(page, viewport, mode) {
  const mobile = await page.evaluate(
    () =>
      matchMedia(
        '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)',
      ).matches,
  )
  const deck = page.locator('[data-unified-command-deck]')
  const finish = deck.locator('[data-battle-command="finish"]')
  assert.equal(await page.locator('[data-battle-brand-crest]').count(), 1)
  await page.evaluate(() => document.fonts.ready)
  const boardBeforeReading = await page.locator('[data-board-auto-fit]').boundingBox()
  const terrain = page.getByRole('button', { name: 'Terrain', exact: true })
  await terrain.click()
  const picker = page.locator('[data-terrain-preview-picker]')
  assert.equal(await picker.getByRole('button').count(), 6)
  await picker.getByRole('button', { name: 'Neutral ground', exact: true }).click()
  assert.match(
    await page.locator('[data-battle-terrain-description]').innerText(),
    /Normal ground costs/,
  )
  await page.getByRole('button', { name: 'Back to Actions', exact: true }).click()
  assert.deepEqual(
    await page.locator('[data-board-auto-fit]').boundingBox(),
    boardBeforeReading,
    'Terrain preserves the battlefield geometry',
  )
  if (mobile) {
    const menu = page.locator('[data-battle-preview-info]')
    const summary = menu.locator('summary')
    await summary.focus()
    await summary.press('Space')
    assert.notEqual(await menu.getAttribute('open'), null)
    await page.keyboard.press('KeyW')
    assert.equal(
      await page.locator('main[data-unified-battle]').getAttribute('data-battle-action-mode'),
      'none',
      'Reading the menu cannot issue a movement command',
    )
    await menu.getByRole('button', { name: 'About Basic Attack', exact: true }).click()
    await page.getByRole('dialog', { name: 'Basic Attack', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    assert.equal(
      await menu.getAttribute('open'),
      null,
      'Escape also dismisses the information menu',
    )
    if (viewport.width === 390) {
      await summary.press('Space')
      await page.setViewportSize({ width: 1366, height: 768 })
      await page.waitForFunction(() => !document.querySelector('[data-battle-preview-info]').open)
      await page.locator('main[data-unified-battle]').focus()
      await page.keyboard.press('KeyI')
      assert.equal(
        await page.locator('main[data-unified-battle]').getAttribute('data-battle-action-mode'),
        'inspect',
        'Desktop shortcuts work after closing the hidden touch menu',
      )
      await page.keyboard.press('Escape')
      await page.setViewportSize(viewport)
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
    }
    assert.equal(
      await page.evaluate(
        () => window.calls.filter((row) => /\/(commit|intents|final-turn)$/.test(row.path)).length,
      ),
      0,
      'Information menu submits no commands',
    )
  }
  const geometry = await deck.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    const cards = [
      ...element.querySelectorAll(
        '[data-command-card], [data-battle-skill-slot], [data-battle-special]',
      ),
    ]
      .map((card) => ({
        id:
          card.getAttribute('data-command-card') ??
          card.getAttribute('data-battle-skill-slot') ??
          card.getAttribute('data-battle-special'),
        rect: card.querySelector('[data-av-square-media], :scope > span').getBoundingClientRect(),
      }))
      .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x)
    const captions = [
      ...element.querySelectorAll('[data-battle-selected-skills] article > small'),
    ].filter((caption) => caption.getBoundingClientRect().height > 0)
    return {
      order: cards.map((card) => card.id),
      gaps: cards.slice(1).map((card, i) => card.rect.x - cards[i].rect.right),
      captionsFit: captions.every((caption) => {
        const range = document.createRange()
        range.selectNodeContents(caption)
        const text = range.getBoundingClientRect()
        const box = caption.getBoundingClientRect()
        return (
          text.bottom <= box.bottom + 1 &&
          text.bottom <= bounds.bottom - 1 &&
          caption.scrollWidth <= caption.clientWidth + 1
        )
      }),
      captionGlyphsFit: captions.every((caption) => {
        const range = document.createRange()
        range.selectNodeContents(caption)
        return range.getBoundingClientRect().bottom <= caption.getBoundingClientRect().bottom + 1
      }),
      headerHeight: document.querySelector('[data-unified-battle-header]').getBoundingClientRect()
        .height,
      headerTextFits: [...document.querySelectorAll('[data-unified-battle-header] strong')].every(
        (label) => {
          const range = document.createRange()
          range.selectNodeContents(label)
          return range.getBoundingClientRect().bottom <= label.getBoundingClientRect().bottom + 1
        },
      ),
    }
  })
  assert.equal(
    mobile ? geometry.captionGlyphsFit : geometry.captionsFit,
    true,
    'Discipline captions retain full glyph height; desktop labels fit the cockpit',
  )
  assert.equal(geometry.headerTextFits, true, 'Header text has room for its full glyph height')
  if (!mobile) {
    assert.equal(
      geometry.order.at(-1),
      'finish',
      'Desktop End Turn follows every Skill and special slot',
    )
    assert.ok(
      Math.max(...geometry.gaps) - Math.min(...geometry.gaps) <= 1,
      `Every desktop artwork gap is equal: ${JSON.stringify(geometry.gaps)}`,
    )
    assert.ok(geometry.headerHeight <= 56, `Desktop header stays compact: ${geometry.headerHeight}`)
  } else {
    assert.deepEqual(geometry.order.slice(0, 6), [
      'items',
      'inspect',
      'move',
      'attack',
      'guard',
      'finish',
    ])
  }
  const boardBefore = await page.locator('[data-board-auto-fit]').boundingBox()
  if (mobile) await finish.tap()
  else await finish.click()
  const facing = page
    .locator('[data-battle-preview-strip]')
    .getByRole('group', { name: 'Choose final facing', exact: true })
  await facing.waitFor({ state: 'visible' })
  assert.equal(
    await deck.locator('[data-unified-facing-pad], button[aria-label^="Face "]').count(),
    0,
    'No duplicate cockpit direction controls',
  )
  assert.equal(await facing.getByRole('button').count(), 4)
  assert.equal(
    await page.evaluate(
      () => window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)).length,
    ),
    0,
    'Opening End Turn never submits',
  )
  const north = facing.getByRole('button', { name: 'Face north', exact: true })
  const color = await north.evaluate((button) =>
    getComputedStyle(button).backgroundColor.match(/\d+/g).slice(0, 3).map(Number),
  )
  assert.ok(
    color[0] > color[1] * 1.5 && color[0] > color[2] * 1.5,
    'Preview direction buttons are red',
  )
  const boardAfter = await page.locator('[data-board-auto-fit]').boundingBox()
  assert.deepEqual(boardAfter, boardBefore, 'Opening facing never resizes the battlefield')
  await page.screenshot({
    path: resolve(output, `${mode}-${viewport.width}-final-facing.png`),
    fullPage: true,
  })
  if (mobile) await north.tap()
  else await north.click()
  await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
  const commits = await page.evaluate(() =>
    window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)),
  )
  assert.equal(commits.length, 1, 'One direction gesture sends exactly one authoritative request')
  assert.equal(mode === 'pve' ? commits[0].body.facing : commits[0].body.intent.facing, 'north')
}
try {
  for (const mode of ['pve', 'pvp', 'spectator']) {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
      { width: 821, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 640 },
      { width: 844, height: 390 },
    ]) {
      for (const gesture of mode === 'spectator'
        ? ['tab-focus']
        : ['final-facing', 'move-pointer', 'move-direction', 'attack-pointer']) {
        if (viewport.height < 500 && gesture !== 'final-facing') continue
        const captureFlames =
          mode === 'pve' && viewport.width === 1366 && gesture === 'move-pointer'
        const page = await browser.newPage({
          viewport,
          ...(captureFlames ? { recordVideo: { dir: output, size: viewport } } : {}),
          isMobile: viewport.width < 821 || viewport.height < 500,
          hasTouch: viewport.width < 821 || viewport.height < 500,
        })
        page.setDefaultTimeout(5000)
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(
          server.resolvedUrls.local[0] + `?mode=${mode}${mode === 'pvp' ? '&chat=1' : ''}`,
          { waitUntil: 'domcontentloaded', timeout: 20000 },
        )
        const root = page.locator('main')
        await root.waitFor()
        if (gesture === 'final-facing') {
          if (viewport.width < 821 || viewport.height < 500) {
            await root.focus()
            await page.keyboard.press('Digit9')
            const reader = page.locator('[data-battle-info-panel]')
            await reader.waitFor({ state: 'visible' })
            assert.match(await reader.innerText(), /Severance \/ Ascension/)
            assert.equal(
              await page.evaluate(
                () =>
                  window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path))
                    .length,
              ),
              0,
              'A mobile hardware reader shortcut never submits a command',
            )
            await page.keyboard.press('Escape')
            await reader.waitFor({ state: 'hidden' })
            await page.keyboard.press('Escape')
          }
          await verifyFinalFacing(page, viewport, mode)
          await page.close()
          console.log(
            `${mode} ${viewport.width}: cockpit spacing, captions, header and preview-only final facing passed`,
          )
          continue
        }
        if (mode === 'pvp' && gesture === 'move-pointer') await verifyChatComposer(page)
        if (captureFlames) {
          // Record the actual shared emblem for visual review through a full slow glow cycle.
          await page.waitForTimeout(8000)
          await page.screenshot({
            path: resolve(output, 'smooth-versus-desktop.png'),
            fullPage: true,
          })
        }
        await verifyTabGuard(page)
        if (mode === 'spectator') {
          await verifyTabRestoredAfterUnmount(page)
          await page.close()
          console.log(
            `${mode} ${viewport.width}: Tab/Shift+Tab prevention and unmount restoration passed`,
          )
          continue
        }
        const items = page.locator('button[data-command-slot="items"]')
        assert.equal(await items.isDisabled(), true, 'Items stays locked in each playable mode')
        assert.equal(await items.locator('strong').innerText(), 'Items')
        const deck = page.locator('[data-unified-command-deck]')
        assert.equal(
          await deck.locator('[data-command-slot]').first().getAttribute('data-command-slot'),
          'items',
        )
        assert.equal(
          await deck.locator('[data-command-slot]').nth(1).getAttribute('data-command-slot'),
          'inspect',
        )
        const geometry = await page.evaluate(() => {
          const deck = document.querySelector('[data-unified-command-deck]')
          const probe = document.createElement('span')
          probe.style.cssText =
            'position:absolute;visibility:hidden;width:var(--av-cockpit-art-size);height:1px'
          deck.append(probe)
          const expected = probe.getBoundingClientRect().width
          probe.remove()
          const frames = [...deck.querySelectorAll('[data-av-square-media="true"]')]
            .filter((element) => element.getBoundingClientRect().width > 0)
            .map((element) => element.getBoundingClientRect())
          const itemsCaption = deck.querySelector('[data-battle-items-locked]')
          return {
            expected,
            frames: frames.map(({ width, height }) => ({ width, height })),
            overflows: document.documentElement.scrollWidth > innerWidth,
            itemsCaptionRemoved: itemsCaption === null,
            footerGap:
              document.querySelector('[data-unified-battle-footer]').getBoundingClientRect().top -
              deck.getBoundingClientRect().bottom,
          }
        })
        assert.equal(geometry.overflows, false, 'Items introduces no horizontal page overflow')
        assert.equal(
          geometry.itemsCaptionRemoved,
          true,
          'Coming soon no longer takes cockpit space',
        )
        if (viewport.width >= 821)
          assert.ok(geometry.footerGap >= 4, 'Cockpit keeps a visible inset above the footer')
        for (const frame of geometry.frames) {
          assert.ok(
            frame.width <= geometry.expected + 1 && frame.width >= Math.min(24, geometry.expected),
            'Cockpit artwork preserves its existing shared size',
          )
          assert.ok(Math.abs(frame.width - frame.height) <= 1, 'Every artwork frame stays square')
        }
        await deck.locator('[data-command-slot="inspect"]').focus()
        const beforeItemsKey = await page.evaluate(
          () =>
            window.calls.filter((call) => /\/(commit|intents|final-turn|preview)$/.test(call.path))
              .length,
        )
        await page.keyboard.press('p')
        assert.equal(
          await page.evaluate(
            () =>
              window.calls.filter((call) =>
                /\/(commit|intents|final-turn|preview)$/.test(call.path),
              ).length,
          ),
          beforeItemsKey,
          'The locked Items key issues no command or preview',
        )
        // Hold only transport boundaries. The production component owns selection, execution,
        // request startup and locks; no fake interaction controller is mounted.
        await page.evaluate(() => {
          const fixtureFetch = window.fetch
          window.commandStarts = []
          window.forecastStarts = []
          window.releaseCommand = null
          window.releaseForecast = null
          const commandHold = new Promise((resolve) => {
            window.releaseCommand = resolve
          })
          const forecastHold = new Promise((resolve) => {
            window.releaseForecast = resolve
          })
          window.fetch = async (url, options = {}) => {
            const path = String(url)
            if (/\/(commit|intents)$/.test(path)) {
              window.commandStarts.push({ path, body: JSON.parse(options.body) })
              await commandHold
            } else if (path.endsWith('/preview')) {
              window.forecastStarts.push({ path, body: JSON.parse(options.body) })
              await forecastHold
            }
            return fixtureFetch(url, options)
          }
        })
        const attack = gesture === 'attack-pointer'
        await page.locator(`[data-battle-command="${attack ? 'attack' : 'move'}"]`).click()
        await verifyTabGuard(page)
        const destination = page.getByRole('button', {
          name: attack ? /occupied by Recruit 2/ : /^Tile 4, 3;/,
        })
        const reachable = await page.locator('#battlefield [data-reachable]').count()
        if (attack) {
          await page.waitForFunction(() => window.forecastStarts.length > 0)
          assert.equal(
            await page.locator('#battlefield [data-selected]').count(),
            0,
            'Automatic aim retains forecasts without painting an inspection box',
          )
        } else {
          assert.ok(reachable > 1, 'Full movement range remains available')
        }
        await root.focus()
        await page.keyboard.press('Shift')
        await destination.focus()
        const outline = await destination.evaluate((tile) => getComputedStyle(tile).outlineStyle)
        assert.equal(outline, 'none', 'Ready commands do not paint a tile focus rectangle')
        // Register after arming has refreshed the native key listener. Recording at the end
        // of the same input event rejects timer/frame/forecast waits before fetch starts.
        await page.evaluate((directional) => {
          window.requestStartsAtGestureEnd = null
          const record = (event) => {
            if (directional && event.code !== 'KeyW') return
            window.requestStartsAtGestureEnd = window.commandStarts.length
            window.removeEventListener(directional ? 'keydown' : 'click', record)
          }
          window.addEventListener(directional ? 'keydown' : 'click', record)
        }, gesture === 'move-direction')
        if (gesture === 'move-direction') await page.keyboard.press('KeyW')
        else if (viewport.width < 821) await destination.tap()
        else await destination.click()
        assert.equal(
          await page.evaluate(() => window.requestStartsAtGestureEnd),
          1,
          'The commit fetch starts in the deliberate input event, without a client dwell',
        )
        // This happens while both the forecast and authoritative response remain held.
        await page.waitForFunction(() => window.commandStarts.length === 1)
        const starts = await page.evaluate(() => window.commandStarts)
        assert.equal(starts[0].path.endsWith(mode === 'pvp' ? '/commit' : '/intents'), true)
        assert.equal(starts[0].body.expectedBattleVersion, 1)
        assert.deepEqual(
          starts[0].body.intent,
          attack
            ? {
                kind: 'action',
                actionId: 'basic.attack.unarmed.basic',
                target: { kind: 'unit', combatantId: 'enemy-two' },
                manualModifiers: [],
              }
            : {
                kind: 'move',
                path: [
                  { x: 3, y: 3 },
                  { x: 3, y: 2 },
                ],
              },
        )
        assert.equal(
          await page.evaluate(() => window.fixtureBattle.battleVersion),
          1,
          'The request starts without optimistic authoritative state',
        )
        assert.equal(
          await page.locator('#battlefield [data-path]').count(),
          0,
          'Submitting movement never flashes the origin or chosen route',
        )
        assert.equal(
          await page.locator('#battlefield [data-selected]').count(),
          0,
          'Executing an action never flashes an inspection box',
        )
        await root.focus()
        await page.keyboard.press('Shift')
        await destination.focus()
        assert.equal(
          await destination.evaluate((tile) => getComputedStyle(tile).outlineStyle),
          'none',
          'Pending execution hides only the redundant focus rectangle',
        )
        if (!attack)
          assert.equal(
            await page.locator('#battlefield [data-reachable]').count(),
            reachable,
            'Submitting movement preserves the full range guidance',
          )
        await destination.dispatchEvent('click')
        await page.keyboard.press(attack ? 'KeyA' : 'KeyW')
        await page.evaluate(() =>
          window.dispatchEvent(
            new KeyboardEvent('keydown', {
              code: 'KeyW',
              key: 'w',
              repeat: true,
              bubbles: true,
            }),
          ),
        )
        assert.equal(
          await page.evaluate(() => window.commandStarts.length),
          1,
          'Pointer, directional and repeated keys cannot submit during a pending command',
        )
        await page.screenshot({
          path: resolve(output, `${mode}-${viewport.width}-${gesture}.png`),
          fullPage: true,
        })
        await page.evaluate(() => window.releaseCommand())
        await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
        await page.waitForFunction(
          () => !document.querySelector('main').hasAttribute('data-battle-execution-pending'),
        )
        await destination.focus()
        assert.equal(
          await destination.evaluate((tile) => getComputedStyle(tile).outlineStyle),
          'none',
          'The tile focus rectangle stays absent after the authoritative response settles',
        )
        await page.evaluate(() => window.releaseForecast())
        await page.locator('[data-battle-command="inspect"]').click()
        const ally = page.getByRole('button', { name: /occupied by Ally 1/ })
        await ally.click()
        assert.equal(
          await ally.getAttribute('data-selected'),
          'true',
          'Deliberate inspection retains its selection cue',
        )
        assert.equal(await page.evaluate(() => window.commandStarts.length), 1)
        await verifyTabRestoredAfterUnmount(page)
        await page.close()
        console.log(
          `${mode} ${viewport.width} ${gesture}: immediate request, quiet pending feedback, range/focus and duplicate guards passed`,
        )
      }
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
