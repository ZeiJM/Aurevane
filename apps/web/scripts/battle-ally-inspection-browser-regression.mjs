// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-ally-inspection-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-ally-inspection-'))
const output = process.env.AV_ALLY_INSPECTION_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-ally-inspection-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
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
try {
  for (const mode of ['pve', 'pvp']) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({
        viewport,
        isMobile: viewport.width < 821,
        hasTouch: viewport.width < 821,
      })
      page.setDefaultTimeout(5000)
      page.on('pageerror', (error) => {
        errors.push(error.message)
        console.error(`${mode} ${viewport.width}: ${error.message}`)
      })
      await page.goto(server.resolvedUrls.local[0] + `?mode=${mode}`)
      const local = page.locator('[data-battle-combatant-card="local"]')
      const enemy = page.locator('[data-battle-combatant-card="selected"]')
      const tile = (name) =>
        page
          .locator('#battlefield')
          .getByRole('button', { name: new RegExp(`occupied by ${name}`) })
      const command = (name) => page.locator(`[data-battle-command="${name}"]`)
      const expectName = async (card, name) => {
        await page.waitForFunction(
          ({ role, name }) =>
            document
              .querySelector(`[data-battle-combatant-card="${role}"]`)
              ?.getAttribute('aria-label') === `${name} battle summary`,
          { role: await card.getAttribute('data-battle-combatant-card'), name },
        )
      }
      const commits = () =>
        page.evaluate(() =>
          window.calls.filter((call) => /\/(commit|intents|final-turn)$/.test(call.path)),
        )
      await local.waitFor({ state: 'attached' })
      await tile('Ally 1').click()
      await expectName(local, 'Ally 1')
      assert.equal(await local.getByRole('meter', { name: 'HP 90 / 100', exact: true }).count(), 1)
      assert.equal(await local.getByRole('meter', { name: 'MP 40 / 50', exact: true }).count(), 1)
      assert.deepEqual(await commits(), [], 'Inspection spends no AP and submits no command')
      assert.equal(
        await page
          .getByRole('progressbar', { name: 'Action Economy remaining' })
          .getAttribute('aria-valuenow'),
        '100',
      )
      await expectName(enemy, 'Recruit 1')
      await tile('Recruit 2').click()
      await expectName(enemy, 'Recruit 2')
      await expectName(local, 'Ally 1')
      for (const action of ['guard', 'finish']) {
        await command(action).click()
        await expectName(local, 'Zei')
        await command('inspect').click()
        await tile('Ally 1').click()
        await expectName(local, 'Ally 1')
      }
      await command('move').click()
      await expectName(local, 'Zei')
      await command('inspect').click()
      await tile('Ally 1').click()
      await expectName(local, 'Ally 1')
      assert.equal(
        await page.getByRole('dialog').count(),
        0,
        'Map inspection updates rail without intercepting click',
      )
      await local.getByRole('button', { name: 'Inspect Ally 1', exact: true }).click()
      await page.getByRole('dialog', { name: 'Ally 1 battle details', exact: true }).waitFor()
      assert.match(await page.getByRole('dialog').innerText(), /90\/100/)
      await page.keyboard.press('Escape')
      await expectName(local, 'Zei')
      await command('inspect').click()
      await tile('Ally 1').click()
      await expectName(local, 'Ally 1')
      await command('attack').click()
      await expectName(local, 'Zei')
      await page.locator('[data-battle-range-forecast="enemy-one"]').waitFor()
      await page.locator('[data-battle-range-forecast="enemy-two"]').waitFor()
      assert.match(
        await page.locator('[data-battle-range-forecast="enemy-one"]').innerText(),
        /Hit 69%.*17 dmg/,
      )
      assert.match(
        await page.locator('[data-battle-range-forecast="enemy-two"]').innerText(),
        /Hit 42%.*9 dmg/,
      )
      assert.equal(await page.locator('[data-battle-range-forecast="ally"]').count(), 0)
      const geometry = await page.locator('[data-battle-range-forecast]').evaluateAll((cards) =>
        cards.map((card) => {
          const bounds = card.getBoundingClientRect()
          const portrait = card.firstElementChild.getBoundingClientRect()
          const name = card.querySelector('strong').getBoundingClientRect()
          const outcome = card.lastElementChild.getBoundingClientRect()
          return {
            width: bounds.width,
            portraitWidth: portrait.width,
            portraitHeight: portrait.height,
            portraitTop: portrait.top,
            portraitBottom: portrait.bottom,
            nameTop: name.top,
            outcomeBottom: outcome.bottom,
          }
        }),
      )
      assert.equal(geometry.length, 2)
      for (const target of geometry) {
        assert.ok(target.width >= 32, 'Target card retains room for its larger portrait')
        assert.ok(
          target.portraitWidth >= 31.5 && target.portraitHeight >= 31.5,
          'Forecast portraits retain the approved 32px size',
        )
        assert.ok(
          target.portraitTop <= target.nameTop + 1 &&
            target.portraitBottom >= target.outcomeBottom - 1,
          'Portrait spans both information lines',
        )
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        false,
        'Forecasts do not create horizontal page overflow',
      )
      await page.screenshot({
        path: resolve(output, `${mode}-${viewport.width}-forecasts.png`),
        fullPage: true,
      })

      await tile('Ally 1').click()
      await expectName(local, 'Zei')
      assert.deepEqual(
        await commits(),
        [],
        'Enemy attack cannot execute on an allied inspection click',
      )
      await tile('Recruit 2').click()
      await page.waitForFunction(() =>
        window.calls.some((call) => /\/(commit|intents)$/.test(call.path)),
      )
      const attack = (await commits())[0]
      assert.equal(attack.body.intent.target.combatantId, 'enemy-two')
      assert.equal(
        await page.evaluate(
          () => window.fixtureBattle.snapshot.tactical.battle.currentTurn.combatantId,
        ),
        'character:player',
      )
      await expectName(enemy, 'Recruit 2')
      await command('move').click()
      await expectName(local, 'Zei')
      await page
        .locator('#battlefield')
        .getByRole('button', { name: /^Tile 4, 3;/ })
        .click()
      await page.waitForFunction(() =>
        window.calls.some((call) => call.body?.intent?.kind === 'move'),
      )
      const move = (await commits()).find((call) => call.body?.intent?.kind === 'move')
      assert.deepEqual(
        move.body.intent.path[0],
        { x: 3, y: 3 },
        'Movement always starts from local character',
      )
      await expectName(local, 'Zei')
      await command('inspect').click()
      await tile('Ally 1').click()
      await expectName(local, 'Ally 1')
      await page.evaluate(() => window.advanceBattle())
      await expectName(local, 'Zei')
      await command('inspect').click()
      await tile('Ally 1').click()
      await expectName(local, 'Ally 1')
      await page.evaluate(() => window.advanceBattle('ally'))
      await expectName(local, 'Zei')
      await expectName(enemy, 'Recruit 2')
      await tile('Ally 1').click()
      await expectName(local, 'Ally 1')
      assert.equal(
        await command('attack').isDisabled(),
        true,
        'Viewing active ally does not acquire command authority',
      )
      await page.screenshot({
        path: resolve(output, `${mode}-${viewport.width}.png`),
        fullPage: true,
      })
      await page.close()
      console.log(
        `${mode} ${viewport.width}: ally inspection, restoration, enemy targeting and local authority passed`,
      )
    }
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
