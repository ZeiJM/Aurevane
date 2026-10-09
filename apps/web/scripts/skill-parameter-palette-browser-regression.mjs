// Check production Nexus, Master and battle parameter renderers with canonical definitions.
// Run: pnpm --filter @aurevane/web exec node scripts/skill-parameter-palette-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'skill-parameter-palette-'))
const output =
  process.env.AV_SKILL_PARAMETER_PALETTE_EVIDENCE_DIR ||
  resolve(tmpdir(), 'skill-parameter-palette-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/skill-parameter-palette-harness.jsx'),
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
const evidence = []
const fields = [
  'Skill Type',
  'Cost',
  'Cooldown',
  'Requirements',
  'Effects',
  'Range',
  'Target',
  'Target Method',
  'Target Elevation',
  'Line of Sight',
]
async function colors(locator) {
  return locator.evaluate((element) =>
    Object.fromEntries(
      ['label', 'magnitude', 'duration', 'timing'].flatMap((part) => {
        const value = element.querySelector(`[data-compact-effect-${part}]`)
        return value ? [[part, getComputedStyle(value).color]] : []
      }),
    ),
  )
}
const palette = {
  label: 'rgb(240, 232, 220)',
  magnitude: 'rgb(228, 189, 103)',
  duration: 'rgb(112, 215, 206)',
  timing: 'rgb(112, 215, 206)',
}
const paperPalette = {
  label: 'rgb(23, 45, 60)',
  magnitude: 'rgb(121, 85, 28)',
  timing: 'rgb(23, 103, 94)',
}
async function assertPaperEffects(panel) {
  for (const effect of await panel.locator('[data-compact-skill-effect]').all()) {
    assert.equal(
      await effect.evaluate((element) => getComputedStyle(element).backgroundColor),
      'rgba(0, 0, 0, 0)',
    )
  }
}
try {
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
    const authoring = page.getByRole('region', { name: 'Master Blindside authoring' })
    await authoring.getByLabel('New effect type').selectOption('blindside')
    await authoring.getByRole('button', { name: 'Add effect', exact: true }).click()
    assert.deepEqual(await page.evaluate(() => window.blindsideAuthoringEffects[1]), {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'blindside',
      stacks: 1,
      durationTurns: 1,
    })
    const addedEffect = authoring.locator('[data-effect-type="apply-status"]').nth(1)
    assert.equal(
      await addedEffect.getByLabel('Side damage (%)', { exact: true }).inputValue(),
      '160',
    )
    assert.equal(
      await addedEffect.getByLabel('Rear damage (%)', { exact: true }).inputValue(),
      '220',
    )
    await addedEffect.getByLabel('Side damage (%)', { exact: true }).fill('175.5')
    await addedEffect.getByLabel('Rear damage (%)', { exact: true }).fill('250')
    assert.deepEqual(
      await page.evaluate(() => window.blindsideAuthoringEffects[1].blindsideModifiersBasisPoints),
      { side: 17550, rear: 25000 },
    )
    const firstEffect = authoring.locator('[data-effect-type="apply-status"]').first()
    await firstEffect.getByLabel('Status ID', { exact: true }).fill('blindside')
    const converted = await page.evaluate(() => window.blindsideAuthoringEffects[0])
    assert.equal(converted.durationTurns, 1)
    assert.equal(converted.potencyBasisPoints, undefined)
    assert.equal(
      await firstEffect.getByLabel('Effect duration (turns)', { exact: true }).inputValue(),
      '1',
    )
    assert.ok(await firstEffect.getByLabel('Effect duration (turns)', { exact: true }).isDisabled())
    await authoring.screenshot({
      path: resolve(output, `blindside-authoring-${viewport.width}.png`),
    })
    for (const family of ['physical', 'mystic'])
      for (const surface of ['Nexus', 'Master', 'Battle']) {
        const report = page.getByRole('region', {
          name: `${surface} ${family} ${surface === 'Master' ? 'details' : 'parameters'}`,
        })
        const labels = await report.locator('dt').allTextContents()
        assert.deepEqual(labels.slice(0, 10), fields)
        const token = report.locator(`[data-skill-attack-family="${family}"]`)
        assert.equal(await token.textContent(), family === 'physical' ? '[Physical]' : '[Mystic]')
        assert.equal(
          await token.evaluate((element) => getComputedStyle(element).color),
          family === 'physical' ? 'rgb(211, 58, 50)' : 'rgb(36, 146, 72)',
        )
      }
    assert.equal(
      await page
        .getByRole('region', { name: 'Basic Attack parameters' })
        .locator('[data-skill-attack-family="physical"]')
        .count(),
      1,
    )
    for (const surface of ['Master', 'Battle']) {
      const report = page.getByRole('region', {
        name: `${surface} ground ${surface === 'Master' ? 'details' : 'parameters'}`,
      })
      const effects = report.locator(
        surface === 'Master' ? 'ol' : '[aria-label="Effect explanations"]',
      )
      assert.deepEqual(await effects.locator('li > strong').allTextContents(), [
        'Frozen Ground',
        'Slow',
        'Chilled',
      ])
      assert.ok(!(await effects.textContent()).includes('Each cast has its own allowance'))
      const area = report.getByLabel('Ground area rules', { exact: true })
      assert.equal(await area.count(), 1)
      assert.ok((await area.textContent()).includes('starting next round'))
      assert.ok(
        (await area.textContent()).includes('Entry applies effects once per character’s turn'),
      )
      assert.equal(
        await area.evaluate(
          (element) => element.closest('dd')?.previousElementSibling?.textContent,
        ),
        'Target',
      )
      const box = await report.boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1)
      if (surface === 'Battle') {
        await report.screenshot({ path: resolve(output, `ground-reader-${viewport.width}.png`) })
      }
    }
    for (const surface of ['Master', 'Battle']) {
      const report = page.getByRole('region', {
        name: `${surface} healing-down ${surface === 'Master' ? 'details' : 'parameters'}`,
      })
      assert.ok((await report.textContent()).includes('less HP and MP recovery'))
      if (surface === 'Battle') {
        await report.screenshot({
          path: resolve(output, `healing-down-reader-${viewport.width}.png`),
        })
      }
    }
    for (const surface of ['Nexus', 'Master', 'Battle']) {
      const report = page.getByRole('region', {
        name: `${surface} blindside ${surface === 'Master' ? 'details' : 'parameters'}`,
      })
      const summary = await report.textContent()
      assert.ok(summary.includes('Blindside'))
      assert.ok(summary.includes('[Instant]'))
      assert.ok(summary.includes('[1 Turn]'))
      assert.ok(summary.includes('[20]'))
      if (surface !== 'Nexus') {
        assert.ok(summary.includes('160% from the side and 220% from the rear'))
        assert.ok(!summary.includes('Facing: front 120%'))
      }
      if (surface === 'Battle')
        await report.screenshot({ path: resolve(output, `blindside-reader-${viewport.width}.png`) })
    }
    const reference = await colors(
      page.getByRole('region', { name: 'Discipline effect reference' }),
    )
    assert.equal(reference.label, palette.label)
    assert.equal(reference.magnitude, palette.magnitude)
    assert.equal(reference.duration, palette.duration)
    const inline = page.getByRole('region', { name: 'Inline Resonance parameters' })
    assert.deepEqual(await colors(inline), {
      label: palette.label,
      magnitude: palette.magnitude,
      timing: palette.timing,
    })
    assert.equal(await inline.locator('dl > div').first().locator('dd').textContent(), 'Resonance')
    await page.getByRole('button', { name: 'Read pinned Resonance', exact: true }).click()
    const resonanceName = await page.evaluate(() => window.paletteDefinitions.resonance.name)
    const panel = page.getByRole('dialog', { name: resonanceName, exact: true })
    await panel.waitFor()
    assert.deepEqual(await colors(panel), paperPalette)
    assert.ok((await panel.textContent()).includes('Wildwarden Skills tagged Mark'))
    assert.ok((await panel.textContent()).includes('Edgedancer Skills tagged Attack:'))
    await assertPaperEffects(panel)
    const box = await panel.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1)
    await page.screenshot({ path: resolve(output, `parameters-${viewport.width}.png`) })
    await page.keyboard.press('Escape')
    await panel.waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Read pinned Mystic Skill', exact: true }).click()
    const mysticPanel = page.getByRole('dialog', { name: 'Aether Cut', exact: true })
    await mysticPanel.waitFor()
    await assertPaperEffects(mysticPanel)
    assert.equal(
      await mysticPanel
        .locator('[data-skill-attack-family="mystic"]')
        .evaluate((element) => getComputedStyle(element).color),
      'rgb(36, 146, 72)',
    )
    await page.keyboard.press('Escape')
    for (const attunement of ['resonance', 'essence']) {
      await page.goto(`${server.resolvedUrls.local[0]}?surface=nexus&attunement=${attunement}`, {
        waitUntil: 'networkidle',
      })
      const name = await page.evaluate(
        (family) => window.paletteDefinitions[family].name,
        attunement,
      )
      const trigger = page.getByRole('button', {
        name: `Preview ${attunement === 'resonance' ? 'Resonance' : 'Essence'}: ${name}`,
        exact: true,
      })
      const cardName = await trigger
        .locator('xpath=ancestor::article[1]')
        .locator('strong')
        .textContent()
      assert.equal(cardName, name)
      const prefixedName = page.getByText(
        `${attunement === 'resonance' ? 'Resonance' : 'Essence'}: ${name}`,
        { exact: true },
      )
      assert.equal(await prefixedName.count(), 0)
      await trigger.click()
      const popup = page.getByRole('dialog', { name, exact: true })
      await popup.waitFor()
      assert.equal(await popup.locator('header > strong').textContent(), name)
      assert.deepEqual((await popup.locator('dt').allTextContents()).slice(0, 10), fields)
      if (attunement === 'resonance') assert.deepEqual(await colors(popup), paperPalette)
      await assertPaperEffects(popup)
      await page.screenshot({ path: resolve(output, `nexus-${attunement}-${viewport.width}.png`) })
      await page.keyboard.press('Escape')
      await popup.waitFor({ state: 'detached' })
      assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
    }
    assert.deepEqual(errors, [])
    evidence.push({ viewport, status: 'passed' })
    await page.close()
  }
  await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(`Skill parameter family/palette browser regression passed. Evidence: ${output}`)
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
