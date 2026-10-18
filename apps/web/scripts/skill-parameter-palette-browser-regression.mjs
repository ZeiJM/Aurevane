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
const basicServiceAcceptance = process.env.AV_BASIC_SERVICE_ACCEPTANCE === '1'
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
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
await fs.writeFile(
  resolve(fixture, 'auth-boundary.js'),
  'export function getAuthenticatedActor(){throw new Error("Fixture actor must be supplied")}',
)
await fs.writeFile(
  resolve(fixture, 'authoring-boundary.js'),
  'export function createServerCombatContentAuthoringService(){throw new Error("Fixture repository must be supplied")}',
)
let basicFixture
let createBasicEditorServiceFixture
async function handleBasicRequest(request, response, next) {
  const url = new URL(request.url, 'http://127.0.0.1')
  if (
    ![
      '/__basic-acceptance/options',
      '/__basic-acceptance/reset',
      '/__basic-acceptance/inspect',
      '/api/master/combat-content',
    ].includes(url.pathname)
  )
    return next()
  try {
    let result
    if (url.pathname === '/__basic-acceptance/reset') {
      basicFixture = await createBasicEditorServiceFixture()
      result = Response.json({ reset: true })
    } else if (url.pathname === '/__basic-acceptance/options')
      result = Response.json(basicFixture.options)
    else if (url.pathname === '/__basic-acceptance/inspect')
      result = Response.json(await basicFixture.inspect())
    else {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      result = await basicFixture.request(
        new Request(url, {
          method: request.method,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      )
    }
    response.writeHead(result.status, Object.fromEntries(result.headers))
    response.end(await result.text())
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: String(error) }))
  }
}
const server = await createServer({
  plugins: basicServiceAcceptance
    ? [
        {
          name: 'basic-service-acceptance',
          configureServer(server) {
            server.middlewares.use(handleBasicRequest)
          },
        },
      ]
    : [],
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      ...(basicServiceAcceptance
        ? {
            '@/server/auth/actor': resolve(fixture, 'auth-boundary.js'),
            '@/server/master/combat-content-authoring-server': resolve(
              fixture,
              'authoring-boundary.js',
            ),
            'server-only': resolve(fixture, 'server-only.js'),
            '@aurevane/db': resolve(root, 'packages/db/src'),
          }
        : {}),
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
if (basicServiceAcceptance) {
  ;({ createBasicEditorServiceFixture } = await server.ssrLoadModule(
    resolve(web, 'e2e/fixtures/basic-editor-service.ts'),
  ))
  basicFixture = await createBasicEditorServiceFixture()

  await server.listen()
  if (process.env.AV_BASIC_SERVICE_PROBE_ONLY === '1') {
    const origin = server.resolvedUrls.local[0]
    const options = await fetch(`${origin}__basic-acceptance/options`)
    assert.match(options.headers.get('content-type') ?? '', /application\/json/)
    assert.equal((await options.json()).length, 5)
    const restored = await fetch(new URL('/api/master/combat-content', origin), {
      method: 'POST',
      body: JSON.stringify({
        operation: 'restore-basic-draft',
        skillId: 'basic.guard',
        targetVersion: 1,
        expectedBaseVersion: 2,
        expectedDraftVersion: null,
      }),
    })
    assert.equal(restored.status, 200)
    const inspection = await (await fetch(`${origin}__basic-acceptance/inspect`)).json()
    assert.equal(inspection.oldCapturesUnchanged, true)
    console.log(
      'Actual Basic HTTP handler/service probe passed: five v2 records and v1 Guard restore.',
    )
    await server.close()
    await fs.rm(fixture, { recursive: true, force: true })
    process.exit(0)
  }
}
if (!basicServiceAcceptance) await server.listen()
const browser = await chromium.launch({
  ...(process.env.AV_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.AV_CHROMIUM_EXECUTABLE }
    : {}),
  args: ['--no-sandbox'],
  headless: true,
})
const evidence = []
const browserErrors = []
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
  label: 'rgb(228, 189, 103)',
  magnitude: 'rgb(228, 189, 103)',
  duration: 'rgb(112, 215, 206)',
  timing: 'rgb(112, 215, 206)',
}
const paperPalette = {
  label: 'rgb(121, 85, 28)',
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
async function assertModularReport(panel) {
  const groups = panel.locator('[data-ability-behavior]')
  assert.equal(await groups.count(), 2)
  for (const group of await groups.all())
    assert.deepEqual(await group.locator('dt').allTextContents(), fields)
  const text = await panel.innerText()
  assert.match(text, /11 AP \/ 2 MP \/ 1 HP/)
  assert.match(text, /You: MP ≥ 3/)
  assert.match(text, /Move \[2\]/)
  assert.match(text, /Dmg \[13\] \[Controlled\]/)
  assert.match(text, /Once per battle/)
  assert.match(text, /Ongoing Modifier/)
  assert.match(text, /12\.5%/)
  assert.match(text, /while Requirements are met/)
  assert.doesNotMatch(text, /71 AP|Wrong legacy|Dmg \[15\]/)
  const tagColors = await panel.evaluate((element) =>
    [...element.querySelectorAll('[data-compact-skill-effect]')].map((effect) => ({
      label: getComputedStyle(effect.querySelector('[data-compact-effect-label]')).color,
      value: getComputedStyle(effect.querySelector('[data-compact-effect-magnitude]')).color,
    })),
  )
  assert.equal(tagColors.length, 3)
  for (const row of tagColors) assert.equal(row.label, row.value)
}
async function verifyModularReaders(page, viewport) {
  await page.goto(`${server.resolvedUrls.local[0]}?surface=modular-readers`, {
    waitUntil: 'networkidle',
  })
  for (const name of [
    'Modular Master details',
    'Modular Nexus parameters',
    'Modular Resonance parameters',
  ])
    await assertModularReport(page.getByRole('region', { name, exact: true }))
  assert.doesNotMatch(
    await page.evaluate(() => JSON.stringify(window.modularPublicDefinition)),
    /accuracyMode|accuracyRule|accuracyModifierBasisPoints|7777|"accuracy":\{/,
  )
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.screenshot({
    path: resolve(output, `modular-inline-${viewport.width}.png`),
    fullPage: true,
  })
  const gesture = (locator) => (viewport.width < 720 ? locator.tap() : locator.click())
  for (const attunement of ['resonance', 'essence']) {
    await page.goto(
      `${server.resolvedUrls.local[0]}?surface=nexus&modular=1&attunement=${attunement}`,
      { waitUntil: 'networkidle' },
    )
    const name = await page.evaluate((kind) => window.paletteDefinitions[kind].name, attunement)
    const trigger = page.getByRole('button', {
      name: `Preview ${attunement === 'resonance' ? 'Resonance' : 'Essence'}: ${name}`,
      exact: true,
    })
    const before = await trigger.locator('img').boundingBox()
    await gesture(trigger)
    const panel = page.getByRole('dialog', { name, exact: true })
    await panel.waitFor()
    await assertModularReport(panel)
    assert.equal(await page.getByRole('dialog').count(), 1)
    const box = await panel.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1)
    const after = await trigger.locator('img').boundingBox()
    assert.equal(after.width, before.width)
    assert.equal(after.height, before.height)
    await page.screenshot({
      path: resolve(output, `modular-nexus-${attunement}-${viewport.width}.png`),
      fullPage: true,
    })
    await page.keyboard.press('Escape')
    await panel.waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
    if (attunement === 'resonance') {
      await gesture(page.getByRole('button', { name: /^Manage Techniques\./ }))
      const editor = page.getByRole('dialog', { name: 'Techniques', exact: true })
      await editor.waitFor()
      await assertModularReport(editor)
      assert.equal(await editor.locator('[data-technique-meta]').innerText(), 'Attack / Utility')
      assert.equal(await page.getByRole('dialog').count(), 1)
      await page.screenshot({
        path: resolve(output, `modular-techniques-${viewport.width}.png`),
        fullPage: true,
      })
      for (const groupId of ['leap', 'maintain']) {
        const heading = editor.locator(`[data-ability-behavior="${groupId}"] h4`)
        await heading.scrollIntoViewIfNeeded()
        assert.equal(
          await heading.evaluate((element) => {
            const box = element.getBoundingClientRect()
            if (
              box.width <= 0 ||
              box.height <= 0 ||
              box.top < 0 ||
              box.bottom > innerHeight ||
              box.left < 0 ||
              box.right > innerWidth
            )
              return false
            const hit = document.elementFromPoint(
              box.left + box.width / 2,
              box.top + box.height / 2,
            )
            return hit === element || element.contains(hit)
          }),
          true,
          'each authored group is visibly reachable through the existing preview scrolling',
        )
        await page.screenshot({
          path: resolve(output, `modular-techniques-${groupId}-${viewport.width}.png`),
        })
      }
      await gesture(editor.getByRole('button', { name: 'Close', exact: true }))
      await editor.waitFor({ state: 'detached' })
    }
    assert.deepEqual(
      await page.evaluate(() =>
        window.requests.filter((url) => url.includes('/api/character/build/')),
      ),
      [],
    )
  }
}
async function verifyModularManual(page, viewport) {
  await page.goto(`${server.resolvedUrls.local[0]}?surface=modular-manual`, {
    waitUntil: 'networkidle',
  })
  const article = page.getByTestId('manual-article')
  await article.waitFor({ state: 'visible' })
  const catalog = article.locator('#catalog')
  await catalog.locator('summary').click()
  const text = await catalog.innerText()
  for (const value of [
    'Manual Action 1',
    'Ongoing Modifier 2',
    '11 AP / 2 MP / 1 HP',
    'Move [2]',
    'Dmg [13] [Controlled]',
    'You: MP ≥ 3',
    'Once per battle',
    '12.5%',
    'Active while Requirements are met',
  ])
    assert.ok(text.includes(value), `Manual catalogue lacks ${value}`)
  assert.doesNotMatch(text, /71 AP|Dmg \[15\]|accuracyRule|multiplierBasisPoints/)
  await catalog.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `modular-manual-catalog-${viewport.width}.png`) })
  const basics = article.locator('#basic-skills')
  const disclosures = basics.locator('details')
  assert.equal(await disclosures.count(), 5)
  for (const [index, basic] of (await disclosures.all()).entries()) {
    await basic.locator('summary').click()
    const detail = await basic.innerText()
    assert.ok(detail.includes(`Cost: ${21 + index} AP`))
    assert.ok(detail.includes('Line of Sight:'))
    assert.ok(detail.includes('Requirements:'))
  }
  assert.ok(text.includes('Move to the chosen Ground within your remaining Movement and Jump.'))
  assert.ok((await basics.innerText()).includes('Cost: 21 AP per traversal point'))
  await basics.locator('details').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `modular-manual-basics-${viewport.width}.png`) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
}
async function assertBasicContrast(locator, minimum = 4.5) {
  const colors = await locator.evaluate((element) => {
    const style = getComputedStyle(element)
    let background = style.backgroundColor
    let parent = element.parentElement
    while ((background === 'rgba(0, 0, 0, 0)' || background === 'transparent') && parent) {
      background = getComputedStyle(parent).backgroundColor
      parent = parent.parentElement
    }
    return { color: style.color, background }
  })
  const luminance = (css) => {
    const channels = css
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((value) => {
        const channel = value / 255
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  }
  const [light, dark] = [luminance(colors.color), luminance(colors.background)].sort(
    (a, b) => b - a,
  )
  assert.ok(
    (light + 0.05) / (dark + 0.05) >= minimum,
    `Basic contrast below ${minimum}: ${JSON.stringify(colors)}`,
  )
}

async function verifyBasicEditor(page, viewport) {
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Basic Skill authoring', exact: true })
  const selector = editor.getByLabel('Basic Skill', { exact: true })
  await assertBasicContrast(editor.locator('[aria-pressed="true"] strong'))
  await assertBasicContrast(editor.getByLabel('Basic Skill name', { exact: true }))
  await assertBasicContrast(
    editor.getByLabel('Basic Skill name', { exact: true }).locator('..').locator('span').first(),
  )
  assert.deepEqual(
    await selector.locator('option').evaluateAll((rows) => rows.map((row) => row.value)),
    ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp'],
  )
  assert.equal(await page.getByLabel('Combat content type').inputValue(), 'basics')
  await editor.getByLabel('Move cost basis').selectOption('flat')
  await editor.getByLabel('Basic Skill name', { exact: true }).fill('Authored Move')
  await editor.getByLabel('AP cost', { exact: true }).fill('11')
  await editor.getByLabel('MP cost', { exact: true }).fill('2')
  await editor.getByLabel('HP cost', { exact: true }).fill('1')
  await editor.getByLabel('Move maximum tiles').fill('3')
  await editor.getByRole('button', { name: 'Validate', exact: true }).click()
  await editor.getByText('Definition valid.', { exact: true }).waitFor()
  await editor.getByRole('button', { name: 'Save draft', exact: true }).click()
  await editor.getByText('Draft saved.', { exact: true }).waitFor()
  const first = await page.evaluate(() => window.basicSavedDrafts['basic.move'])
  assert.equal(first.execution.costBasis, 'flat')
  assert.deepEqual(first.ability.behaviors[0].costs, [
    { resource: 'ap', amount: 11 },
    { resource: 'mp', amount: 2 },
    { resource: 'hp', amount: 1 },
  ])
  assert.equal(first.ability.behaviors[0].effects[0].payload.maximumTiles, 3)
  // A completed save updates CAS even when a newer edit was made while it was pending.
  await page.evaluate(() => {
    window.holdBasicSave = true
  })
  await editor.getByRole('button', { name: 'Save draft', exact: true }).click()
  await page.waitForFunction(() => typeof window.releaseBasicSave === 'function')
  await editor.getByLabel('Basic Skill name', { exact: true }).fill('Newer unsaved Move')
  await page.evaluate(() => {
    window.holdBasicSave = false
    window.releaseBasicSave()
  })
  await editor
    .getByText('Earlier draft saved; newer edits are still unsaved.', { exact: true })
    .waitFor()
  assert.equal(
    await editor.getByLabel('Basic Skill name', { exact: true }).inputValue(),
    'Newer unsaved Move',
  )
  await editor.getByRole('button', { name: 'Save draft', exact: true }).click()
  await editor.getByText('Draft saved.', { exact: true }).waitFor()
  await editor.getByLabel('AP cost', { exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `basic-editor-move-${viewport.width}.png`) })
  await selector.selectOption('unarmed.basic')
  await editor.getByLabel('AP cost', { exact: true }).fill('0')
  assert.ok(
    (
      await editor.getByRole('region', { name: 'Basic Skill definition report' }).textContent()
    ).includes('Basic Attack requires a positive authored AP cost.'),
  )
  await editor.getByLabel('AP cost', { exact: true }).fill('17')
  await editor.getByLabel('Higher Power scaling (%)').fill('42.25')
  await editor.getByRole('button', { name: 'Save draft', exact: true }).click()
  await editor.getByText('Draft saved.', { exact: true }).waitFor()
  assert.equal(
    await page.evaluate(
      () => window.basicSavedDrafts['unarmed.basic'].execution.scalingBasisPoints,
    ),
    4225,
  )
  await editor.getByLabel('Higher Power scaling (%)').scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `basic-editor-attack-${viewport.width}.png`) })
  for (const [index, id] of ['basic.guard', 'basic.recover', 'basic.recover.mp'].entries()) {
    await selector.selectOption(id)
    if (id === 'basic.guard')
      assert.equal(
        await editor.getByLabel('Basic Skill name', { exact: true }).inputValue(),
        'Saved Guard draft',
      )
    await editor.getByLabel('Basic Skill name', { exact: true }).fill(`Edited ${id}`)
    await editor.getByLabel('AP cost', { exact: true }).fill(String(9 + index))
    await editor.getByLabel('Recovery rounding').selectOption('floor')
    if (id !== 'basic.guard')
      await editor.getByLabel('Recovery percent', { exact: true }).fill(String(21 + index))
    await editor.getByRole('button', { name: 'Validate', exact: true }).click()
    await editor.getByText('Definition valid.', { exact: true }).waitFor()
    await editor.getByRole('button', { name: 'Save draft', exact: true }).click()
    await editor.getByText('Draft saved.', { exact: true }).waitFor()
  }
  await selector.selectOption('basic.move')
  assert.equal(
    await editor.getByLabel('Basic Skill name', { exact: true }).inputValue(),
    'Newer unsaved Move',
  )
  const requests = await page.evaluate(() => window.basicDraftRequests)
  assert.deepEqual(
    requests
      .filter((row) => row.operation === 'save-draft' && row.definition.id === 'basic.move')
      .map((row) => row.expectedDraftVersion),
    [null, 1, 2],
  )
  assert.equal(
    requests.find((row) => row.operation === 'save-draft' && row.definition.id === 'basic.guard')
      .expectedDraftVersion,
    4,
  )
  assert.ok(
    requests
      .filter((row) => row.operation === 'save-draft')
      .every((row) => row.baseVersion === 1 && row.definition.contentVersion === 1),
  )
  await selector.selectOption('basic.recover.mp')
  await editor
    .getByRole('region', { name: 'Basic Skill definition report' })
    .scrollIntoViewIfNeeded()
  await assertBasicContrast(
    editor
      .getByRole('region', { name: 'Basic Skill definition report' })
      .locator('[data-compact-effect-label]')
      .first(),
  )
  await assertBasicContrast(editor.getByRole('button', { name: 'Save draft', exact: true }))
  await page.screenshot({ path: resolve(output, `basic-editor-recovery-${viewport.width}.png`) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.equal(await editor.getByRole('alert').count(), 0)
}

async function verifyBasicPublication(page, viewport) {
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Basic Skill authoring', exact: true })
  const select = editor.getByLabel('Basic Skill', { exact: true })
  const gesture = (locator) => (viewport.width < 720 ? locator.tap() : locator.click())
  const button = (name) => editor.getByRole('button', { name, exact: true })
  for (const id of [
    'basic.move',
    'unarmed.basic',
    'basic.guard',
    'basic.recover',
    'basic.recover.mp',
  ]) {
    await select.selectOption(id)
    await editor.getByLabel('Basic Skill name', { exact: true }).fill(`Publish ${id}`)
    if (id === 'basic.move') await editor.getByLabel('Move cost basis').selectOption('flat')
    await editor.getByLabel('AP cost', { exact: true }).fill('11')
    await editor.getByLabel('MP cost', { exact: true }).fill('2')
    await editor.getByLabel('HP cost', { exact: true }).fill('1')
    let groupId = 'use'
    if (id === 'basic.guard') {
      await gesture(editor.getByRole('button', { name: 'Add behavior group', exact: true }))
      const group = editor.locator('[data-ability-group="group-1"]')
      await group.getByLabel('AP cost', { exact: true }).fill('17')
      await group.getByLabel('MP cost', { exact: true }).fill('3')
      await group.getByLabel('HP cost', { exact: true }).fill('2')
      groupId = 'group-1'
      await editor.getByLabel('Preview action group', { exact: true }).selectOption(groupId)
    }
    assert.equal(await button('Publish').isDisabled(), true)
    await gesture(button('Save draft'))
    await editor.getByText('Draft saved.', { exact: true }).waitFor()
    await gesture(button('Validate'))
    await editor.getByText('Definition valid.', { exact: true }).waitFor()
    await gesture(button('Diff'))
    await editor.getByRole('region', { name: 'Semantic diff', exact: true }).waitFor()
    await gesture(button('Preview'))
    const preview = editor.getByRole('region', { name: 'Deterministic preview', exact: true })
    await preview.waitFor()
    assert.match(await preview.innerText(), new RegExp(groupId))
    assert.match(
      await preview.innerText(),
      id === 'basic.guard' ? /17 AP[\s\S]*3 MP[\s\S]*2 HP/ : /11 AP[\s\S]*2 MP[\s\S]*1 HP/,
    )
    if (id === 'basic.move') assert.match(await preview.innerText(), /1 tile/)
    await gesture(button('Publish'))
    const confirmation = editor.getByRole('region', { name: 'Confirm publication', exact: true })
    await confirmation.waitFor()
    assert.match(await confirmation.innerText(), /Base v1[\s\S]*New v2/)
    const beforeCancel = await page.evaluate(() => window.basicPublishedVersions.length)
    await gesture(confirmation.getByRole('button', { name: 'Cancel', exact: true }))
    assert.equal(await page.evaluate(() => window.basicPublishedVersions.length), beforeCancel)
    await gesture(button('Publish'))
    if (id === 'basic.recover.mp') {
      await page.evaluate(() => {
        window.rejectBasicPublish = true
      })
      await gesture(confirmation.getByRole('button', { name: 'Confirm publish', exact: true }))
      await editor.getByRole('alert').waitFor()
      assert.match(await editor.getByRole('alert').innerText(), /Combat content changed/)
      assert.equal(
        await editor.getByLabel('Basic Skill name', { exact: true }).inputValue(),
        `Publish ${id}`,
      )
      assert.equal(await page.evaluate(() => window.basicPublishedVersions.length), beforeCancel)
      await page.evaluate(() => {
        window.rejectBasicPublish = false
      })
    }
    if (id === 'basic.move')
      await page.evaluate(() => {
        window.holdBasicPublish = true
      })
    await gesture(confirmation.getByRole('button', { name: 'Confirm publish', exact: true }))
    if (id === 'basic.move') {
      await page.waitForFunction(() => typeof window.releaseBasicPublish === 'function')
      await editor.getByLabel('Basic Skill name', { exact: true }).fill('Newer unpublished Move')
      await page.evaluate(() => {
        window.releaseBasicPublish()
        window.holdBasicPublish = false
      })
      await editor
        .getByText('Published earlier draft as v2; newer edits are still unpublished.', {
          exact: true,
        })
        .waitFor()
      assert.equal(
        await editor.getByLabel('Basic Skill name', { exact: true }).inputValue(),
        'Newer unpublished Move',
      )
      await gesture(button('Save draft'))
      await editor.getByText('Draft saved.', { exact: true }).waitFor()
      const lastSave = await page.evaluate(() =>
        window.basicDraftRequests.filter((row) => row.operation === 'save-draft').at(-1),
      )
      assert.equal(lastSave.baseVersion, 2)
      assert.equal(lastSave.expectedDraftVersion, 1)
    } else await editor.getByText('Published immutable v2.', { exact: true }).waitFor()
    assert.equal(await button('Publish').isDisabled(), true)
    assert.equal(await editor.getByRole('button', { name: 'Rollback', exact: true }).count(), 0)
    assert.match(
      await editor.getByRole('region', { name: 'Version history', exact: true }).innerText(),
      /v2[\s\S]*Current[\s\S]*v1/,
    )
  }
  const result = await page.evaluate(() => ({
    versions: window.basicPublishedVersions,
    requests: window.basicDraftRequests,
    definitions: window.basicPublishedDefinitions,
  }))
  assert.deepEqual(
    result.versions.map((row) => row.id),
    ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp'],
  )
  assert.ok(
    result.requests
      .filter((row) => row.operation === 'publish')
      .every((row) => row.expectedBaseVersion === 1),
  )
  assert.equal(result.definitions['basic.guard'].ability.behaviors.length, 2)
  assert.equal(result.definitions['basic.move'].name, 'Publish basic.move')
  assert.equal(result.definitions['basic.recover.mp'].contentVersion, 2)
  await editor
    .getByRole('region', { name: 'Version history', exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `basic-publication-${viewport.width}.png`) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.equal(await editor.getByRole('alert').count(), 0)
}

async function verifySelectedGroupPreview(page, viewport, kind) {
  await page.goto(
    `${server.resolvedUrls.local[0]}?surface=selected-preview&kind=${kind}&timing=controlled`,
    {
      waitUntil: 'networkidle',
    },
  )
  const gesture = (locator) => (viewport.width < 720 ? locator.tap() : locator.click())
  const selector = page.getByLabel('Preview action group', { exact: true })
  const preview = page.getByRole('region', { name: 'Deterministic preview', exact: true })
  const publish = page.getByRole('button', { name: 'Publish', exact: true })
  const runPreview = () => gesture(page.getByRole('button', { name: 'Preview', exact: true }))
  assert.equal(await selector.inputValue(), 'brace')
  const selectorBounds = await selector.boundingBox()
  assert.ok(
    selectorBounds && selectorBounds.width >= 200,
    'The actual preview group selector needs readable space',
  )
  await gesture(page.getByRole('button', { name: 'Validate', exact: true }))
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      (button) => button.textContent === 'Diff' && !button.disabled,
    ),
  )
  await gesture(page.getByRole('button', { name: 'Diff', exact: true }))
  await page.getByRole('region', { name: 'Semantic diff', exact: true }).waitFor()
  await runPreview()
  await preview.waitFor()
  assert.match(await preview.innerText(), /brace[\s\S]*5 AP[\s\S]*barrier-change/)
  await selector.selectOption('recover')
  assert.equal(await preview.count(), 0)
  assert.equal(await publish.isDisabled(), true)
  await runPreview()
  await preview.waitFor()
  assert.match(await preview.innerText(), /recover[\s\S]*13 AP[\s\S]*3 MP[\s\S]*healing/)
  const requests = await page.evaluate(() =>
    window.groupPreviewRequests.filter((row) => row.operation === 'preview'),
  )
  assert.deepEqual(
    requests.map((row) => row.behaviorId),
    ['brace', 'recover'],
  )
  assert.equal(requests[1].definition.ability.behaviors[1].effects[0].payload.amount, 17)
  await page
    .locator('[data-ability-group="recover"]')
    .getByLabel('Healing amount', { exact: true })
    .fill('18')
  assert.equal(await preview.count(), 0)
  assert.equal(await publish.isDisabled(), true)
  await gesture(page.getByRole('button', { name: 'Validate', exact: true }))
  await page.waitForFunction(() =>
    [...document.querySelectorAll('button')].some(
      (button) => button.textContent === 'Diff' && !button.disabled,
    ),
  )
  await gesture(page.getByRole('button', { name: 'Diff', exact: true }))
  await page.getByRole('region', { name: 'Semantic diff', exact: true }).waitFor()
  await runPreview()
  await preview.waitFor()
  assert.match(await preview.innerText(), /Free Controlled prime/)
  assert.match(await preview.innerText(), /Costs and outcomes below describe its release/)
  assert.match(await preview.innerText(), /recover[\s\S]*13 AP[\s\S]*3 MP[\s\S]*healing/)
  assert.equal(
    await page.evaluate(
      () =>
        window.groupPreviewRequests.filter((row) => row.operation === 'preview').at(-1).definition
          .ability.behaviors[1].effects[0].timing,
    ),
    undefined,
    'Controlled healing comes from the global policy, never a per-Skill timing override',
  )
  await gesture(publish)
  const confirmation = page.getByRole('region', { name: 'Confirm publication', exact: true })
  await confirmation.waitFor()
  await selector.selectOption('brace')
  assert.equal(await confirmation.count(), 0)
  assert.equal(await preview.count(), 0)
  assert.equal(await publish.isDisabled(), true)
  await selector.selectOption('recover')
  await runPreview()
  await preview.waitFor()
  await selector.scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `selected-preview-${kind}-${viewport.width}.png`) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await page.evaluate(() => {
    window.holdGroupPreview = true
  })
  await runPreview()
  await page.waitForFunction(() => typeof window.releaseGroupPreview === 'function')
  assert.equal(await selector.isDisabled(), true)
  await page
    .locator('[data-ability-group="recover"]')
    .getByLabel('AP cost', { exact: true })
    .fill('14')
  await page.evaluate(() => {
    window.releaseGroupPreview()
    window.holdGroupPreview = false
  })
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Preview action group"]').disabled,
  )
  assert.equal(await preview.count(), 0, 'An older response cannot review the newer draft')
  assert.equal(await publish.isDisabled(), true)
  assert.equal(await page.getByRole('alert').count(), 0)
  assert.ok(
    await page.evaluate(() =>
      window.groupPreviewRequests.every((row) =>
        ['validate', 'diff', 'preview'].includes(row.operation),
      ),
    ),
  )
}

