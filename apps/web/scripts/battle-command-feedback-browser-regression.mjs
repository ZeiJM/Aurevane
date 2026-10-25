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
const { openBattleInfoMenu } = await import(
  pathToFileURL(resolve(web, 'e2e/battle-info-menu-helpers.ts'))
)
const { expectTerrainKey } = await import(
  pathToFileURL(resolve(web, 'e2e/battle-map-key-helpers.ts'))
)
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
await fs.writeFile(
  resolve(fixture, 'reader.html'),
  '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/reader.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'reader.jsx'),
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {BattleCockpitInfoProvider, BattleCockpitInfo, BattlePreviewInfoMenu} from '@/components/battle/battle-cockpit-info';
import {MechanicTextView} from '@/components/character/mechanic-text-view';
import styles from '@/components/battle/battle-mobile-layout.module.css';
import './production-styles';
createRoot(document.getElementById('root')).render(
  <BattleCockpitInfoProvider>
    <main className={styles.shell} data-battle-mobile-stage="true" data-battle-keyboard-focus-root="true" tabIndex={-1} style={{height:'100dvh'}}>
      <header>Reader regression</header>
      <section data-unified-battle-content="true">
        <div className={styles.lowerPanel}>
          <div data-battle-preview-strip="true"><BattlePreviewInfoMenu /></div>
          <BattleCockpitInfo selectionKey="attack" label="About linked Skill" title="Linked Skill" consumeOutsideClick trigger="i">
            <MechanicTextView text="Guard" parts={[{tag:'guarded',label:'Guard',explanation:'A linked Guard explanation.'}]} />
          </BattleCockpitInfo>
        </div>
      </section>
      <button data-reader-outside="true" onClick={()=>{window.outsideActions=(window.outsideActions??0)+1}}>Outside action</button>
    </main>
  </BattleCockpitInfoProvider>
);`,
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
async function verifyCooldownAlignment() {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    const page = await browser.newPage({ viewport, isMobile: true, hasTouch: true })
    await page.goto(server.resolvedUrls.local[0] + '?mode=pvp&cooldownOverlay=1')
    const countdown = page.locator('[data-battle-cooldown-countdown]').first()
    await countdown.waitFor()
    const geometry = await countdown.evaluate((el) => {
      const a = el.parentElement.getBoundingClientRect(),
        b = el.getBoundingClientRect()
      return {
        dx: Math.abs(a.x + a.width / 2 - b.x - b.width / 2),
        dy: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
      }
    })
    assert.ok(
      geometry.dx <= 1 && geometry.dy <= 1,
      `Mobile cooldown centres within actual artwork at ${viewport.width}: ${JSON.stringify(geometry)}`,
    )
    await page.close()
  }
}
async function verifyTerrainTurnStability() {
  const viewports = [
    { width: 1536, height: 614 },
    { width: 1366, height: 768 },
    { width: 1024, height: 576 },
    { width: 821, height: 768 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]
  for (const mode of ['pvp', 'pve']) {
    const names =
      mode === 'pvp' ? ['TerrainGuest ABCDEFG', 'W'.repeat(24), '界'.repeat(24)] : ['Recruit']
    for (const name of names)
      for (const viewport of viewports) {
        const mobile = viewport.width < 821 || (viewport.width <= 980 && viewport.height < 500)
        const page = await browser.newPage({ viewport, hasTouch: mobile, isMobile: mobile })
        page.setDefaultTimeout(5000)
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(
          server.resolvedUrls.local[0] +
            `?mode=${mode}&chat=1&turnName=${encodeURIComponent(name)}`,
        )
        await page.locator('[data-board-auto-fit]').waitFor()
        await page.evaluate(async () => {
          await document.fonts.ready
          await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
          window.advanceBattle('enemy-one')
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
        })
        const status = page.locator('[data-battle-preview-strip]')
        assert.equal(await status.getAttribute('data-battle-turn-state'), 'waiting')
        const title = await page.locator('[data-battle-instruction-title]').innerText()
        if (mode === 'pvp') assert.equal(title, `Waiting for ${name}`)
        else assert.match(title, /^Waiting for Recruit(?: \d+)?$/)
        const board = page.locator('[data-board-auto-fit]')
        const before = await board.boundingBox()
        if (!mobile)
          assert.equal(
            (await status.boundingBox()).height,
            44,
            'The full waiting title fits the existing preview row',
          )
        const clipped = await page
          .locator('[data-battle-instruction-title]')
          .evaluate((element) => {
            const caption = element.getBoundingClientRect()
            const strip = element.closest('[data-battle-preview-strip]').getBoundingClientRect()
            const range = document.createRange()
            range.selectNodeContents(element)
            return [...range.getClientRects()].some(
              (rect) =>
                rect.left < caption.left - 1 ||
                rect.right > caption.right + 1 ||
                rect.top < strip.top + 1 ||
                rect.bottom > strip.bottom - 1,
            )
          })
        assert.equal(
          clipped,
          false,
          `The complete turn caption stays readable: ${mode} ${name} ${viewport.width}x${viewport.height}`,
        )
        if (mode === 'pvp' && name === 'TerrainGuest ABCDEFG' && viewport.width === 1536)
          await page.screenshot({ path: resolve(output, 'pvp-waiting-turn-1536.png') })
        await expectTerrainKey(page)
        assert.deepEqual(
          await board.boundingBox(),
          before,
          'Terrain and Back preserve the waiting-turn battlefield',
        )
        await page.evaluate(async () => {
          window.advanceBattle('character:player')
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          )
        })
        assert.deepEqual(
          await board.boundingBox(),
          before,
          'Turn handoff preserves battlefield geometry',
        )
        assert.equal(
          await page.evaluate(
            () =>
              window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path))
                .length,
          ),
          0,
          'Reading Terrain does not issue combat commands',
        )
        await page.close()
      }
  }
  console.log(
    'Waiting-turn captions, Terrain and handoff keep the board fixed across modes and legal long names',
  )
}
async function verifyTurnCues() {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport,
      isMobile: viewport.width < 821,
      hasTouch: viewport.width < 821,
    })
    await page.goto(server.resolvedUrls.local[0] + '?mode=pvp')
    const status = page.locator('[data-battle-preview-strip]')
    assert.equal(await status.getAttribute('data-battle-turn-state'), 'yours')
    const ownColour = await page
      .locator('[data-battle-instruction-title]')
      .evaluate((el) => getComputedStyle(el).color)
    await page.evaluate(() => window.advanceBattle('enemy-one'))
    await page.waitForFunction(
      () =>
        document.querySelector('[data-battle-preview-strip]').dataset.battleTurnState === 'waiting',
    )
    assert.match(await page.locator('[data-battle-instruction-title]').innerText(), /^Waiting for /)
    assert.notEqual(
      await page
        .locator('[data-battle-instruction-title]')
        .evaluate((el) => getComputedStyle(el).color),
      ownColour,
      'Turn text has distinct readable ownership colours',
    )
    await page.evaluate(() => window.advanceBattle('character:player'))
    await page.waitForFunction(
      () =>
        document.querySelector('[data-battle-preview-strip]').dataset.battleTurnState === 'yours',
    )
    await page.close()
  }
}
async function verifyLogHistory() {
  for (const mode of ['pve', 'pvp']) {
    const page = await browser.newPage({
      viewport: { width: 320, height: 640 },
      isMobile: true,
      hasTouch: true,
    })
    await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}`)
    await page.locator('[data-battle-current-round-toggle]').waitFor()
    await page.evaluate(() => {
      const original = window.fetch
      window.fetch = async (url, options) => {
        const response = await original(url, options)
        if (!String(url).endsWith('/events')) return response
        return Response.json({
          battleLog: {
            entries: Array.from({ length: 50 }, (_, i) => ({
              battleVersion: i + 1,
              eventIndex: 0,
              occurredAt: '2026-10-24T00:00:00Z',
              round: Math.floor(i / 10) + 1,
              turnNumber: i + 1,
              actorCombatantId: 'character:player',
              targetCombatantId: 'enemy-one',
              actionId: 'fixture.history',
              actionLabel: 'Recorded Skill',
              eventType: 'combat_action_used',
              kind: 'offense',
              message: '',
              messageTemplate: '',
              templateValues: {},
              facts: [],
              headline: 'Recorded Skill',
              tone: 'neutral',
            })),
          },
        })
      }
      window.fixtureBattle.snapshot.tactical.battle.round = 5
      window.advanceBattle('character:player')
    })
    const toggle = page.locator('[data-battle-current-round-toggle]')
    await toggle.click()
    const workspace = page.locator('[data-battle-mobile-log-workspace]')
    const older = workspace.locator('[data-chronicle-round="2"] button').first()
    await older.click()
    assert.equal(await older.getAttribute('aria-expanded'), 'true')
    const requests = await page.evaluate(
      () => window.calls.filter((c) => c.path.endsWith('/events')).length,
    )
    await toggle.click()
    await toggle.click()
    assert.equal(
      await older.getAttribute('aria-expanded'),
      'true',
      'Closing/reopening log preserves deliberate round expansion',
    )
    assert.equal(
      await page.evaluate(() => window.calls.filter((c) => c.path.endsWith('/events')).length),
      requests,
      'Log toggles reuse the mounted history reader without duplicate fetching',
    )
    await page.setViewportSize({ width: 1024, height: 768 })
    await page
      .locator('main')
      .evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
    await page.setViewportSize({ width: 320, height: 640 })
    await workspace.waitFor({ state: 'visible' })
    assert.equal(
      await older.getAttribute('aria-expanded'),
      'true',
      'History survives desktop/mobile rotation',
    )
    await page.locator('main').focus()
    await page.keyboard.press('KeyL')
    await workspace.waitFor({ state: 'hidden' })
    await page.keyboard.press('KeyL')
    await workspace.waitFor({ state: 'visible' })
    assert.equal(
      await older.getAttribute('aria-expanded'),
      'true',
      'The existing log shortcut toggles the retained reader',
    )
    await page.close()
  }
}
async function verifyMobileWorkspace(page, mode) {
  const root = page.locator('main')
  const mobile = await root.evaluate(
    () =>
      matchMedia(
        '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)',
      ).matches,
  )
  if (!mobile || mode === 'spectator') return
  const board = await page.locator('#battlefield').boundingBox()
  const toggle = page.locator('[data-battle-current-round-toggle]')
  await toggle.click()
  await page.locator('[data-battle-mobile-log-workspace]').waitFor({ state: 'visible' })
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
  await page.keyboard.press('KeyA')
  assert.equal(
    await page.evaluate(
      () =>
        window.calls.filter(
          (call) => call.method === 'POST' && /\/(commit|intents|final-turn)$/.test(call.path),
        ).length,
    ),
    0,
    'Reading the log cannot issue a combat command',
  )
  await toggle.click()
  await page.locator('[data-battle-mobile-log-workspace]').waitFor({ state: 'hidden' })
  const after = await page.locator('#battlefield').boundingBox()
  assert.ok(
    Math.abs(board.height - after.height) <= 1 && Math.abs(board.y - after.y) <= 1,
    'Log toggle retains battlefield geometry',
  )
  if (mode === 'pvp') {
    const geometry = await page.locator('main > footer').evaluate((footer) => {
      const controls = [...footer.querySelectorAll('button')].filter(
        (b) => b.getClientRects().length,
      )
      const boxes = controls.map((b) => b.getBoundingClientRect())
      const bounds = footer.getBoundingClientRect()
      return {
        height: bounds.height,
        tops: boxes.map((b) => b.top),
        bottoms: boxes.map((b) => b.bottom),
        contained: boxes.every((b) => b.left >= bounds.left && b.right <= bounds.right + 1),
        gaps: boxes
          .sort((a, b) => a.left - b.left)
          .slice(1)
          .map((b, i) => b.left - boxes[i].right),
      }
    })
    assert.ok(
      geometry.height <= 48,
      `Single-row footer retains its compact height: ${JSON.stringify(geometry)}`,
    )
    assert.ok(
      Math.max(...geometry.tops) - Math.min(...geometry.tops) <= 2,
      'All footer controls share one row',
    )
    assert.equal(geometry.contained, true, 'All footer controls remain reachable')
    assert.ok(
      geometry.gaps.every((g) => g >= 2),
      `Footer controls have real gaps: ${JSON.stringify(geometry)}`,
    )
  }
  const countdowns = page.locator('[data-battle-cooldown-countdown]')
  for (const countdown of await countdowns.all()) {
    if (!(await countdown.isVisible())) continue
    const geometry = await countdown.evaluate((el) => {
      const a = el.parentElement.getBoundingClientRect(),
        b = el.getBoundingClientRect()
      return {
        dx: Math.abs(a.x + a.width / 2 - b.x - b.width / 2),
        dy: Math.abs(a.y + a.height / 2 - b.y - b.height / 2),
      }
    })
    assert.ok(
      geometry.dx <= 1 && geometry.dy <= 1,
      `Cooldown centres within its actual artwork: ${JSON.stringify(geometry)}`,
    )
  }
}
async function verifyChatComposer(page) {
  await page.locator('main > footer button').filter({ hasText: /^Chat/ }).click()
  const panel = page.locator('#pvp-battle-chat-panel[data-open]')
  await panel.waitFor({ state: 'visible' })
  await panel.getByText('A local fixture message for checking battle chat layout.').waitFor()
  assert.equal(
    await panel.getByRole('tab', { name: 'Battle Log', exact: true }).count(),
    0,
    'Chat contains actual messages, never a log tab',
  )
  const mobile = await page
    .locator('main')
    .evaluate(
      () =>
        matchMedia(
          '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)',
        ).matches,
    )
  if (mobile) {
    assert.equal(
      await panel.locator('..').getAttribute('data-battle-mobile-chat-host'),
      'true',
      'Chat occupies the shared lower workspace',
    )
    assert.equal(
      await panel.getByRole('button', { name: 'Close battle communication' }).isVisible(),
      false,
      'The mobile footer toggle replaces the close X',
    )
  }
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
  await page.locator('main > footer button').filter({ hasText: /^Chat/ }).click()
  await panel.waitFor({ state: 'visible' })
  assert.equal(
    await panel.getByRole('textbox', { name: 'Battle chat message' }).inputValue(),
    'Local fixture text',
    'Unsent chat survives toggling',
  )
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
async function verifyWrappedPreviewParity() {
  const rows = []
  for (const mode of ['pve', 'pvp']) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}`)
    const title = page.locator('[data-battle-instruction-title]')
    await title.waitFor()
    await page.evaluate(() => document.fonts.ready)
    if (mode === 'pvp')
      await title.evaluate((e) => {
        e.textContent = 'Opponent’s Turn'
        e.style.maxWidth = '5rem'
      })
    rows.push(
      await title.evaluate((e) => ({
        mode: e.closest('main').dataset.battleKind,
        preview: e.closest('[data-battle-preview-strip]').getBoundingClientRect().height,
        board: document.querySelector('#battlefield').getBoundingClientRect().height,
        lines: e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight),
      })),
    )
    await page.close()
  }
  assert.ok(
    rows[1].lines >= 1.9 && rows[1].lines <= 2.1,
    `Parity probe uses a two-line turn title: ${JSON.stringify(rows)}`,
  )
  assert.ok(
    Math.abs(rows[0].preview - rows[1].preview) <= 1.5 &&
      Math.abs(rows[0].board - rows[1].board) <= 1.5,
    `A wrapped turn title preserves PvE/PvP preview and battlefield geometry: ${JSON.stringify(rows)}`,
  )
}
async function verifyFinalFacing(page, viewport, mode) {
  if (viewport.width < 821 || viewport.height < 500) {
    const arrows = await page
      .locator('#battlefield [data-battle-facing-indicator="true"]')
      .evaluateAll((elements) =>
        elements.map((arrow) => {
          const bounds = arrow.getBoundingClientRect()
          const tile = arrow.parentElement.getBoundingClientRect()
          return {
            width: bounds.width,
            height: bounds.height,
            left: bounds.left - tile.left,
            top: bounds.top - tile.top,
            right: bounds.right - tile.right,
            bottom: bounds.bottom - tile.bottom,
          }
        }),
      )
    assert.ok(arrows.length > 0, 'Production fixture contains facing markers')
    for (const arrow of arrows) {
      assert.ok(
        arrow.width >= 8 && arrow.height >= 8 && arrow.width <= 10.1 && arrow.height <= 10.1,
        `Mobile facing markers retain the approved 8–10px tile-relative size: ${JSON.stringify(arrow)}`,
      )
      assert.ok(
        arrow.left >= 1 && arrow.left <= 3 && arrow.top >= -1 && arrow.top <= 3,
        'Facing markers remain at the tile corner',
      )
      assert.ok(arrow.right <= 1 && arrow.bottom <= 1, 'Facing markers remain inside their tile')
    }
  }
  const mobile = await page.evaluate(
    () =>
      matchMedia(
        '(max-width: 820px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)',
      ).matches,
  )
  const deck = page.locator('[data-unified-command-deck]')
  const finish = deck.locator('[data-battle-command="finish"]')
  assert.equal(await page.locator('[data-battle-brand-crest]').count(), mobile ? 1 : 0)
  await page.evaluate(() => document.fonts.ready)
  const artworkFrames = await deck
    .locator('[data-av-square-media], [aria-label="Empty selected Skill slot"]')
    .evaluateAll((frames) =>
      frames.map((frame) => ({
        label: frame.getAttribute('aria-label') ?? 'Command artwork',
        width: frame.getBoundingClientRect().width,
        height: frame.getBoundingClientRect().height,
      })),
    )
  assert.ok(artworkFrames.some((frame) => frame.label === 'Empty selected Skill slot'))
  for (const frame of artworkFrames)
    assert.ok(
      Math.abs(frame.width - frame.height) <= 1,
      `${frame.label} stays square: ${JSON.stringify(frame)}`,
    )
  if (mobile && viewport.height > 500) {
    assert.ok(
      Math.min(...artworkFrames.map((frame) => frame.width)) >= 34,
      'Portrait phone cockpit artwork is enlarged',
    )
    const rails = await page.locator('[data-battle-side="local"]').boundingBox()
    assert.ok(rails.height <= 80, `Character rails stay compact: ${rails.height}`)
  }
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
    const host = page.locator('[data-battle-preview-info]')
    assert.equal(await host.locator('summary').count(), 0, 'No all-report menu remains')
    assert.equal(
      await host.locator('[data-battle-info-trigger]:visible').count(),
      0,
      'Idle preview has no information button',
    )
    const readers = host.locator('[data-battle-preview-reader]')
    assert.equal(await readers.count(), 12, 'Every complete report remains available')
    for (const wrapper of await readers.all()) {
      const key = await wrapper.getAttribute('data-battle-preview-reader')
      const selector = key.startsWith('skill')
        ? `[data-battle-skill-slot="${key.slice(5)}"]`
        : key === 'essence'
          ? '[data-battle-special="essence"], [data-battle-special="resonance"]'
          : key === 'supernatural'
            ? '[data-battle-special="supernatural"]'
            : `[data-command-card="${key}"]`
      const box = await deck.locator(selector).boundingBox()
      // Select even disabled/passive slots without activating an available gameplay command.
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(10, box.height / 2))
      await page.mouse.down()
      await page.mouse.move(2, 2)
      await page.mouse.up()
      const info = wrapper.locator('[data-battle-info-trigger]')
      await info.waitFor({ state: 'visible' })
      assert.equal(await host.locator('[data-battle-info-trigger]:visible').count(), 1)
      await info.click()
      const panel = page.locator('[data-battle-info-panel]')
      await panel.waitFor()
      assert.match(
        await panel.innerText(),
        /Parameters|Skill|Inspect|Items|Turn|Ascension|Resonance/,
      )
      await page.keyboard.press('KeyW')
      assert.equal(
        await page.locator('main').getAttribute('data-battle-action-mode'),
        'none',
        'Reading cannot issue a movement command',
      )
      await page.keyboard.press('Escape')
      await panel.waitFor({ state: 'hidden' })
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      )
      assert.equal(
        await info.evaluate((button) => document.activeElement === button),
        true,
        `Closing ${key} restores focus to its contextual information button: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 350))}`,
      )
    }
    await page.locator('main').focus()
    await page.keyboard.press('Escape')
    assert.equal(await host.locator('[data-battle-info-trigger]:visible').count(), 0)
    await openBattleInfoMenu(page, 'About Inspect')
    await host.getByRole('button', { name: 'About Inspect', exact: true }).click()
    await page.getByRole('dialog', { name: 'Inspect', exact: true }).waitFor()
    const attackReader = host.getByRole('button', {
      name: 'About Basic Attack',
      exact: true,
      includeHidden: true,
    })
    await attackReader.evaluate((button) => button.click())
    await page.getByRole('dialog', { name: 'Basic Attack', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await page.locator('[data-battle-info-panel]').waitFor({ state: 'hidden' })
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    )
    assert.equal(
      await attackReader.evaluate((button) => button === document.activeElement),
      true,
      'Replacing the reader also restores the current contextual trigger',
    )
    const attack = deck.locator('[data-battle-command="attack"]')
    await attack.click()
    await host.getByRole('button', { name: 'About Basic Attack', exact: true }).click()
    await page.getByRole('dialog', { name: 'Basic Attack', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await openBattleInfoMenu(page, 'About selected Skill slot 4')
    await host.getByRole('button', { name: 'About selected Skill slot 4', exact: true }).waitFor()
    await page.keyboard.press('Digit2')
    await host.getByRole('button', { name: 'About Basic Attack', exact: true }).waitFor()
    await page.keyboard.press('Digit3')
    await host.getByRole('button', { name: 'About Guard', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    assert.equal(await host.locator('[data-battle-info-trigger]:visible').count(), 0)
    assert.equal(
      await page.evaluate(
        () => window.calls.filter((row) => /\/(commit|intents|final-turn)$/.test(row.path)).length,
      ),
      0,
      'Reading and selection submit no authoritative command',
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
  // A long instruction and larger text must grow the desktop strip rather than crop its last line.
  if (!mobile) {
    const title = page.locator('[data-battle-instruction-title]')
    const original = await title.innerText()
    await title.evaluate((e) => {
      e.textContent = 'Choose the final facing for your combatant'
      e.style.fontSize = '24px'
    })
    const textFits = await title.evaluate((e) => {
      const range = document.createRange()
      range.selectNodeContents(e)
      const text = range.getBoundingClientRect()
      const strip = e.closest('[data-battle-preview-strip]').getBoundingClientRect()
      return (
        text.top >= strip.top + 1 &&
        text.bottom <= strip.bottom - 1 &&
        text.right <= e.getBoundingClientRect().right + 1
      )
    })
    assert.equal(
      textFits,
      true,
      'Long larger instruction text remains fully readable within the preview',
    )
    await title.evaluate((e, text) => {
      e.textContent = text
      e.style.fontSize = ''
    }, original)
  }
  const clippedText = await page.locator('[data-battle-preview-strip]').evaluate((strip) => {
    const bounds = strip.getBoundingClientRect()
    const walker = document.createTreeWalker(strip, NodeFilter.SHOW_TEXT)
    const clipped = []
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node.textContent.trim() || !node.parentElement.checkVisibility()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects())
        if (rect.top < bounds.top + 1 || rect.bottom > bounds.bottom - 1)
          clipped.push({
            text: node.textContent,
            top: rect.top,
            bottom: rect.bottom,
            bounds: bounds.toJSON(),
          })
    }
    return clipped
  })
  assert.deepEqual(clippedText, [], 'Final-facing preview retains every visible text glyph')
  if (mobile) await north.tap()
  else await north.click()
  await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
  const commits = await page.evaluate(() =>
    window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)),
  )
  assert.equal(commits.length, 1, 'One direction gesture sends exactly one authoritative request')
  assert.equal(mode === 'pve' ? commits[0].body.facing : commits[0].body.intent.facing, 'north')
}
async function verifyNestedReaderDismissal() {
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    isMobile: true,
    hasTouch: true,
  })
  page.setDefaultTimeout(5000)
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(server.resolvedUrls.local[0] + 'reader.html')
  const menu = page.locator('[data-battle-preview-info]')
  await menu.locator('[data-battle-info-trigger]').evaluate((button) => button.click())
  const parent = page.getByRole('dialog', { name: 'Linked Skill', exact: true })
  const term = parent.getByRole('button', { name: 'Explain Guard', exact: true })
  for (const dismissal of ['Escape', 'outside']) {
    await term.click()
    await page.getByRole('dialog', { name: 'Guard', exact: true }).waitFor()
    if (dismissal === 'Escape') await page.keyboard.press('Escape')
    else await page.locator('[data-reader-outside]').dispatchEvent('click')
    await page.waitForFunction(
      () => document.querySelectorAll('[data-battle-info-panel]').length === 1,
    )
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    assert.equal(
      await term.evaluate((button) => button === document.activeElement),
      true,
      'Dismissing a linked term preserves parent-reader focus',
    )
    assert.equal(
      await page.evaluate(() => window.outsideActions ?? 0),
      0,
      'Dismissing the child cannot activate the outside action',
    )
  }
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[data-battle-info-panel]'))
  await page.waitForFunction(() => document.activeElement?.matches('[data-battle-info-trigger]'))
  assert.equal(await menu.locator('[data-battle-info-trigger]:visible').count(), 1)
  await page.close()
  console.log('Nested reader Escape/outside dismissal preserves the parent and consumes actions')
}
try {
  await verifyTerrainTurnStability()
  await verifyWrappedPreviewParity()
  await verifyNestedReaderDismissal()
  await verifyCooldownAlignment()
  await verifyTurnCues()
  await verifyLogHistory()
  for (const mode of ['pve', 'pvp', 'spectator']) {
    if (process.env.AV_FEEDBACK_MODE && process.env.AV_FEEDBACK_MODE !== mode) continue
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1024, height: 768 },
      { width: 821, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 640 },
      { width: 844, height: 390 },
    ]) {
      if (process.env.AV_FEEDBACK_WIDTH && Number(process.env.AV_FEEDBACK_WIDTH) !== viewport.width)
        continue
      for (const gesture of mode === 'spectator'
        ? ['tab-focus']
        : ['final-facing', 'move-pointer', 'move-direction', 'attack-pointer']) {
        if (process.env.AV_FEEDBACK_GESTURE && process.env.AV_FEEDBACK_GESTURE !== gesture) continue
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
          await verifyMobileWorkspace(page, mode)
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
