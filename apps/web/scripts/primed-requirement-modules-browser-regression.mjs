// Real native prime/cancel + viewer projection + production Master requirement editor.
// Run: pnpm --filter @aurevane/web exec node scripts/primed-requirement-modules-browser-regression.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { createServer, build } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const { expect } = require('@playwright/test')
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'primed-modules-browser-'))
const output =
  process.env.AV_PRIMED_MODULES_EVIDENCE_DIR || resolve(tmpdir(), 'primed-modules-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/primed-requirement-modules-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'production-styles.js'),
  "import '@aurevane/ui/styles.css';import '@/app/globals.css'",
)
// Only the environment guard of this pure viewer projection is disabled locally.
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
const config = {
  configFile: false,
  root: fixture,
  publicDir: false,
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
      '@modularity-cohort': resolve(
        root,
        'docs/superpowers/specs/2026-10-19-resonance-modularity-cohort.json',
      ),
      'server-only': resolve(fixture, 'server-only.js'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: { include: ['react', 'react-dom/client'] },
}
if (process.env.AV_PRIMED_MODULES_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log('Primed/modules production fixture compilation passed.')
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
} else {
  const server = await createServer(config)
  await server.listen()
  let browser
  const evidence = []
  try {
    browser = await chromium.launch({
      ...(process.env.AV_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
        : {}),
      args: ['--no-sandbox'],
      headless: true,
    })
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.primedModules))
      await expect(page.locator('[data-native-primed]')).toHaveAttribute(
        'data-native-primed',
        'false',
      )
      await page.getByRole('button', { name: 'Prime Controlled skill', exact: true }).click()
      await expect(page.locator('[data-held-eligible]')).toHaveAttribute(
        'data-held-eligible',
        'true',
      )
      const styles = []
      for (const mode of ['PvE', 'PvP']) {
        const rail = page.getByRole('region', { name: `${mode} shared rail`, exact: true })
        const primed = rail.locator('[data-effect-timing="primed"]')
        await expect(primed).toHaveCount(1)
        await expect(primed).toContainText('PRI')
        await expect(
          rail.locator('[data-effect-timing="pending"], [data-effect-duration]'),
        ).toHaveCount(0)
        styles.push(
          await primed.getByRole('button').evaluate((element) => ({
            borderColor: getComputedStyle(element).borderColor,
            borderStyle: getComputedStyle(element).borderStyle,
            color: getComputedStyle(element).color,
          })),
        )
        await primed.getByRole('button').click()
        const panel = page.getByRole('dialog', { name: 'Primed', exact: true })
        await expect(panel).toBeVisible()
        await expect(panel).toContainText('While a Controlled skill remains primed')
        await expect(panel).toContainText('released, cancelled')
        await expect(panel).not.toContainText(
          /Pending|round [0-9]|[0-9] turn|chronist.rewind|browser-rewind/,
        )
        const box = await panel.boundingBox()
        assert.ok(
          box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width + 1 &&
            box.y + box.height <= viewport.height + 1,
          `Primed popup fits ${viewport.width}`,
        )
        await page.screenshot({
          path: resolve(output, `${mode.toLowerCase()}-primed-popover-${viewport.width}.png`),
        })
        await page.keyboard.press('Escape')
        await expect(panel).toHaveCount(0)
        evidence.push({
          viewport,
          mode,
          nativePrime: 'passed',
          amberPRI: 'passed',
          popupFits: 'passed',
          fakePendingClock: false,
        })
      }
      assert.deepEqual(styles[0], styles[1])
      assert.equal(styles[0].borderColor, 'rgb(217, 184, 84)')
      assert.equal(styles[0].borderStyle, 'dashed')
      for (const mode of ['Opponent', 'Spectator'])
        await expect(
          page
            .getByRole('region', { name: `${mode} shared rail`, exact: true })
            .locator('[data-effect-timing="primed"]'),
        ).toHaveCount(0)
      const projection = await page.evaluate(() => window.primedModules.snapshot().projections)
      assert.deepEqual(projection.Opponent, [])
      assert.deepEqual(projection.Spectator, [])
      assert.doesNotMatch(
        JSON.stringify(projection),
        /abilityRuntime|abilityId|sourceInstanceId|chronist\.rewind|browser-rewind/,
      )
      await page.getByRole('button', { name: 'Cancel prime', exact: true }).click()
      await expect(page.locator('[data-effect-timing="primed"]')).toHaveCount(0)
      await expect(page.locator('[data-held-eligible]')).toHaveAttribute(
        'data-held-eligible',
        'false',
      )
      await page.getByRole('button', { name: 'Prime Controlled skill', exact: true }).click()
      const held = page.getByRole('region', { name: 'Held Formula Master editor', exact: true })
      await expect(
        held.getByRole('spinbutton', { name: 'Resource threshold', exact: true }),
      ).toHaveValue('12')
      await held.getByRole('spinbutton', { name: 'Resource threshold', exact: true }).fill('13')
      await held.getByRole('button', { name: 'Save Held Formula JSON', exact: true }).click()
      await expect(page.locator('[data-held-eligible]')).toHaveAttribute(
        'data-held-eligible',
        'false',
      )
      let saved = JSON.parse(await page.locator('[data-saved-held]').textContent())
      assert.ok(
        saved.children.some(
          (node) => node.kind === 'prime-presence' && node.abilityId === undefined,
        ),
      )
      assert.ok(
        saved.children.some(
          (node) => node.kind === 'resource-state' && node.resource === 'mp' && node.amount === 13,
        ),
      )
      await page.reload({ waitUntil: 'networkidle' })
      await expect(
        page.getByRole('spinbutton', { name: 'Resource threshold', exact: true }),
      ).toHaveValue('13')
      await page.getByRole('button', { name: 'Prime Controlled skill', exact: true }).click()
      await expect(page.locator('[data-held-eligible]')).toHaveAttribute(
        'data-held-eligible',
        'false',
      )
      saved = await page.evaluate(() => window.primedModules.snapshot().heldSaved)
      assert.ok(saved.children.some((node) => node.kind === 'resource-state' && node.amount === 13))
      const blood = page.getByRole('region', { name: 'Bloodfed Cinder Master editor', exact: true })
      await expect(
        blood.getByRole('combobox', { name: 'Trigger module', exact: true }),
      ).toHaveValue('trigger.attack-hit')
      await expect(blood.locator('input[type="text"], input:not([type]), textarea')).toHaveCount(0)
      await expect(
        blood.getByRole('combobox', { name: 'Required status tag', exact: true }),
      ).toHaveCount(2)
      await expect(
        blood.getByRole('combobox', { name: 'Required source Discipline', exact: true }),
      ).toHaveValue('cinderweaver')
      await blood.getByRole('checkbox', { name: 'Require action tag Melee', exact: true }).check()
      await blood.getByRole('button', { name: 'Save Bloodfed Cinder JSON', exact: true }).click()
      let bloodSaved = JSON.parse(await page.locator('[data-saved-bloodfed]').textContent())
      assert.ok(
        bloodSaved.children.some(
          (node) => node.kind === 'action' && node.requiredTags.includes('melee'),
        ),
      )
      await blood
        .getByRole('combobox', { name: 'Trigger module', exact: true })
        .selectOption('trigger.damage-received')
      await blood.getByRole('button', { name: 'Save Bloodfed Cinder JSON', exact: true }).click()
      bloodSaved = JSON.parse(await page.locator('[data-saved-bloodfed]').textContent())
      assert.ok(
        bloodSaved.children.some(
          (node) =>
            node.kind === 'subject-relation' &&
            node.subject === 'affected' &&
            node.relation === 'same-unit',
        ),
      )
      assert.ok(
        bloodSaved.children.some(
          (node) => node.kind === 'status-presence' && node.statusId === 'reckless',
        ),
      )
      assert.ok(
        bloodSaved.children.some(
          (node) => node.kind === 'status-presence' && node.statusId === 'burn',
        ),
      )
      await page.screenshot({
        path: resolve(output, `master-modules-${viewport.width}.png`),
        fullPage: true,
      })
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `No horizontal overflow at ${viewport.width}`,
      )
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        privacy: 'passed',
        nativeCancel: 'passed',
        heldMP12to13JSONReload: 'passed',
        coreEligibility: 'passed',
        registeredTriggerAndStatusControls: 'passed',
        freeTextMechanics: false,
        errors,
      })
      await page.close()
    }
    await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
    console.log(
      `Primed/modules browser regression passed (${evidence.length} cases). Evidence: ${output}`,
    )
  } finally {
    await browser?.close()
    await server.close()
    await fs.rm(fixture, { recursive: true, force: true })
  }
}