async function verifyCanonicalEditor(page, viewport) {
  await page.goto(`${server.resolvedUrls.local[0]}?surface=canonical-editor`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Modular ability editor', exact: true })
  const leap = editor.locator('[data-ability-group="leap"]')
  const gesture = (locator) => (viewport.width < 720 ? locator.tap() : locator.click())
  await leap.getByLabel('AP cost', { exact: true }).fill('14')
  await leap.getByLabel('HP cost', { exact: true }).fill('2')
  await leap.getByLabel('Fixed hit chance (%)', { exact: true }).fill('55.5')
  await leap.getByLabel('Cooldown (owner turns; 0 means none)', { exact: true }).fill('2')
  await leap
    .getByRole('group', { name: 'Requirements', exact: true })
    .getByLabel('Resource threshold', { exact: true })
    .fill('4')
  const walk = leap.locator('[data-ability-effect="walk"]')
  await walk.getByLabel('Move maximum tiles', { exact: true }).fill('3')
  const hit = leap.locator('[data-ability-effect="hit"]')
  await hit.getByLabel('Damage amount', { exact: true }).fill('17')
  assert.equal(await hit.getByLabel('Effect timing', { exact: true }).count(), 0)
  await leap.getByLabel('New group effect', { exact: true }).selectOption('pierce')
  await gesture(leap.getByRole('button', { name: 'Add group effect', exact: true }))
  const pierce = leap.locator('[data-ability-effect="effect-1"]')
  await pierce.getByLabel('Equipment Armor ignored (%)', { exact: true }).fill('33.33')
  await pierce.getByLabel('Damage amount', { exact: true }).fill('5')
  assert.equal(await pierce.getByLabel('Piercing', { exact: true }).count(), 0)
  assert.equal(await pierce.getByLabel('Vengeance enabled', { exact: true }).count(), 0)
  await gesture(walk.getByRole('button', { name: '↓ Down', exact: true }))
  assert.ok((await editor.getByRole('status').innerText()).includes('Move must occur once, first'))
  assert.equal(
    await walk.getByLabel('Effect description', { exact: true }).inputValue(),
    'Walk <once> & return',
  )
  await gesture(walk.getByRole('button', { name: '↑ Up', exact: true }))
  const maintained = editor.locator('[data-ability-group="maintain"]')
  await maintained.getByLabel('Outgoing damage bonus (%)', { exact: true }).fill('15.25')
  await gesture(editor.getByRole('button', { name: 'Add behavior group', exact: true }))
  await gesture(
    editor
      .locator('[data-ability-group="group-1"]')
      .getByRole('button', { name: 'Remove group', exact: true }),
  )
  const saved = await page.evaluate(() => window.inspectEditedAbility())
  assert.equal(saved.definition.behaviors.length, 2)
  const group = saved.definition.behaviors[0]
  assert.deepEqual(Object.fromEntries(group.costs.map((row) => [row.resource, row.amount])), {
    mp: 2,
    ap: 14,
    hp: 2,
  })
  assert.equal(group.accuracy.chanceBasisPoints, 5550)
  assert.equal(group.cooldown.ownerTurns, 2)
  assert.equal(group.requirements.amount, 4)
  assert.equal(group.effects[0].payload.maximumTiles, 3)
  assert.equal(group.effects[1].payload.amount, 17)
  assert.equal(group.effects[1].timing, 'controlled')
  assert.equal(group.effects[2].payload.armorIgnoredBasisPoints, 3333)
  assert.equal(saved.definition.behaviors[1].effects[0].payload.multiplierBasisPoints, 11525)
  assert.deepEqual(saved.notes, ['Walk <once> & return', null, null, 'Maintain guard'])
  assert.equal(await editor.getByRole('status').count(), 0)
  for (const [name, target] of [
    ['costs', leap.getByLabel('AP cost', { exact: true })],
    ['move', walk],
    ['ongoing', maintained],
  ]) {
    await target.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: resolve(output, `canonical-editor-${name}-${viewport.width}.png`),
    })
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.deepEqual(await page.evaluate(() => window.requests), [])
}
async function verifyBasicServiceRestore(page, viewport) {
  await page.request.post(`${server.resolvedUrls.local[0]}__basic-acceptance/reset`)
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Basic Skill authoring', exact: true })
  const select = editor.getByLabel('Basic Skill', { exact: true })
  await editor.waitFor({ state: 'visible' })
  await select.waitFor({ state: 'visible' })
  const activate = async (locator) => {
    if (viewport.width < 720) await locator.tap()
    else {
      await locator.focus()
      await page.keyboard.press('Enter')
    }
  }
  const inspect = async () =>
    (await page.request.get(`${server.resolvedUrls.local[0]}__basic-acceptance/inspect`)).json()
  const ids = ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp']
  assert.deepEqual(
    await select.locator('option').evaluateAll((options) => options.map((row) => row.value)),
    ids,
  )
  for (const id of ids) {
    await select.selectOption(id)
    const original = (await inspect()).records.find((row) => row.id === id)
    const restore = editor.getByRole('button', { name: 'Restore v1 to draft', exact: true })
    await activate(restore)
    const confirmation = editor.getByRole('region', {
      name: 'Confirm restore to draft',
      exact: true,
    })
    await confirmation.waitFor()
    assert.match(
      await confirmation.innerText(),
      /Published versions and active battles stay unchanged/,
    )
    const count = (await inspect()).requests.length
    await activate(confirmation.getByRole('button', { name: 'Cancel restore', exact: true }))
    assert.equal((await inspect()).requests.length, count)
    await activate(restore)
    await activate(
      confirmation.getByRole('button', { name: 'Confirm restore to draft', exact: true }),
    )
    await editor
      .getByText('Restored v1 to a draft. Review and publish to apply it.', { exact: true })
      .waitFor()
    const saved = await inspect()
    const record = saved.records.find((row) => row.id === id)
    assert.deepEqual(record.current, original.current)
    assert.deepEqual(record.history, original.history)
    assert.equal(record.draft.baseVersion, 2)
    assert.equal(record.draft.definition.contentVersion, 1)
    assert.equal(saved.oldCapturesUnchanged, true)
    assert.equal(
      await editor.getByLabel('Basic Skill name', { exact: true }).inputValue(),
      record.draft.definition.name,
    )
    const button = (name) => editor.getByRole('button', { name, exact: true })
    assert.equal(await button('Publish').isDisabled(), true)
    await activate(button('Validate'))
    await editor.getByText('Definition valid.', { exact: true }).waitFor()
    await activate(button('Diff'))
    await editor.getByRole('region', { name: 'Semantic diff', exact: true }).waitFor()
    const previewResponse = page.waitForResponse((response) => {
      if (!response.url().endsWith('/api/master/combat-content')) return false
      return response.request().postDataJSON()?.operation === 'preview'
    })
    await activate(button('Preview'))
    const preview = editor.getByRole('region', { name: 'Deterministic preview', exact: true })
    await preview.waitFor()
    const actualPreview = (await (await previewResponse).json()).preview
    assert.equal(actualPreview.legal, true)
    assert.equal(actualPreview.behaviorId, record.draft.definition.ability.behaviors[0].id)
    assert.match(await preview.innerText(), new RegExp(`${actualPreview.costs.actionEconomy} AP`))
    await activate(button('Publish'))
    const publication = editor.getByRole('region', { name: 'Confirm publication', exact: true })
    await publication.waitFor()
    assert.match(await publication.innerText(), /Base v2[\s\S]*New v3/)
    await activate(publication.getByRole('button', { name: 'Confirm publish', exact: true }))
    await editor.getByText('Published immutable v3.', { exact: true }).waitFor()
    const after = await inspect()
    const current = after.records.find((row) => row.id === id)
    assert.deepEqual(current.current.definition, { ...record.draft.definition, contentVersion: 3 })
    assert.deepEqual(current.history[0], original.history[0])
    assert.equal(current.history.length, 2)
    assert.equal(after.oldCapturesUnchanged, true)
    assert.deepEqual(after.oldVersions, [2, 2, 2])
    assert.equal(await editor.getByRole('button', { name: 'Rollback', exact: true }).count(), 0)
    await editor
      .getByRole('region', { name: 'Version history', exact: true })
      .scrollIntoViewIfNeeded()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({
      path: resolve(output, `basic-service-restore-${id}-${viewport.width}.png`),
    })
  }
  const result = await inspect()
  assert.equal(result.requests.filter((row) => row.operation === 'restore-basic-draft').length, 5)
  assert.equal(result.requests.filter((row) => row.operation === 'publish').length, 5)
  await fs.writeFile(
    resolve(output, `basic-service-${viewport.width}.json`),
    JSON.stringify(result, null, 2),
  )
}
try {
  for (const viewport of [
    { width: 1366, height: 768 },
    ...(basicServiceAcceptance
      ? [
          { width: 1440, height: 900 },
          { width: 720, height: 450 },
        ]
      : []),
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport, hasTouch: viewport.width < 720 })
    const errors = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
      browserErrors.push(error.message)
    })
    if (basicServiceAcceptance) {
      await verifyBasicServiceRestore(page, viewport)
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        status: 'passed',
        basics: 5,
        transport: 'actual local handler/service/repository/preview/publication',
        input: viewport.width < 720 ? 'touch' : 'keyboard',
        scope:
          'Production editor with controlled fixture actor and in-memory persistence; no hosted identity, physical browser zoom or human gameplay claim.',
      })
      await page.close()
      continue
    }
    await verifyModularReaders(page, viewport)
    await verifyModularManual(page, viewport)
    await verifyCanonicalEditor(page, viewport)
    await verifyBasicEditor(page, viewport)
    await verifyBasicPublication(page, viewport)
    await verifySelectedGroupPreview(page, viewport, 'skill')
    await verifySelectedGroupPreview(page, viewport, 'essence')
    if (process.env.AV_MODULAR_READERS_ONLY === '1') {
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        status: 'passed',
        modularReaderContexts: 12,
        scope: 'Production components with fixture data; no hosted gameplay claim.',
      })
      await page.close()
      continue
    }
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
      assert.ok(!summary.includes('[1 Turn]'))
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
    assert.equal(await inline.locator('dl > div').first().locator('dd').textContent(), 'Utility')
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
    for (const scenario of [
      { wet: 'unset', lifetime: '3 affected turns starting when damage settles (Instant)' },
      { wet: 'instant', lifetime: '3 affected turns starting when damage settles (Instant)' },
      { wet: 'next-round', lifetime: '3 full rounds starting next round after damage settles' },
      {
        wet: 'delayed',
        lifetime: '3 full rounds starting two round boundaries after damage settles (Delayed)',
      },
      {
        wet: 'delayed',
        elemental: 1,
        lifetime: '3 full rounds starting two round boundaries after damage settles (Delayed)',
      },
      {
        wet: 'delayed',
        duration: 4,
        potency: 42,
        lifetime: '4 full rounds starting two round boundaries after damage settles (Delayed)',
      },
      { wet: 'delayed', historical: true },
    ]) {
      await page.goto(
        `${server.resolvedUrls.local[0]}?surface=elemental-readers&wet=${scenario.wet}&historical=${!!scenario.historical}&elemental=${scenario.elemental || 2}`,
        { waitUntil: 'networkidle' },
      )
      if (scenario.duration) {
        const editor = page
          .getByRole('region', { name: 'Master elemental authoring' })
          .locator('[data-effect-type="apply-status"]')
        await editor
          .getByLabel('Effect duration (turns)', { exact: true })
          .fill(String(scenario.duration))
        await editor
          .getByLabel('Status potency (percent)', { exact: true })
          .fill(String(scenario.potency))
      }
      const master = page.getByRole('region', { name: 'Master elemental details' })
      assert.deepEqual((await master.locator('dt').allTextContents()).slice(0, 10), fields)
      if (!scenario.historical && scenario.elemental !== 1) {
        const status = await master.locator('ol li').nth(1).textContent()
        assert.ok(status.includes(scenario.lifetime))
        assert.ok(status.includes(`${scenario.potency || 35}% Storm damage`))
      }
      const raw = page.getByRole('region', { name: 'Captured summon abilities' })
      assert.equal(await raw.locator('dt').count(), 0)
      assert.equal((await raw.textContent()).trim(), 'Captured Water!')
      for (const title of ['Overlap Water', 'Captured Water']) {
        const trigger = page.getByRole('button', { name: `About ${title}`, exact: true })
        await trigger.click()
        const popup = page.getByRole('dialog', { name: title, exact: true })
        await popup.waitFor()
        assert.deepEqual(await popup.locator('dt').allTextContents(), fields)
        const explanations = await popup.getByLabel('Effect explanations').textContent()
        if (scenario.historical) {
          assert.ok(!explanations.includes('Initiative by 10%'))
          assert.ok(!explanations.includes('full rounds starting'))
          assert.ok(!explanations.includes('If a damaged recipient'))
        } else if (scenario.elemental === 1) {
          assert.ok(explanations.includes(scenario.lifetime))
          const damage = await popup
            .getByLabel('Effect explanations')
            .locator('li')
            .first()
            .textContent()
          assert.ok(damage.includes('35% Storm damage'))
          if (title === 'Overlap Water') {
            assert.ok(damage.includes('Otherwise:'))
            assert.ok(damage.includes('20% Storm damage'))
          }
        } else {
          assert.ok(explanations.includes(scenario.lifetime))
          assert.ok(explanations.includes(`${scenario.potency || 35}% Storm damage`))
          assert.equal(
            await popup.locator('[data-compact-skill-effect]').first().textContent(),
            'Water Dmg [10]',
          )
          const rows = popup.getByLabel('Effect explanations').locator('li')
          assert.equal(await rows.count(), 2)
          const damage = await rows.first().textContent()
          const status = await rows.nth(1).textContent()
          assert.ok(!/applies Drenched|affected turns|full rounds|35%|Otherwise/.test(damage))
          assert.ok(status.includes(scenario.lifetime))
          assert.ok(status.includes(`${scenario.potency || 35}% Storm damage`))
          assert.ok(status.includes('positive hostile HP damage'))
          assert.ok(status.includes('survives'))
          assert.ok(status.includes('10%, capped at 100%'))
          assert.ok(!status.includes('Fire removes'))
          if (title === 'Overlap Water') {
            assert.ok(!explanations.includes('20% Storm damage'))
          }
        }
        const popupBox = await popup.boundingBox()
        assert.ok(popupBox.x >= 0 && popupBox.x + popupBox.width <= viewport.width + 1)
        assert.ok(popupBox.y >= 0 && popupBox.y + popupBox.height <= viewport.height + 1)
        // Reach the last explanation through the real popup's scrolling container.
        const last = popup.getByLabel('Effect explanations').locator('li').last()
        await last.scrollIntoViewIfNeeded()
        const lastBox = await last.boundingBox()
        assert.ok(lastBox.y >= 0 && lastBox.y < viewport.height)
        assert.ok(await popup.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
        await popup.screenshot({
          path: resolve(
            output,
            `elemental-${title === 'Overlap Water' ? 'battle' : 'summon'}-${scenario.historical ? 'historical' : `${scenario.wet}-policy${scenario.elemental || 2}-duration${scenario.duration || 3}`}-${viewport.width}.png`,
          ),
        })
        await page.keyboard.press('Escape')
        await popup.waitFor({ state: 'detached' })
        assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
      }
    }
    for (const fireIntent of ['unit', 'ground']) {
      await page.goto(`${server.resolvedUrls.local[0]}?surface=fire-readers&fire=${fireIntent}`, {
        waitUntil: 'networkidle',
      })
      const fireEditor = page.getByRole('region', { name: 'Master Fire authoring' })
      await fireEditor.getByLabel('New effect type').selectOption('cleanse-chilled')
      await fireEditor.getByRole('button', { name: 'Add effect', exact: true }).click()
      assert.deepEqual(await page.evaluate(() => window.fireAuthoringEffects[1]), {
        type: 'remove-status',
        recipient: 'actor',
        statusIds: ['frozen'],
      })
      const cleanseEditor = fireEditor.locator('[data-effect-type="remove-status"]')
      assert.equal(
        await cleanseEditor.getByLabel('Status IDs', { exact: true }).inputValue(),
        'frozen',
      )
      assert.equal(
        await cleanseEditor.getByLabel('Status removal recipient', { exact: true }).inputValue(),
        'actor',
      )
      assert.equal(
        await cleanseEditor
          .getByRole('button', { name: 'Use standard Cleanse', exact: true })
          .count(),
        0,
      )
      for (const name of ['Master Fire details', 'Nexus Fire parameters']) {
        const report = page.getByRole('region', { name })
        assert.deepEqual((await report.locator('dt').allTextContents()).slice(0, 10), fields)
        assert.ok((await report.textContent()).includes('Cleanse Chilled [Instant]'))
        assert.ok((await report.textContent()).includes('Enemy / Ground'))
      }
      await page.getByRole('button', { name: 'About Fire report', exact: true }).click()
      const firePopup = page.getByRole('dialog', { name: 'Fire report', exact: true })
      await firePopup.waitFor()
      assert.deepEqual(await firePopup.locator('dt').allTextContents(), fields)
      if (fireIntent === 'ground') {
        assert.ok(
          (
            await firePopup.getByLabel('Ground area rules', { exact: true }).textContent()
          ).startsWith('Ground casts: 3 rounds'),
        )
      }
      const fireRows = firePopup.getByLabel('Effect explanations').locator('li')
      assert.equal(await fireRows.count(), 2)
      assert.ok(!(await fireRows.first().textContent()).includes('cleanses Chilled'))
      assert.equal(
        await fireRows.nth(1).textContent(),
        'Cleanse Chilled — Removes Chilled from the caster only; other statuses remain.',
      )
      await firePopup.screenshot({
        path: resolve(output, `fire-limited-cleanse-${fireIntent}-${viewport.width}.png`),
      })
      await page.keyboard.press('Escape')
      await firePopup.waitFor({ state: 'detached' })
    }
    assert.deepEqual(errors, [])
    evidence.push({ viewport, status: 'passed' })
    await page.close()
  }
  await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(`Skill parameter family/palette browser regression passed. Evidence: ${output}`)
} catch (error) {
  const failedPage = browser
    .contexts()
    .flatMap((context) => context.pages())
    .at(-1)
  await Promise.allSettled([
    fs.writeFile(
      resolve(output, 'failure.json'),
      JSON.stringify({ error: String(error), browserErrors, evidence }, null, 2),
    ),
    ...(failedPage
      ? [
          failedPage.screenshot({ path: resolve(output, 'failure.png'), timeout: 5000 }),
          failedPage.content().then((html) => fs.writeFile(resolve(output, 'failure.html'), html)),
          failedPage
            .evaluate(() => ({
              url: location.href,
              readyState: document.readyState,
              body: document.body.innerText.slice(0, 5000),
              basicOptions: [
                ...document.querySelectorAll('select[aria-label="Basic Skill"] option'),
              ].map((option) => option.value),
            }))
            .then((state) =>
              fs.writeFile(resolve(output, 'failure-state.json'), JSON.stringify(state, null, 2)),
            ),
        ]
      : []),
  ])
  throw error
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
