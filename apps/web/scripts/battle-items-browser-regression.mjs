// Mount production battle controls and artwork; all server responses are local fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-items-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-items-'))
const output = process.env.AV_ITEMS_EVIDENCE_DIR || '/tmp/battle-items-browser-evidence'
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
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      'server-only': resolve(fixture, 'server-only.js'),
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
const geometryOnly = process.env.AV_ITEMS_GEOMETRY_ONLY === '1'
async function assertCompactHeadingGeometry(page, report, width, requireFit = false) {
  const headings = await report.locator('[data-compact-skill-effect]').evaluateAll((lines) =>
    lines.map((line) => ({
      text: line.textContent.replace(/\s+/gu, ' ').trim(),
      renderedText: line.innerText.trim(),
      tops: Array.from(
        (line.querySelector('[data-compact-effect-phrase]') ?? line).children,
        (token) => token.getBoundingClientRect().top,
      ),
      clientWidth: line.clientWidth,
      scrollWidth: line.scrollWidth,
      overflowX: getComputedStyle(line).overflowX,
    })),
  )
  assert.ok(headings.length > 0)
  for (const heading of headings) {
    assert.equal(heading.renderedText, heading.text, JSON.stringify(heading))
    assert.ok(heading.tops.length >= 2, JSON.stringify(heading))
    assert.ok(Math.max(...heading.tops) - Math.min(...heading.tops) <= 3, JSON.stringify(heading))
    if (width >= 821 || requireFit)
      assert.ok(heading.scrollWidth <= heading.clientWidth + 1, JSON.stringify(heading))
    if (width < 821) assert.equal(heading.overflowX, 'auto', JSON.stringify(heading))
  }
  assert.equal(
    await page.evaluate(
      () =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1,
    ),
    true,
  )
  return headings
}
const errors = [],
  results = []
try {
  for (const mode of geometryOnly ? ['pve'] : ['pve', 'pvp', 'spectator'])
    for (const width of [1366, 390, 412])
      for (const scenario of geometryOnly
        ? ['items', 'items-barrier']
        : ['items', 'items-weapon', 'items-controlled', 'items-starter', 'items-two-handed']) {
        const page = await browser.newPage({
          viewport: { width, height: 915 },
          isMobile: width < 821,
          hasTouch: width < 821,
        })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.goto(`${server.resolvedUrls.local[0]}?mode=${mode}&canonical=${scenario}`)
        await page.locator('#battlefield button').first().waitFor()
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        )
        const serialized = await page.evaluate(() => JSON.stringify(window.fixtureBattle.snapshot))
        assert.ok(
          !/private-salve-stack|private-sword|ownedStackId|inventoryRevision|capturedAbilitySources|abilityRuntime/.test(
            serialized,
          ),
        )
        if (mode === 'spectator') {
          assert.ok(
            !/equipmentActions|remainingUses|Mender Salve|Iron Shortsword|Sunsplitter/.test(
              serialized,
            ),
          )
          assert.equal(await page.locator('[data-command-slot="items"]').count(), 0)
        } else {
          const slots = await page
            .locator('[data-command-slot]')
            .evaluateAll((nodes) => nodes.map((node) => node.dataset.commandSlot))
          assert.deepEqual(slots.slice(0, 5), ['inspect', 'items', 'move', 'attack', 'guard'])
          const itemCommand = page.locator('[data-command-slot="items"]')
          assert.equal(await itemCommand.isEnabled(), true)
          assert.ok((await itemCommand.getAttribute('aria-label')).startsWith('Item,'))
          if (width === 1366) await page.keyboard.press('i')
          else await itemCommand.tap()
          const choices = page.locator('[data-battle-item-choices]')
          await choices.waitFor()
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          )
          assert.equal(
            await choices.locator('[data-item-action]').count(),
            ['items-weapon', 'items-starter', 'items-two-handed'].includes(scenario) ? 1 : 2,
          )
          await choices
            .locator('img')
            .first()
            .evaluate((image) => image.decode())
          const bounded = await choices.locator('button').evaluateAll((buttons) =>
            buttons.every((button) => {
              const box = button.getBoundingClientRect()
              const pane = button.closest('[data-battle-preview-strip]').getBoundingClientRect()
              return (
                box.x >= pane.x &&
                box.right <= pane.right &&
                box.y >= pane.y &&
                box.bottom <= pane.bottom + 1
              )
            }),
          )
          assert.equal(
            bounded,
            true,
            'Consumable choices and i buttons fit the existing preview pane',
          )
          await page.screenshot({
            path: resolve(output, `items-${mode}-${scenario}-${width}-choices.png`),
          })
          const info = choices.getByRole('button', { name: /^Information about/ }).first()
          await info.click()
          await page.locator('[data-battle-info-panel]').waitFor()
          const report = page.locator('[data-battle-item-report]')
          await report.waitFor()
          const headingGeometry = await assertCompactHeadingGeometry(
            page,
            report,
            width,
            scenario === 'items-barrier',
          )
          const reportText = await report.innerText()
          assert.ok(reportText.includes('Parameters'))
          assert.ok(!/Tier|Maximum stack| → /.test(reportText))
          assert.equal(await report.locator('[data-ability-parameters]').count(), 1)
          assert.equal(await report.locator('ul[aria-label="Effect explanations"] > li').count(), 1)
          const tagLabels = await report
            .locator('[data-effect-tag-label], [data-combat-tag-reference]')
            .allTextContents()
          assert.equal(
            tagLabels.length,
            ['items-starter', 'items-two-handed', 'items-barrier'].includes(scenario) ? 2 : 3,
          )
          const expectedTag =
            scenario === 'items-barrier'
              ? 'Barrier'
              : ['items-starter', 'items-two-handed'].includes(scenario)
                ? 'HP Recovery'
                : 'Heal'
          assert.ok(
            tagLabels.every((label) => label.startsWith(expectedTag)),
            JSON.stringify({ mode, width, scenario, tagLabels, reportText }),
          )
          const infoImage = report.locator('img')
          await infoImage.evaluate((image) => image.decode())
          const infoImageBounds = await infoImage.boundingBox()
          assert.ok(infoImageBounds.width <= 48 && infoImageBounds.height <= 48)
          assert.ok(infoImageBounds.width > 0 && infoImageBounds.height > 0)
          const capturedDescription = await page.evaluate(
            () =>
              window.fixtureBattle.snapshot.equipmentActions.find((item) => item.role === 'use')
                .description,
          )
          if (capturedDescription) assert.ok(!reportText.includes(capturedDescription))
          await page.screenshot({
            path: resolve(output, `items-${mode}-${scenario}-${width}-info.png`),
          })
          assert.equal(
            (
              await page.evaluate(() =>
                window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
              )
            ).length,
            0,
          )
          await page.keyboard.press('Escape')
          assert.equal(
            await info.evaluate((button) => document.activeElement === button),
            true,
            `Info Escape ${mode}/${width}/${scenario}: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 150))}`,
          )
          if (geometryOnly) {
            results.push({ mode, width, scenario, passed: true, headingGeometry })
            await page.close()
            continue
          }
          if (width === 1366) {
            await choices.locator('[data-item-action]').first().focus()
            await page.keyboard.press('Enter')
          } else await choices.locator('[data-item-action]').first().tap()
          if (['items-starter', 'items-two-handed'].includes(scenario)) {
            const expected = await page.evaluate(() => {
              const items = window.fixtureBattle.snapshot.equipmentActions
              const consumable = items.find((item) => item.role === 'use')
              const weapon = items.find((item) => item.role === 'attack')
              const apCost = (item) =>
                item.behaviors[0].costs
                  .filter((cost) => cost.resource === 'ap')
                  .reduce((sum, cost) => sum + cost.amount, 0)
              return {
                useCost: apCost(consumable),
                attackCost: apCost(weapon),
                remainingUses: consumable.maximumUsesPerBattle - 1,
                weaponName: weapon.name,
                usePosition: consumable.position,
                weaponPosition: weapon.position,
                hands: weapon.item.equipment.hands,
                usePositions: items
                  .filter((item) => item.role === 'use')
                  .map((item) => item.position),
                offHandActions: items.filter((item) => item.position === 'off-hand').length,
              }
            })
            assert.equal(expected.usePosition, 'consumable-1')
            assert.equal(expected.weaponPosition, 'main-hand')
            assert.deepEqual(expected.usePositions, ['consumable-1'])
            assert.equal(expected.offHandActions, 0)
            assert.equal(expected.hands, scenario === 'items-two-handed' ? 2 : 1)
            assert.equal(
              expected.weaponName,
              scenario === 'items-two-handed' ? 'Sunsplitter' : 'Iron Shortsword',
            )
            assert.equal(
              (
                await page.evaluate(() =>
                  window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
                )
              ).length,
              0,
            )
            await page
              .locator('#battlefield')
              .getByRole('button', { name: /^Tile 4, 4;/ })
              .click()
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 2)
            const resources = () =>
              page.evaluate(() => ({
                hp: window.fixtureBattle.snapshot.tactical.battle.combatants[0].hp,
                ap: window.fixtureBattle.snapshot.tactical.battle.combatants[0].temporaryResources.find(
                  (row) => row.key === 'pv1f.action-economy',
                ).current,
                uses: window.fixtureBattle.snapshot.equipmentActions.find(
                  (row) => row.role === 'use',
                ).remainingUses,
              }))
            assert.deepEqual(await resources(), {
              hp: 52,
              ap: 100 - expected.useCost,
              uses: expected.remainingUses,
            })
            await page.evaluate(() => window.restoreCanonicalBattle())
            assert.deepEqual(await resources(), {
              hp: 52,
              ap: 100 - expected.useCost,
              uses: expected.remainingUses,
            })
            const attack = page.locator('[data-command-slot="attack"]')
            assert.ok(
              (await attack.getAttribute('aria-label')).startsWith(`${expected.weaponName},`),
            )
            await attack.click()
            await page
              .locator('#battlefield')
              .getByRole('button', { name: /^Tile 5, 4;/ })
              .click()
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 4)
            assert.deepEqual(await resources(), {
              hp: 52,
              ap: 100 - expected.useCost - expected.attackCost,
              uses: expected.remainingUses,
            })
            await page.screenshot({
              path: resolve(output, `items-${mode}-${scenario}-${width}.png`),
            })
            results.push({ mode, width, scenario, passed: true })
            await page.close()
            continue
          }
          if (scenario === 'items-controlled') {
            await page
              .waitForFunction(() => window.fixtureBattle.battleVersion === 2, null, {
                timeout: 5000,
              })
              .catch(async (error) => {
                console.error(
                  JSON.stringify({
                    mode,
                    width,
                    scenario,
                    errors,
                    details: await page.evaluate(() => ({
                      calls: window.calls,
                      targets: window.fixtureBattle.snapshot.manualActionTargets,
                      text: document.body.innerText.slice(-2500),
                    })),
                  }),
                )
                throw error
              })
            const resources = () =>
              page.evaluate(() => ({
                hp: window.fixtureBattle.snapshot.tactical.battle.combatants[0].hp,
                ap: window.fixtureBattle.snapshot.tactical.battle.combatants[0].temporaryResources.find(
                  (row) => row.key === 'pv1f.action-economy',
                ).current,
                uses: window.fixtureBattle.snapshot.equipmentActions[0].remainingUses,
              }))
            assert.deepEqual(await resources(), { hp: 40, ap: 100, uses: 2 })
            await page.screenshot({
              path: resolve(output, `items-${mode}-${scenario}-${width}-primed.png`),
            })
            await page.evaluate(() => window.restoreCanonicalBattle())
            await page.getByRole('button', { name: 'Cancel prime', exact: true }).click()
            await page
              .waitForFunction(() => window.fixtureBattle.battleVersion === 4, null, {
                timeout: 5000,
              })
              .catch(async (error) => {
                console.error(
                  JSON.stringify({
                    mode,
                    width,
                    scenario,
                    errors,
                    details: await page.evaluate(() => ({
                      calls: window.calls,
                      text: document.body.innerText.slice(-2500),
                    })),
                  }),
                )
                throw error
              })
            assert.deepEqual(await resources(), { hp: 40, ap: 100, uses: 2 })
            await itemCommand.click()
            await choices.locator('[data-item-action]').first().click()
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 5)
            await page
              .locator('#battlefield')
              .getByRole('button', { name: /^Tile 4, 4;/ })
              .click()
            await page.waitForFunction(() => window.fixtureBattle.battleVersion === 6)
            assert.deepEqual(await resources(), { hp: 60, ap: 90, uses: 1 })
            const intents = await page.evaluate(() =>
              window.calls
                .filter((call) => /\/(commit|intents)$/.test(call.path))
                .map((call) => call.body.intent.kind),
            )
            assert.deepEqual(intents, [
              'ability-prime',
              'ability-cancel-prime',
              'ability-prime',
              'action',
            ])
            await page.evaluate(() => window.restoreCanonicalBattle())
            assert.deepEqual(await resources(), { hp: 60, ap: 90, uses: 1 })
            results.push({ mode, width, scenario })
            await page.close()
            continue
          }
          assert.equal(
            (
              await page.evaluate(() =>
                window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
              )
            ).length,
            0,
          )
          await page.evaluate(() => {
            window.holdItemCommit = true
          })
          await page
            .locator('#battlefield')
            .getByRole('button', { name: /^Tile 4, 4;/ })
            .click()
          await page.waitForFunction(() => typeof window.releaseItemCommit === 'function', null, {
            timeout: 3000,
          })
          // Repeated input during the in-flight commit cannot submit or spend twice.
          const selfTile = await page
            .locator('#battlefield')
            .getByRole('button', { name: /^Tile 4, 4;/ })
            .boundingBox()
          await page.mouse.click(selfTile.x + selfTile.width / 2, selfTile.y + selfTile.height / 2)
          await page.keyboard.press('i')
          const inFlight = await page.evaluate(() => ({
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length,
            uses: window.fixtureBattle.snapshot.equipmentActions.find((row) => row.role === 'use')
              .remainingUses,
            hp: window.fixtureBattle.snapshot.tactical.battle.combatants[0].hp,
          }))
          assert.deepEqual(inFlight, { calls: 1, uses: 2, hp: 40 })
          await page.evaluate(() => window.releaseItemCommit())
          await page
            .waitForFunction(() => window.fixtureBattle.battleVersion > 1)
            .catch(async (error) => {
              console.error(
                JSON.stringify({
                  mode,
                  width,
                  scenario,
                  errors,
                  detail: await page.evaluate(() => ({
                    calls: window.calls,
                    text: document.body.innerText.slice(-2000),
                  })),
                }),
              )
              throw error
            })
          const first = await page.evaluate(() => ({
            actor: window.fixtureBattle.snapshot.tactical.battle.combatants[0],
            items: window.fixtureBattle.snapshot.equipmentActions,
            calls: window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)),
          }))
          assert.equal(first.actor.hp, 60)
          assert.equal(
            first.actor.temporaryResources.find((row) => row.key === 'pv1f.action-economy').current,
            90,
          )
          assert.equal(first.calls.length, 1)
          assert.ok(first.calls[0].body.intent.actionId.endsWith('.consumable-1.use'))
          assert.equal(first.items.find((row) => row.role === 'use').remainingUses, 1)
          await page.evaluate(() => window.restoreCanonicalBattle())
          await itemCommand.click()
          await choices.waitFor()
          assert.ok((await choices.innerText()).includes('1 uses left'))
          await choices.locator('[data-item-action]').first().click()
          await page
            .locator('#battlefield')
            .getByRole('button', { name: /^Tile 4, 4;/ })
            .click()
          await page.waitForFunction(
            () =>
              window.fixtureBattle.snapshot.equipmentActions.find((row) => row.role === 'use')
                .remainingUses === 0,
          )
          if (scenario === 'items') {
            await itemCommand.click()
            await choices.waitFor()
            assert.equal(await choices.locator('[data-item-action]').first().isDisabled(), true)
            assert.equal(await choices.locator('[data-item-action]').nth(1).isEnabled(), true)
            await choices.locator('[data-item-action]').nth(1).click()
            await page
              .locator('#battlefield')
              .getByRole('button', { name: /^Tile 4, 4;/ })
              .click()
            await page.waitForFunction(
              () =>
                window.fixtureBattle.snapshot.equipmentActions.find(
                  (row) => row.role === 'use' && row.position === 'consumable-2',
                ).remainingUses === 1,
            )
            assert.deepEqual(
              await page.evaluate(() =>
                window.fixtureBattle.snapshot.equipmentActions
                  .filter((row) => row.role === 'use')
                  .map((row) => [row.position, row.remainingUses]),
              ),
              [
                ['consumable-1', 0],
                ['consumable-2', 1],
              ],
            )
          } else {
            assert.equal(await itemCommand.isDisabled(), true)
            const support = page.locator('[data-command-slot="guard"]')
            assert.ok((await support.getAttribute('aria-label')).startsWith('Iron Shortsword,'))
            await support.click()
            await page
              .locator('#battlefield')
              .getByRole('button', { name: /^Tile 4, 4;/ })
              .click()
            await page
              .waitForFunction(
                () =>
                  window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length === 3,
              )
              .catch(async (error) => {
                console.error(
                  JSON.stringify({
                    mode,
                    width,
                    scenario,
                    errors,
                    detail: await page.evaluate(() => ({
                      calls: window.calls,
                      text: document.body.innerText.slice(-3000),
                    })),
                  }),
                )
                throw error
              })
            assert.equal(
              await page.evaluate(
                () => window.fixtureBattle.snapshot.tactical.battle.combatants[0].hp,
              ),
              100,
            )
            const attack = page.locator('[data-command-slot="attack"]')
            assert.ok((await attack.getAttribute('aria-label')).startsWith('Iron Shortsword,'))
            assert.ok(
              (await attack.locator('img').getAttribute('src')).includes(
                'iron-shortsword-v01.webp',
              ),
            )
            await attack.click()
            await page
              .locator('#battlefield')
              .getByRole('button', { name: /^Tile 5, 4;/ })
              .click()
            await page.waitForFunction(
              () =>
                window.calls.filter((call) => /\/(commit|intents)$/.test(call.path)).length === 4,
            )
          }
        }
        await page.screenshot({ path: resolve(output, `items-${mode}-${scenario}-${width}.png`) })
        results.push({ mode, width, scenario, passed: true })
        await page.close()
      }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        boundary:
          'Production battle UI, owner projections and canonical engine; local fixture transport. Actual admission and service authority verified separately.',
        geometryOnly,
        results,
        errors,
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ passed: results.length, output }))
} finally {
  await browser.close()
  await server.close()
}
