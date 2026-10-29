// Check production Nexus, Master and battle parameter renderers with canonical definitions.
// Run: pnpm --filter @aurevane/web exec node scripts/skill-parameter-palette-browser-regression.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

async function openEffectParameters(scope) {
  const panels = scope.locator(
    'xpath=ancestor::details[@data-effect-collapsible] | .//details[@data-effect-collapsible]',
  )
  for (let i = 0; i < (await panels.count()); i++) {
    const panel = panels.nth(i)
    if ((await panel.getAttribute('open')) === null) await panel.locator(':scope > summary').click()
  }
}

async function activateAbilitySection(scope, name) {
  let tabs = scope.getByRole('tab', { name, exact: true })
  if (!(await tabs.count()))
    tabs = scope
      .locator(
        'xpath=ancestor-or-self::*[./*[@role="tablist" and @aria-label="Ability sections"]][1]',
      )
      .getByRole('tab', { name, exact: true })
  if (await tabs.count()) {
    const tab = tabs.first()
    if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click()
    await browserExpect(() => assertBasicContrast(tab)).toPass({
      timeout: 1500,
      intervals: [50, 100, 200],
    })
  }
}
async function abilityField(scope, label) {
  const section = [
    'AP cost',
    'MP cost',
    'HP cost',
    'Move cost basis',
    'Cooldown (owner turns; 0 means none)',
  ].includes(label)
    ? 'Action Economy'
    : [
          'Higher Power scaling (%)',
          'Recovery rounding',
          'Recovery percent',
          'Move maximum tiles',
          'Healing amount',
        ].includes(label)
      ? 'Effects'
      : ['Accuracy rule', 'Fixed hit chance (%)'].includes(label)
        ? 'Accuracy'
        : 'Details & Text'
  await activateAbilitySection(scope, section)
  const field = scope.getByLabel(label, { exact: true })
  if (['MP cost', 'HP cost'].includes(label) && (await field.count()) === 0) {
    const add = scope.getByRole('button', { name: `Add ${label}`, exact: true })
    await add.click()
    await field.waitFor({ state: 'visible' })
    assert.equal(await field.inputValue(), '1', 'Adding a resource starts with its authored amount')
    assert.equal(await add.count(), 0)
    assert.equal(
      await scope.getByRole('button', { name: `Remove ${label}`, exact: true }).count(),
      1,
    )
  }
  await openEffectParameters(field.locator('..'))
  return field
}

const require = createRequire(import.meta.url)
const { expect: browserExpect } = require('@playwright/test')
const { createServer, build } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const shellReachabilityOnly = process.env.AV_MASTER_SHELL_REACHABILITY_ONLY === '1'
const editorIdentityOnly = process.env.AV_MASTER_EDITOR_IDENTITY_ONLY === '1'
const attunementPointerOnly = process.env.AV_ATTUNEMENT_POINTER_ONLY === '1'
const heldRevertOnly = process.env.AV_BASIC_HELD_REVERT_ONLY === '1'
const originalRpcAcceptance = process.env.AV_BASIC_ORIGINAL_RPC_ACCEPTANCE === '1'
const basicServiceAcceptance =
  process.env.AV_BASIC_SERVICE_ACCEPTANCE === '1' ||
  originalRpcAcceptance ||
  editorIdentityOnly ||
  shellReachabilityOnly
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'skill-parameter-palette-'))
const output =
  process.env.AV_SKILL_PARAMETER_PALETTE_EVIDENCE_DIR ||
  resolve(tmpdir(), 'skill-parameter-palette-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/skill-parameter-palette-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
// The editor no longer owns a Preview pane. Its former production readers remain
// independently mounted here so Chronicle and native-sample compatibility remain tested.
// Their retired Master preview palette is legacy coverage, not proof of live player-page contrast.
const entryPath = resolve(fixture, 'entry.jsx')
let entrySource = await fs.readFile(entryPath, 'utf8')
entrySource =
  `import { ContentRecordPreview } from '@/components/master/combat-content/content-record-preview'\nimport legacyBasicReaderTheme from '@/components/master/combat-content/basic-content-editor.module.css'\n` +
  entrySource
// The production editor fills a bounded Master workspace; provide that same
// containing height instead of the retired auto-height fixture wrapper.
const basicStart = entrySource.indexOf('function BasicEditor()')
const basicEnd = entrySource.indexOf('const sectionStyle', basicStart)
entrySource =
  entrySource.slice(0, basicStart) +
  entrySource
    .slice(basicStart, basicEnd)
    .replace("height: 'auto'", "height: 'calc(100dvh - 24px)'") +
  entrySource.slice(basicEnd)
entrySource += `
let parityRoot
window.renderBasicParity = definition => {
  let host = document.querySelector('[data-basic-parity-host]')
  if (!host) {
    host = document.createElement('section')
    host.setAttribute('data-basic-parity-host', '')
    host.setAttribute('aria-label', 'Legacy Basic reader compatibility')
    host.className = 'av-master ' + masterTheme.workspace + ' ' + legacyBasicReaderTheme.editor
    Object.assign(host.style, {display: 'block', position: 'relative', zIndex: '1000', height: 'auto', padding: '12px', background: '#ddd3c0'})
    document.body.append(host)
    parityRoot = createRoot(host)
  }
  host.style.display = 'block'
  parityRoot.render(<SkillEffectTimingProvider policy={defaultCombatEffectTimingPolicy()}><ContentRecordPreview key={JSON.stringify(definition)} kind="skill" working={definition} saved={definition} current={definition}/></SkillEffectTimingProvider>)
}
`
await fs.writeFile(entryPath, entrySource)
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
  resolve(fixture, 'shell.jsx'),
  `import React from 'react';import {AuthenticatedShellPresentation} from '@/components/shell/authenticated-shell-presentation';export function AuthenticatedShellFrame({children}){return <AuthenticatedShellPresentation masterPanelHref="/master">{children}</AuthenticatedShellPresentation>}`,
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
let bundledDocument
const bundledAssets = new Map()
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
      await basicFixture?.close?.()
      basicFixture = await createBasicEditorServiceFixture()
      result = Response.json({ reset: true })
    } else if (url.pathname === '/__basic-acceptance/options')
      result = Response.json((await basicFixture.inspect()).records)
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
const config = {
  // All Basic checks now pass through the real HTTP handler, authoring service
  // and resolver. This in-memory adapter does not claim physical SQL atomicity.
  plugins: [
    {
      name: 'basic-service-acceptance',
      configureServer(server) {
        server.middlewares.use(handleBasicRequest)
        server.middlewares.use((request, response, next) => {
          const pathname = new URL(request.url, 'http://127.0.0.1').pathname
          const asset = pathname === '/' ? bundledDocument : bundledAssets.get(pathname)
          if (!asset) return next()
          response.writeHead(200, {
            'Content-Type':
              pathname === '/'
                ? 'text/html'
                : pathname.endsWith('.css')
                  ? 'text/css'
                  : 'application/javascript',
          })
          response.end(asset)
        })
      },
    },
  ],
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@/components/shell/authenticated-game-shell': resolve(fixture, 'shell.jsx'),
      ...{
        '@/server/auth/actor': resolve(fixture, 'auth-boundary.js'),
        './combat-content-authoring-server': resolve(fixture, 'authoring-boundary.js'),
        '@/server/master/combat-content-authoring-server': resolve(
          fixture,
          'authoring-boundary.js',
        ),
        'server-only': resolve(fixture, 'server-only.js'),
        '@aurevane/db': resolve(root, 'packages/db/src'),
      },
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
}
if (process.env.AV_SKILL_PARAMETER_PALETTE_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log('Production shared Master/browser fixture compiled.')
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
  process.exit(0)
}
// Reuse the exact native control/activate bodies, including tab order, hit testing,
// ancestor clipping and visible focus. This local fixture does not simulate zoom.
let nativeMasterControls
if (shellReachabilityOnly) {
  const source = await fs.readFile(resolve(web, 'e2e/master-zoom-workflows.ts'), 'utf8')
  const start = source.indexOf('  async function control(')
  const end = source.indexOf('  async function state(', start)
  assert.ok(start >= 0 && end > start, 'Native control/activate source boundaries must exist')
  const moduleSource = `import playwright from ${JSON.stringify(pathToFileURL(require.resolve('@playwright/test')).href)};
const { expect } = playwright;
export function nativeMasterControls(page, info, evidence, slug) {
${source.slice(start, end)}
return { control, activate };
}`
  const modulePath = resolve(fixture, 'native-master-controls.mjs')
  await fs.writeFile(modulePath, stripTypeScriptTypes(moduleSource))
  ;({ nativeMasterControls } = await import(pathToFileURL(modulePath).href))
  await fs.writeFile(resolve(output, 'native-controls-source.ts.txt'), moduleSource)
}
// Optional local transport: serve the same production-component fixture as a
// bundle when a constrained environment cannot finish the dev-module fanout.
// Browser deadlines and every interaction/semantic assertion remain identical.
if (process.env.AV_SKILL_PARAMETER_PALETTE_BUNDLED === '1') {
  const outDir = resolve(fixture, 'bundle')
  await build({ ...config, build: { outDir, minify: false, copyPublicDir: false } })
  bundledDocument = await fs.readFile(resolve(outDir, 'index.html'))
  for (const name of await fs.readdir(resolve(outDir, 'assets')))
    bundledAssets.set(`/assets/${name}`, await fs.readFile(resolve(outDir, 'assets', name)))
}
const server = await createServer({
  ...config,
  ...(bundledDocument ? { optimizeDeps: { noDiscovery: true, include: [] } } : {}),
})
// The SQL-backed server fixture uses Node package resolution for React cache().
// Client aliases are only for the browser bundle; inlining its CJS entry in SSR
// would fail before any production store or editor behavior runs.
const sqlFixtureServer = originalRpcAcceptance
  ? await createServer({
      ...config,
      plugins: [],
      resolve: {
        alias: Object.fromEntries(
          Object.entries(config.resolve.alias).filter(
            ([name]) => name !== 'react' && name !== 'react-dom',
          ),
        ),
      },
    })
  : undefined
{
  ;({ createBasicEditorServiceFixture } = await (sqlFixtureServer ?? server).ssrLoadModule(
    resolve(
      web,
      originalRpcAcceptance
        ? 'e2e/fixtures/basic-original-rpc-service.ts'
        : 'e2e/fixtures/basic-editor-service.ts',
    ),
  ))
  basicFixture = await createBasicEditorServiceFixture()

  await server.listen()
  if (process.env.AV_BASIC_SERVICE_PROBE_ONLY === '1') {
    const origin = server.resolvedUrls.local[0]
    const options = await fetch(`${origin}__basic-acceptance/options`)
    assert.match(options.headers.get('content-type') ?? '', /application\/json/)
    assert.equal((await options.json()).length, 5)
    const before = await (await fetch(`${origin}__basic-acceptance/inspect`)).json()
    const restored = await fetch(new URL('/api/master/combat-content', origin), {
      method: 'POST',
      body: JSON.stringify({
        operation: 'record',
        command: {
          action: 'restore',
          contentKey: 'basic.guard',
          sourceVersion: 2,
          expectedRevision: 3,
        },
      }),
    })
    assert.equal(restored.status, 400)
    assert.match((await restored.json()).error.message, /rollback is no longer available/)
    const inspection = await (await fetch(`${origin}__basic-acceptance/inspect`)).json()
    assert.deepEqual(inspection.records, before.records)
    assert.equal(inspection.oldCapturesUnchanged, true)
    console.log(
      'Actual Basic HTTP handler/service probe passed: five v3 records and retired Guard restore rejected without mutation.',
    )
    await sqlFixtureServer?.close()
    await server.close()
    await fs.rm(fixture, { recursive: true, force: true })
    process.exit(0)
  }
}
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
  'Target Method',
  'Target Elevation',
  'Line of Sight',
]
async function colors(locator) {
  return locator.evaluate((element) =>
    Object.fromEntries(
      ['label', 'magnitude', 'duration', 'timing', 'target'].flatMap((part) => {
        const value = element.querySelector(`[data-compact-effect-${part}]`)
        return value ? [[part, getComputedStyle(value).color]] : []
      }),
    ),
  )
}
const palette = {
  label: 'rgb(228, 189, 103)',
  magnitude: 'rgb(201, 167, 255)',
  duration: 'rgb(112, 215, 206)',
  timing: 'rgb(112, 215, 206)',
  target: 'rgb(255, 180, 117)',
}
const paperPalette = {
  label: 'rgb(121, 85, 28)',
  magnitude: 'rgb(78, 34, 110)',
  timing: 'rgb(23, 103, 94)',
  target: 'rgb(101, 49, 14)',
}
async function assertPaperEffects(panel) {
  for (const effect of await panel.locator('[data-compact-skill-effect]').all()) {
    assert.equal(
      await effect.evaluate((element) => getComputedStyle(element).backgroundColor),
      'rgba(0, 0, 0, 0)',
    )
  }
}
async function assertModularReport(panel, { resonance = false, expectedPalette = palette } = {}) {
  const groups = panel.locator('[data-ability-behavior]')
  assert.equal(await groups.count(), 2)
  for (const group of await groups.all())
    assert.deepEqual(await group.locator('dt').allTextContents(), fields)
  const text = await panel.innerText()
  assert.match(text, /11 AP \/ 2 MP \/ 1 HP/)
  assert.match(text, /MP \[≥ 3\] \[Self\]/)
  assert.match(text, /Move \[2\]/)
  assert.match(text, /Dmg \[13\] \[Controlled\]/)
  if (resonance) {
    assert.doesNotMatch(text, /Once per battle/)
    assert.equal(await panel.getByRole('list', { name: 'Usage limits' }).count(), 0)
  } else {
    assert.match(text, /Once per battle/)
  }
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
  for (const row of tagColors) {
    assert.equal(row.label, expectedPalette.label)
    assert.equal(row.value, expectedPalette.magnitude)
    assert.notEqual(row.label, row.value)
  }
  for (const target of await panel.locator('[data-requirement-parameter="target"]').all())
    assert.equal(
      await target.evaluate((element) => getComputedStyle(element).color),
      expectedPalette.target,
    )
  for (const amount of await panel.locator('[data-requirement-parameter="magnitude"]').all())
    assert.equal(
      await amount.evaluate((element) => getComputedStyle(element).color),
      expectedPalette.magnitude,
    )
  for (const label of await panel
    .getByRole('list', { name: 'Requirement explanations' })
    .locator('[data-effect-tag-label]')
    .all())
    assert.equal(
      await label.evaluate((element) => getComputedStyle(element).color),
      tagColors[0].label,
    )
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
    await assertModularReport(page.getByRole('region', { name, exact: true }), {
      resonance: name === 'Modular Resonance parameters',
    })
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
    await assertModularReport(panel, {
      resonance: attunement === 'resonance',
      expectedPalette: paperPalette,
    })
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
      await assertModularReport(editor, { expectedPalette: paperPalette })
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
    'MP [≥ 3] [Self]',
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
  assert.ok(
    text.includes(
      'Move to the chosen Ground within this Skill’s Move distance and Jump, independent of ordinary walking.',
    ),
    'Attached Move explains its independent allowance',
  )
  assert.ok((await basics.innerText()).includes('Cost: 21 AP per traversal point'))
  assert.ok(
    (await basics.innerText()).includes(
      'Move to the chosen Ground within your remaining Movement and Jump.',
    ),
    'Basic Move retains the ordinary walking allowance',
  )
  await basics.locator('details').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `modular-manual-basics-${viewport.width}.png`) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
}
async function assertBasicContrast(locator, minimum = 4.5) {
  const colors = await locator.evaluate((element) => {
    const color = getComputedStyle(element).color
    let surface = element
    while (surface) {
      const style = getComputedStyle(surface)
      const gradient = style.backgroundImage.includes('gradient(')
        ? [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((match) => match[0])
        : []
      if (gradient.length) return { color, backgrounds: gradient }
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent')
        return { color, backgrounds: [style.backgroundColor] }
      surface = surface.parentElement
    }
    throw new Error('No rendered background for contrast measurement')
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
  for (const background of colors.backgrounds) {
    const [light, dark] = [luminance(colors.color), luminance(background)].sort((a, b) => b - a)
    assert.ok(
      (light + 0.05) / (dark + 0.05) >= minimum,
      `Basic contrast below ${minimum}: ${JSON.stringify(colors)}`,
    )
  }
}

async function openNativeSample(scope) {
  const details = scope.locator('details:has(> summary:text-is("Native sample"))')
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click()
}
const basicEndpoint = () => `${server.resolvedUrls.local[0]}api/master/combat-content`
const inspectBasics = async (page) =>
  (await page.request.get(`${server.resolvedUrls.local[0]}__basic-acceptance/inspect`)).json()
async function basicApi(page, body) {
  const response = await page.request.post(basicEndpoint(), { data: body })
  const value = await response.json()
  assert.equal(
    response.ok(),
    true,
    `Actual Basic service ${body.operation}: ${JSON.stringify(value)}`,
  )
  return value
}
async function verifyBasicApiParity(
  page,
  before,
  definition,
  behaviorId = definition.ability.behaviors[0].id,
) {
  const validation = await basicApi(page, {
    operation: 'validate',
    contentKind: 'skill',
    definition,
  })
  assert.equal(validation.validation.valid, true)
  assert.deepEqual(validation.validation.issues, [])
  const diff = await basicApi(page, {
    operation: 'diff',
    contentKind: 'skill',
    before,
    after: definition,
  })
  assert.ok(diff.diff.changedPaths.length > 0)
  const { preview } = await basicApi(page, {
    operation: 'preview',
    contentKind: 'skill',
    definition,
    behaviorId,
  })
  assert.equal(preview.legal, true)
  assert.equal(preview.behaviorId, behaviorId)
  const group = definition.ability.behaviors.find((row) => row.id === behaviorId)
  assert.equal(
    preview.costs.actionEconomy,
    group.costs.find((row) => row.resource === 'ap')?.amount ?? 0,
  )
  assert.equal(preview.costs.mp ?? 0, group.costs.find((row) => row.resource === 'mp')?.amount ?? 0)
  assert.equal(preview.costs.hp ?? 0, group.costs.find((row) => row.resource === 'hp')?.amount ?? 0)
  return preview
}
async function basicParityReader(page, definition) {
  await page.evaluate((definition) => window.renderBasicParity(definition), definition)
  const reader = page.getByRole('region', {
    name: 'Legacy Basic reader compatibility',
    exact: true,
  })
  await reader.waitFor()
  return reader
}
async function hideBasicParity(page) {
  await page.locator('[data-basic-parity-host]').evaluateAll((hosts) =>
    hosts.forEach((host) => {
      host.style.display = 'none'
    }),
  )
}
async function commitBasic(editor, viewport) {
  await hideBasicParity(editor.page())
  const button = editor.getByRole('button', { name: 'Commit Now', exact: true })
  if (viewport.width < 720) await button.tap()
  else await button.click()
}
async function committedBasic(editor) {
  await editor.getByText('Changes committed and available to the game.', { exact: true }).waitFor()
  assert.equal(await editor.getByRole('status', { name: 'Save status' }).innerText(), 'Saved')
}
async function verifyBasicEditor(page, viewport) {
  console.log('verifyBasicEditor', viewport.width)
  await page.request.post(`${server.resolvedUrls.local[0]}__basic-acceptance/reset`)
  const initial = await inspectBasics(page)
  const guard = initial.records.find((row) => row.id === 'basic.guard')
  await basicApi(page, {
    operation: 'record',
    command: {
      action: 'save',
      contentKey: guard.id,
      expectedRevision: guard.revision,
      definition: { ...guard.current.definition, name: 'Saved Guard draft' },
    },
  })
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Game Content workspace', exact: true })
  const select = async (id) => {
    await editor.locator(`[data-content-key="${id}"]`).click()
    await editor.locator(`[data-content-key="${id}"][aria-current="true"]:not(:disabled)`).waitFor()
  }
  await assertBasicContrast(editor.locator('[data-content-key][aria-current="true"]'))
  await assertBasicContrast(await abilityField(editor, 'Name'))
  await assertBasicContrast(
    (await abilityField(editor, 'Name')).locator('..').locator('span').first(),
  )
  assert.deepEqual(
    await editor
      .locator('[data-content-key]')
      .evaluateAll((rows) => rows.map((row) => row.dataset.contentKey)),
    ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp'],
  )
  assert.equal(await page.getByLabel('Content category').inputValue(), 'basic')
  await (await abilityField(editor, 'Move cost basis')).selectOption('flat')
  await (await abilityField(editor, 'Name')).fill('Authored Move')
  await (await abilityField(editor, 'AP cost')).fill('11')
  await (await abilityField(editor, 'MP cost')).fill('2')
  await (await abilityField(editor, 'HP cost')).fill('1')
  await (await abilityField(editor, 'Move maximum tiles')).fill('3')
  await commitBasic(editor, viewport)
  await committedBasic(editor)
  const first = (await inspectBasics(page)).records.find((row) => row.id === 'basic.move').current
    .definition
  assert.equal(first.execution.costBasis, 'flat')
  assert.deepEqual(first.ability.behaviors[0].costs, [
    { resource: 'ap', amount: 11 },
    { resource: 'mp', amount: 2 },
    { resource: 'hp', amount: 1 },
  ])
  assert.equal(first.ability.behaviors[0].effects[0].payload.maximumTiles, 3)
  await verifyBasicApiParity(
    page,
    initial.records.find((row) => row.id === 'basic.move').current.definition,
    first,
  )
  // Submit a real change: unchanged production commits intentionally do not advance CAS.
  await (await abilityField(editor, 'Name')).fill('Earlier submitted Move')
  // Delay the actual accepted HTTP response, retaining a newer local edit and the new CAS revision.
  let release, accepted
  const held = new Promise((resolve) => {
    accepted = resolve
  })
  await page.route('**/api/master/combat-content', async (route) => {
    const body = route.request().postDataJSON()
    if (body.operation !== 'record' || body.command.action !== 'commit') return route.continue()
    const response = await route.fetch()
    accepted()
    await new Promise((resolve) => {
      release = resolve
    })
    await route.fulfill({ response })
  })
  await commitBasic(editor, viewport)
  await held
  await (await abilityField(editor, 'Name')).fill('Newer unsaved Move')
  release()
  await editor.getByText('Saved; newer local edits remain uncommitted.', { exact: true }).waitFor()
  assert.equal(await (await abilityField(editor, 'Name')).inputValue(), 'Newer unsaved Move')
  await page.unroute('**/api/master/combat-content')
  await commitBasic(editor, viewport)
  await committedBasic(editor)
  await (await abilityField(editor, 'AP cost')).scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `basic-editor-move-${viewport.width}.png`) })
  await select('unarmed.basic')
  await (await abilityField(editor, 'AP cost')).fill('0')
  await commitBasic(editor, viewport)
  const invalid = editor.getByRole('alert')
  await invalid.waitFor()
  assert.match(await invalid.innerText(), /Basic Attack requires a positive authored AP cost/)
  assert.equal(await (await abilityField(editor, 'AP cost')).inputValue(), '0')
  assert.equal(
    (await inspectBasics(page)).records.find((row) => row.id === 'unarmed.basic').current
      .contentVersion,
    3,
  )
  await (await abilityField(editor, 'AP cost')).fill('17')
  await (await abilityField(editor, 'Higher Power scaling (%)')).fill('42.25')
  await commitBasic(editor, viewport)
  await committedBasic(editor)
  assert.equal(
    (await inspectBasics(page)).records.find((row) => row.id === 'unarmed.basic').current.definition
      .execution.scalingBasisPoints,
    4225,
  )
  await (await abilityField(editor, 'Higher Power scaling (%)')).scrollIntoViewIfNeeded()
  await page.screenshot({ path: resolve(output, `basic-editor-attack-${viewport.width}.png`) })
  for (const [index, id] of ['basic.guard', 'basic.recover', 'basic.recover.mp'].entries()) {
    await select(id)
    if (id === 'basic.guard')
      assert.equal(await (await abilityField(editor, 'Name')).inputValue(), 'Saved Guard draft')
    await (await abilityField(editor, 'Name')).fill(`Edited ${id}`)
    await (await abilityField(editor, 'AP cost')).fill(String(9 + index))
    await (await abilityField(editor, 'Recovery rounding')).selectOption('floor')
    if (id !== 'basic.guard')
      await (await abilityField(editor, 'Recovery percent')).fill(String(21 + index))
    await commitBasic(editor, viewport)
    await committedBasic(editor)
  }
  await select('basic.move')
  assert.equal(await (await abilityField(editor, 'Name')).inputValue(), 'Newer unsaved Move')
  const inspection = await inspectBasics(page)
  const commits = inspection.requests.filter(
    (row) => row.operation === 'record' && row.command.action === 'commit',
  )
  assert.deepEqual(
    commits
      .filter((row) => row.command.contentKey === 'basic.move')
      .map((row) => row.command.expectedRevision),
    [3, 4, 5],
  )
  assert.equal(
    commits.find((row) => row.command.contentKey === 'basic.guard').command.expectedRevision,
    4,
  )
  assert.ok(
    commits.every(
      (row) =>
        !Object.hasOwn(row.command, 'baseVersion') &&
        Number.isSafeInteger(row.command.definition.contentVersion),
    ),
  )
  assert.equal(inspection.oldCapturesUnchanged, true)
  await select('basic.recover.mp')
  const definition = inspection.records.find((row) => row.id === 'basic.recover.mp').current
    .definition
  const reader = await basicParityReader(page, definition)
  await reader.scrollIntoViewIfNeeded()
  await assertBasicContrast(reader.locator('[data-compact-effect-label]').first())
  for (const trigger of await reader.locator('button[data-combat-tag-reference-trigger]').all())
    await assertBasicContrast(trigger)
  await assertBasicContrast(editor.getByRole('button', { name: 'Commit Now', exact: true }))
  await page.screenshot({ path: resolve(output, `basic-editor-recovery-${viewport.width}.png`) })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  assert.equal(await editor.getByRole('alert').count(), 0)
}
async function verifyBasicHeldRevert(page, viewport) {
  console.log('verifyBasicHeldRevert', viewport.width)
  await page.request.post(`${server.resolvedUrls.local[0]}__basic-acceptance/reset`)
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Game Content workspace', exact: true })
  const name = await abilityField(editor, 'Name')
  const originalName = await name.inputValue()
  const before = (await inspectBasics(page)).records.find((row) => row.id === 'basic.move')
  await name.fill('Earlier changed value committing')
  let accepted, release
  const held = new Promise((resolve) => {
    accepted = resolve
  })
  await page.route('**/api/master/combat-content', async (route) => {
    const body = route.request().postDataJSON()
    if (body.operation !== 'record' || body.command.action !== 'commit') return route.continue()
    const response = await route.fetch()
    accepted()
    await new Promise((resolve) => {
      release = resolve
    })
    await route.fulfill({ response })
  })
  await commitBasic(editor, viewport)
  await held
  await name.fill(originalName)
  release()
  await editor.getByText('Saved; newer local edits remain uncommitted.', { exact: true }).waitFor()
  assert.equal(await name.inputValue(), originalName)
  assert.equal(
    await editor.getByRole('status', { name: 'Save status' }).innerText(),
    'Unsaved changes',
  )
  const submitted = (await inspectBasics(page)).records.find((row) => row.id === 'basic.move')
  assert.equal(submitted.current.definition.name, 'Earlier changed value committing')
  assert.equal(submitted.current.contentVersion, 4)
  await page.unroute('**/api/master/combat-content')
  await commitBasic(editor, viewport)
  await committedBasic(editor)
  const after = await inspectBasics(page)
  const current = after.records.find((row) => row.id === 'basic.move')
  assert.deepEqual(current.current.definition, { ...before.current.definition, contentVersion: 5 })
  assert.deepEqual(
    current.history.filter((row) => row.contentVersion < 4),
    before.history,
  )
  assert.deepEqual(
    after.requests
      .filter((row) => row.operation === 'record' && row.command.action === 'commit')
      .map((row) => row.command.expectedRevision),
    [3, 4],
  )
  assert.equal(after.oldCapturesUnchanged, true)
  const freshOptions = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/__basic-acceptance/options',
  )
  await page.reload({ waitUntil: 'networkidle' })
  const reloaded = await (await freshOptions).json()
  assert.equal(
    reloaded.find((row) => (row.id ?? row.contentKey) === 'basic.move').current.contentVersion,
    5,
  )
  await editor.waitFor()
  assert.equal(await name.inputValue(), originalName)
  assert.equal(await editor.getByRole('status', { name: 'Save status' }).innerText(), 'Saved')
  assert.deepEqual(
    (await inspectBasics(page)).records.find((row) => row.id === 'basic.move').current,
    current.current,
  )
  await page.screenshot({ path: resolve(output, `basic-held-revert-${viewport.width}.png`) })
}

async function verifyBasicPublication(page, viewport) {
  console.log('verifyBasicPublication', viewport.width)
  await page.request.post(`${server.resolvedUrls.local[0]}__basic-acceptance/reset`)
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Game Content workspace', exact: true })
  const ids = ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp']
  const published = []
  for (const id of ids) {
    await editor.locator(`[data-content-key="${id}"]`).click()
    await editor.locator(`[data-content-key="${id}"][aria-current="true"]:not(:disabled)`).waitFor()
    const before = (await inspectBasics(page)).records.find((row) => row.id === id)
    await (await abilityField(editor, 'Name')).fill(`Publish ${id}`)
    if (id === 'basic.move')
      await (await abilityField(editor, 'Move cost basis')).selectOption('flat')
    await (await abilityField(editor, 'AP cost')).fill('11')
    await (await abilityField(editor, 'MP cost')).fill('2')
    await (await abilityField(editor, 'HP cost')).fill('1')
    let groupId = 'use'
    if (id === 'basic.guard') {
      await activateAbilitySection(editor, 'Details & Text')
      await editor.getByRole('button', { name: 'Add behavior group', exact: true }).click()
      const group = editor.locator('[data-ability-group="group-1"]')
      await (await abilityField(group, 'AP cost')).fill('17')
      await (await abilityField(group, 'MP cost')).fill('3')
      await (await abilityField(group, 'HP cost')).fill('2')
      groupId = 'group-1'
    }
    if (id === 'basic.recover.mp') {
      await page.route('**/api/master/combat-content', (route) => {
        const body = route.request().postDataJSON()
        if (body.operation === 'record' && body.command.action === 'commit')
          return route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: 'STALE_VERSION',
                message: 'Combat content changed. Refresh and retry.',
              },
            }),
          })
        return route.continue()
      })
      await commitBasic(editor, viewport)
      await editor.getByRole('alert').waitFor()
      assert.match(await editor.getByRole('alert').innerText(), /Combat content changed/)
      assert.equal(await (await abilityField(editor, 'Name')).inputValue(), `Publish ${id}`)
      assert.deepEqual(
        (await inspectBasics(page)).records.find((row) => row.id === id),
        before,
      )
      await page.unroute('**/api/master/combat-content')
    }
    await commitBasic(editor, viewport)
    await committedBasic(editor)
    const current = (await inspectBasics(page)).records.find((row) => row.id === id)
    assert.equal(current.current.contentVersion, 4)
    assert.equal(current.current.definition.name, `Publish ${id}`)
    published.push(id)
    const countBeforeReview = current.history.length
    const actualPreview = await verifyBasicApiParity(
      page,
      before.current.definition,
      current.current.definition,
      groupId,
    )
    if (id === 'basic.move') assert.equal(actualPreview.movement.path.length - 1, 1)
    const reader = await basicParityReader(page, current.current.definition)
    await openNativeSample(reader)
    if (groupId !== 'use')
      await reader.getByLabel('Preview action group', { exact: true }).selectOption(groupId)
    await reader.getByRole('button', { name: 'Run native sample', exact: true }).click()
    const preview = reader.getByRole('region', { name: 'Deterministic preview', exact: true })
    await preview.waitFor()
    assert.match(await preview.innerText(), new RegExp(groupId))
    assert.match(
      await preview.innerText(),
      id === 'basic.guard' ? /17 AP[\s\S]*3 MP[\s\S]*2 HP/ : /11 AP[\s\S]*2 MP[\s\S]*1 HP/,
    )
    if (id === 'basic.move') assert.match(await preview.innerText(), /1 tile/)
    assert.equal(
      (await inspectBasics(page)).records.find((row) => row.id === id).history.length,
      countBeforeReview,
      'Validation, diff and native sample never publish another version',
    )
    await hideBasicParity(page)
    await assertCurrentOnlyEditor(editor)
    const visible = await basicApi(page, {
      operation: 'record',
      command: { action: 'read', contentKey: id },
    })
    assert.deepEqual(visible.record.history, [])
    assert.equal(Object.hasOwn(visible.record, 'builtinRestoreVersion'), false)
    assert.deepEqual(visible.record.current, current.current)
  }
  assert.deepEqual(published, ids)
  const result = await inspectBasics(page)
  assert.equal(
    result.records.find((row) => row.id === 'basic.guard').current.definition.ability.behaviors
      .length,
    2,
  )
  assert.equal(
    result.records.find((row) => row.id === 'basic.move').current.definition.name,
    'Publish basic.move',
  )
  assert.ok(
    result.requests
      .filter((row) => row.operation === 'record' && row.command.action === 'commit')
      .every(
        (row) => row.command.expectedRevision === 3 && Object.hasOwn(row.command, 'definition'),
      ),
  )
  assert.equal(result.oldCapturesUnchanged, true)
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
  await openNativeSample(page)
  const runPreview = () =>
    gesture(page.getByRole('button', { name: 'Run native sample', exact: true }))
  assert.equal(await selector.inputValue(), 'brace')
  const selectorBounds = await selector.boundingBox()
  assert.ok(
    selectorBounds && selectorBounds.width >= 200,
    'The actual preview group selector needs readable space',
  )
  await runPreview()
  await preview.waitFor()
  assert.match(await preview.innerText(), /brace[\s\S]*5 AP[\s\S]*barrier-change/)
  await selector.selectOption('recover')
  assert.equal(await preview.count(), 0)
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
  await (
    await abilityField(page.locator('[data-ability-group="recover"]'), 'Healing amount')
  ).fill('18')
  assert.equal(await preview.count(), 0)
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
  await selector.selectOption('brace')
  assert.equal(await preview.count(), 0)
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
  await (await abilityField(page.locator('[data-ability-group="recover"]'), 'AP cost')).fill('14')
  await page.evaluate(() => {
    window.releaseGroupPreview()
    window.holdGroupPreview = false
  })
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Preview action group"]').disabled,
  )
  assert.equal(await preview.count(), 0, 'An older response cannot review the newer draft')
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
  assert.equal(await leap.getByLabel('Fixed hit chance (%)', { exact: true }).count(), 0)
  const accuracy = leap.getByLabel('Accuracy rule', { exact: true })
  assert.equal(await accuracy.inputValue(), 'fixed')
  assert.equal(
    await page.evaluate(
      () => window.inspectEditedAbility().definition.behaviors[0].accuracy.chanceBasisPoints,
    ),
    7777,
  )
  await accuracy.selectOption('standard')
  assert.equal(
    await page.evaluate(() => window.inspectEditedAbility().definition.behaviors[0].accuracy),
    undefined,
  )
  await accuracy.selectOption('always')
  await leap.getByLabel('Cooldown (owner turns; 0 means none)', { exact: true }).fill('2')
  await leap
    .getByRole('group', { name: 'Requirements', exact: true })
    .getByLabel('Resource threshold', { exact: true })
    .fill('4')
  const walk = leap.locator('[data-ability-effect="walk"]')
  await openEffectParameters(walk)
  await walk.getByLabel('Move maximum tiles', { exact: true }).fill('3')
  const hit = leap.locator('[data-ability-effect="hit"]')
  await openEffectParameters(hit)
  await hit.getByLabel('Damage amount', { exact: true }).fill('17')
  assert.equal(await hit.getByLabel('Effect timing', { exact: true }).count(), 0)
  await leap.getByLabel('New group effect', { exact: true }).selectOption('pierce')
  await gesture(leap.getByRole('button', { name: 'Add group effect', exact: true }))
  const pierce = leap.locator('[data-ability-effect="effect-1"]')
  await openEffectParameters(pierce)
  await pierce.getByLabel('Equipment Armor ignored (%)', { exact: true }).fill('33.33')
  await pierce.getByLabel('Damage amount', { exact: true }).fill('5')
  assert.equal(await pierce.getByLabel('Piercing', { exact: true }).count(), 0)
  assert.equal(await pierce.getByLabel('Vengeance enabled', { exact: true }).count(), 0)
  await gesture(walk.getByRole('button', { name: '↓ Down', exact: true }))
  assert.ok((await editor.getByRole('status').innerText()).includes('Move must occur once, first'))
  assert.equal(await walk.getByLabel('Effect description', { exact: true }).count(), 0)
  assert.equal(
    await page.evaluate(() => {
      try {
        window.inspectEditedAbility()
        return false
      } catch (error) {
        return error.message.includes('Move must occur once, first')
      }
    }),
    true,
    'The engine must reject the deliberately invalid Move ordering',
  )
  await gesture(walk.getByRole('button', { name: '↑ Up', exact: true }))
  assert.ok(
    (await page.evaluate(() => window.inspectEditedAbility().notes)).includes(
      'Walk <once> & return',
    ),
  )
  const maintained = editor.locator('[data-ability-group="maintain"]')
  await openEffectParameters(maintained)
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
  assert.equal(group.accuracy.chanceBasisPoints, 10000)
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
async function verifyAttunementPointer(page, viewport) {
  for (const family of ['resonance', 'essence']) {
    await page.mouse.move(0, 0)
    await page.goto(`${server.resolvedUrls.local[0]}?surface=nexus&attunement=${family}`, {
      waitUntil: 'networkidle',
    })
    const name = await page.evaluate((kind) => window.paletteDefinitions[kind].name, family)
    const trigger = page.getByRole('button', {
      name: `Preview ${family === 'resonance' ? 'Resonance' : 'Essence'}: ${name}`,
      exact: true,
    })
    const artworkBefore = await trigger.locator('img').boundingBox()
    assert.equal(
      await page.getByRole('dialog').count(),
      0,
      'A neutral pointer must not inherit an open reader',
    )
    const panel = page.getByRole('dialog', { name, exact: true })
    if (viewport.width >= 720) {
      await trigger.hover()
      await panel.waitFor()
      const geometry = await trigger.evaluate((element) => {
        const anchor = element.getBoundingClientRect()
        const panel = document.querySelector('[data-battle-info-panel]')
        const center = { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 }
        const hit = document.elementFromPoint(center.x, center.y)
        return {
          anchor: anchor.toJSON(),
          panel: panel?.getBoundingClientRect().toJSON(),
          expanded: element.getAttribute('aria-expanded'),
          center,
          hit: hit?.tagName,
          hitTrigger: hit === element || element.contains(hit),
          hitReader: !!hit?.closest('[data-battle-info-panel]'),
          scrollY,
        }
      })
      await fs.writeFile(
        resolve(output, `attunement-pointer-${family}-${viewport.width}.json`),
        JSON.stringify(geometry, null, 2),
      )
      await page.screenshot({
        path: resolve(output, `attunement-hover-${family}-${viewport.width}.png`),
      })
      assert.equal(
        geometry.hitTrigger,
        true,
        'A hover-open report must leave its trigger clickable',
      )
      await trigger.click()
    } else await trigger.tap()
    await panel.waitFor()
    assert.equal(await page.getByRole('dialog').count(), 1)
    assert.equal(await panel.evaluate((element) => element === document.activeElement), true)
    assert.deepEqual((await panel.locator('dt').allTextContents()).slice(0, 9), fields)
    const artworkAfter = await trigger.locator('img').boundingBox()
    assert.equal(artworkAfter.width, artworkBefore.width)
    assert.equal(artworkAfter.height, artworkBefore.height)
    const box = await panel.boundingBox()
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1)
    await page.keyboard.press('Escape')
    await panel.waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
    await page.keyboard.press('Enter')
    await panel.waitFor()
    assert.equal(await panel.evaluate((element) => element === document.activeElement), true)
    await page.keyboard.press('Escape')
    await panel.waitFor({ state: 'detached' })
    assert.equal(await trigger.evaluate((element) => element === document.activeElement), true)
  }
}

async function assertCurrentOnlyEditor(editor) {
  for (const name of [
    'History',
    'Text',
    'Parameters',
    'Rollback',
    'Restore Previous',
    'Restore System original',
  ])
    assert.equal(await editor.getByRole('button', { name, exact: true }).count(), 0)
  assert.equal(
    await editor.getByRole('region', { name: 'Content history', exact: true }).count(),
    0,
  )
  assert.equal(
    await editor
      .getByRole('button', { name: 'Skill Details', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  )
}
async function rejectRetiredBasicRestoration(page, editor, id, sourceVersion) {
  await assertCurrentOnlyEditor(editor)
  const snapshot = await inspectBasics(page)
  const before = snapshot.records.find((row) => (row.id ?? row.contentKey) === id)
  for (const data of [
    { operation: 'rollback', skillId: id, targetVersion: sourceVersion },
    { operation: 'restore-basic-draft', skillId: id },
    {
      operation: 'record',
      command: {
        action: 'restore',
        contentKey: id,
        expectedRevision: before.revision,
        sourceVersion,
      },
    },
    {
      operation: 'record',
      command: {
        action: 'restore',
        contentKey: id,
        expectedRevision: before.revision,
        sourceVersion: 1,
        sourceKind: 'builtin',
      },
    },
  ]) {
    const response = await page.request.post(basicEndpoint(), { data })
    assert.equal(response.status(), 400)
    const body = await response.json()
    assert.equal(body.error.code, 'INVALID_REQUEST')
    assert.match(body.error.message, /rollback is no longer available/)
    const after = await inspectBasics(page)
    assert.deepEqual(
      after.records,
      snapshot.records,
      'Retired HTTP operations must not change drafts, publications, revisions or retained versions',
    )
    if (snapshot.physicalVersions)
      assert.deepEqual(after.physicalVersions, snapshot.physicalVersions)
    if (Object.hasOwn(snapshot, 'oldCapturesUnchanged'))
      assert.equal(after.oldCapturesUnchanged, true)
  }
  const visible = await basicApi(page, {
    operation: 'record',
    command: { action: 'read', contentKey: id },
  })
  assert.deepEqual(visible.record.history, [])
  assert.equal(Object.hasOwn(visible.record, 'builtinRestoreVersion'), false)
  assert.deepEqual(visible.record.current, before.current)
}

async function verifyOriginalRpcAuthoring(page, viewport) {
  console.log('verifyOriginalRpcAuthoring', viewport.width)
  await page.request.post(`${server.resolvedUrls.local[0]}__basic-acceptance/reset`)
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Game Content workspace', exact: true })
  const originals = (await inspectBasics(page)).originals
  const activate = async (label) => {
    const control = editor.getByRole('button', { name: label, exact: true })
    if (viewport.width < 720) await control.tap()
    else {
      await control.focus()
      await page.keyboard.press('Enter')
    }
  }
  for (const original of originals) {
    await editor.locator(`[data-content-key="${original.id}"]`).click()
    await editor
      .locator(`[data-content-key="${original.id}"][aria-current="true"]:not(:disabled)`)
      .waitFor()
    const requestsBefore = (await inspectBasics(page)).requests.length
    await editor
      .getByLabel('Name', { exact: true })
      .fill(`${original.name} current authoring regression`)
    await activate('Commit Now')
    await committedBasic(editor)
    const edited = await inspectBasics(page)
    const prior = edited.records.find((row) => row.contentKey === original.id)
    await rejectRetiredBasicRestoration(page, editor, original.id, 1)
    // Enter the explicit canonical name as a new authored edit. No restore command
    // or borrowed authorship is involved in choosing these fixture settings.
    await (await abilityField(editor, 'Name')).fill(original.name)
    await verifyBasicApiParity(page, prior.current.definition, original)
    await activate('Commit Now')
    await committedBasic(editor)
    const result = await inspectBasics(page)
    const current = result.records.find((row) => row.contentKey === original.id)
    assert.deepEqual(current.current.definition, { ...original, contentVersion: 3 })
    assert.equal(current.current.authoredBy, current.current.publishedBy)
    assert.ok(current.current.authoredAt)
    assert.equal(current.current.restoredFrom, null)
    assert.equal(current.current.restoredBy, null)
    assert.equal(current.current.restoredSource ?? null, null)
    assert.deepEqual(
      current.history.filter((row) => row.contentVersion !== 3),
      prior.history,
    )
    for (const row of edited.physicalVersions)
      assert.ok(
        result.physicalVersions.some((after) => JSON.stringify(after) === JSON.stringify(row)),
        'Prior physical versions and attribution must remain unchanged',
      )
    const actions = result.requests
      .slice(requestsBefore)
      .filter((row) => row.operation === 'record')
      .map((row) => row.command.action)
    assert.equal(actions.filter((action) => action === 'commit').length, 2)
    assert.equal(actions.filter((action) => action === 'restore').length, 2)
    await page.screenshot({
      path: resolve(output, `original-rpc-authored-${original.id}-${viewport.width}.png`),
      fullPage: true,
    })
  }
  await fs.writeFile(
    resolve(output, `original-rpc-${viewport.width}.json`),
    JSON.stringify(await inspectBasics(page), null, 2),
  )
}
async function verifyBasicServiceAuthoring(page, viewport) {
  console.log('verifyBasicServiceAuthoring', viewport.width)
  await page.request.post(`${server.resolvedUrls.local[0]}__basic-acceptance/reset`)
  await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`, {
    waitUntil: 'networkidle',
  })
  const editor = page.getByRole('region', { name: 'Game Content workspace', exact: true })
  await editor.waitFor({ state: 'visible' })
  const activate = async (locator) => {
    if (viewport.width < 720) await locator.tap()
    else {
      await locator.focus()
      await page.keyboard.press('Enter')
    }
  }
  const ids = ['basic.move', 'unarmed.basic', 'basic.guard', 'basic.recover', 'basic.recover.mp']
  assert.deepEqual(
    await editor
      .locator('[data-content-key]')
      .evaluateAll((rows) => rows.map((row) => row.dataset.contentKey)),
    ids,
  )
  for (const id of ids) {
    await editor.locator(`[data-content-key="${id}"]`).click()
    await editor.locator(`[data-content-key="${id}"][aria-current="true"]:not(:disabled)`).waitFor()
    const before = (await inspectBasics(page)).records.find((row) => row.id === id)
    const chosen = before.history.find((row) => row.contentVersion === 2).definition
    await rejectRetiredBasicRestoration(page, editor, id, 2)
    assert.equal(
      await (await abilityField(editor, 'Name')).inputValue(),
      before.current.definition.name,
    )
    // Ordinary current-setting authoring chooses explicit fixture values. The
    // historical definition is a test oracle, not an exposed restoration feature.
    await (await abilityField(editor, 'Name')).fill(chosen.name)
    await (
      await abilityField(editor, 'AP cost')
    ).fill(
      String(chosen.ability.behaviors[0].costs.find((row) => row.resource === 'ap')?.amount ?? 0),
    )
    const actualPreview = await verifyBasicApiParity(page, before.current.definition, chosen)
    const reader = await basicParityReader(page, chosen)
    await openNativeSample(reader)
    await activate(reader.getByRole('button', { name: 'Run native sample', exact: true }))
    const preview = reader.getByRole('region', { name: 'Deterministic preview', exact: true })
    await preview.waitFor()
    assert.match(await preview.innerText(), new RegExp(`${actualPreview.costs.actionEconomy} AP`))
    await commitBasic(editor, viewport)
    await committedBasic(editor)
    const after = await inspectBasics(page)
    const current = after.records.find((row) => row.id === id)
    assert.deepEqual(current.current.definition, { ...chosen, contentVersion: 4 })
    assert.deepEqual(
      current.history.filter((row) => row.contentVersion !== 4),
      before.history,
    )
    assert.equal(current.history.length, 3)
    assert.equal(current.current.authoredBy, current.current.publishedBy)
    assert.ok(current.current.authoredAt)
    assert.notEqual(
      current.current.authoredAt,
      before.history.find((row) => row.contentVersion === 2).authoredAt,
    )
    assert.equal(current.current.restoredFrom, null)
    assert.equal(current.current.restoredBy, null)
    assert.equal(current.current.restoredSource ?? null, null)
    assert.equal(after.oldCapturesUnchanged, true)
    assert.deepEqual(after.oldVersions, [3, 3, 3])
    assert.deepEqual(
      after.currentDefinitions.find((row) => row.id === id),
      current.current.definition,
    )
    await assertCurrentOnlyEditor(editor)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    await page.screenshot({
      path: resolve(output, `basic-service-authored-${id}-${viewport.width}.png`),
    })
  }
  const result = await inspectBasics(page)
  assert.equal(
    result.requests.filter((row) => row.operation === 'record' && row.command.action === 'restore')
      .length,
    10,
    'Each Basic explicitly rejects both previous and builtin restoration',
  )
  assert.equal(result.requests.filter((row) => row.operation === 'rollback').length, 5)
  assert.equal(result.requests.filter((row) => row.operation === 'restore-basic-draft').length, 5)
  assert.equal(
    result.requests.filter((row) => row.operation === 'record' && row.command.action === 'commit')
      .length,
    5,
  )
  for (const operation of ['validate', 'diff', 'preview'])
    assert.ok(result.requests.filter((row) => row.operation === operation).length >= 5)
  await fs.writeFile(
    resolve(output, `basic-service-${viewport.width}.json`),
    JSON.stringify(result, null, 2),
  )
}

try {
  for (const viewport of [
    ...(shellReachabilityOnly
      ? [
          { width: 683, height: 340 },
          { width: 683, height: 384 },
          { width: 720, height: 450 },
          { width: 390, height: 422 },
          { width: 320, height: 370 },
          { width: 1440, height: 900 },
        ]
      : []),
    { width: 1366, height: 768 },
    ...(basicServiceAcceptance && !editorIdentityOnly && !shellReachabilityOnly
      ? [
          { width: 1440, height: 900 },
          { width: 720, height: 450 },
        ]
      : []),
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport,
      hasTouch: shellReachabilityOnly ? viewport.width === 390 : viewport.width < 720,
      ...(attunementPointerOnly && viewport.width < 720 ? { isMobile: true } : {}),
    })
    const errors = []
    const pendingRequests = new Set()
    page.pendingPaletteRequests = pendingRequests
    page.on('request', (request) => pendingRequests.add(request.url()))
    page.on('requestfinished', (request) => pendingRequests.delete(request.url()))
    page.on('requestfailed', (request) => pendingRequests.delete(request.url()))
    page.on('pageerror', (error) => {
      errors.push(error.message)
      browserErrors.push(error.message)
    })
    if (heldRevertOnly) {
      await verifyBasicHeldRevert(page, viewport)
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        status: 'passed',
        scope:
          'Actual held HTTP commit preserves a local revert, authoritative CAS, immutable captures and reload',
      })
      await page.close()
      continue
    }
    if (attunementPointerOnly) {
      await verifyAttunementPointer(page, viewport)
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        status: 'passed',
        families: 2,
        input: viewport.width < 720 ? 'touch tap and keyboard' : 'mouse hover/click and keyboard',
        scope: 'Real neutral-pointer attunement lifecycle; full reader, geometry and focus checks',
      })
      await page.close()
      continue
    }
    if (shellReachabilityOnly) {
      await page.goto(
        `${server.resolvedUrls.local[0]}?surface=basic-editor&shell=true&basicService=1`,
      )
      await page.getByRole('navigation', { name: 'Master Panel navigation' }).waitFor()
      await page.getByLabel('Content category', { exact: true }).selectOption('basic')
      await page.getByLabel('Search content', { exact: true }).fill('no-matching-zoom-content')
      const nativeEvidence = []
      const native = nativeMasterControls(
        page,
        {
          outputPath: (name) =>
            resolve(output, `local-${viewport.width}-${viewport.height}-${name}`),
          attach: async (name, { body }) =>
            fs.writeFile(
              resolve(output, `local-${viewport.width}-${viewport.height}-${name}`),
              body,
            ),
        },
        nativeEvidence,
        'combat-content',
      )
      const targets = [
        page.getByRole('button', { name: 'Search', exact: true }),
        page.getByLabel('Name', { exact: true }),
        page.getByRole('button', { name: 'Skill Details', exact: true }),
      ]
      for (const [index, target] of targets.entries()) {
        if (index === 1) await page.locator('[data-content-key="unarmed.basic"]').click()
        if (index === 1) {
          await target.fill(await target.inputValue())
          await native.control(target, 'name')
        } else await native.activate(target, index === 0 ? 'search-empty' : 'details')
        await fs.writeFile(
          resolve(output, `native-controls-${viewport.width}-${viewport.height}.json`),
          JSON.stringify(nativeEvidence, null, 2),
        )
        const measured = await target.evaluate((element) => {
          const rect = element.getBoundingClientRect(),
            dock = document.querySelector('[data-av-game-rail]'),
            dockRect = dock.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          return {
            target: element.tagName,
            text: element.textContent,
            rect: rect.toJSON(),
            dock: dockRect.toJSON(),
            hit: hit?.tagName,
            hitDock: !!hit?.closest('[data-av-game-rail]'),
            unobscured: hit === element || element.contains(hit),
            width: innerWidth,
            height: innerHeight,
            rootScrollWidth: document.documentElement.scrollWidth,
            cssZoom: getComputedStyle(document.documentElement).zoom,
            focusVisible: element.matches(':focus-visible'),
          }
        })
        evidence.push({ viewport, index, ...measured })
        await fs.writeFile(
          resolve(output, 'master-shell-reachability.json'),
          JSON.stringify(evidence, null, 2),
        )
        await page.screenshot({
          path: resolve(output, `master-shell-${viewport.width}-${viewport.height}-${index}.png`),
        })
        if (viewport.width <= 760)
          assert.ok(
            measured.rect.bottom <= measured.dock.top,
            'The complete Master control must remain above the persistent dock',
          )
        assert.equal(
          measured.unobscured,
          true,
          `Actual Master control ${index} must clear the persistent dock`,
        )
        assert.equal(measured.cssZoom, '1')
        assert.ok(
          measured.rect.left >= -1 &&
            measured.rect.right <= measured.width + 1 &&
            measured.rect.top >= -1 &&
            measured.rect.bottom <= measured.height + 1,
        )
        assert.ok(measured.rootScrollWidth <= measured.width + 1)
      }
      assert.deepEqual(errors, [])
      await page.close()
      continue
    }
    if (editorIdentityOnly) {
      await page.goto(`${server.resolvedUrls.local[0]}?surface=basic-editor&basicService=1`)
      const editor = page.getByRole('region', { name: 'Game Content workspace', exact: true })
      await editor.locator('[data-content-key="unarmed.basic"]').click()
      await editor.locator('[data-content-key="unarmed.basic"][aria-current="true"]').waitFor()
      const initialName = await editor
        .getByRole('textbox', { name: 'Name', exact: true })
        .inputValue()
      for (const name of [initialName, 'Gash', 'Flame Burst']) {
        await editor.getByRole('textbox', { name: 'Name', exact: true }).fill(name)
        const heading = editor.getByRole('heading', { name, level: 2, exact: true })
        await heading.waitFor()
        const definition = (await inspectBasics(page)).records.find(
          (row) => row.id === 'unarmed.basic',
        ).current.definition
        const reader = await basicParityReader(page, { ...definition, name })
        await openNativeSample(reader)
        await reader.getByRole('button', { name: 'Run native sample', exact: true }).click()
        const chronicle = reader
          .getByTestId('battle-log-feed')
          .getByRole('heading', { name, level: 4, exact: true })
        await chronicle.waitFor()
        assert.equal(
          await page.getByRole('heading', { name, exact: true }).count(),
          2,
          'Legacy broad identity is ambiguous with the real sample Chronicle',
        )
        assert.equal(await editor.getByRole('heading', { name, level: 2, exact: true }).count(), 1)
        assert.equal(await chronicle.isVisible(), true)
        await page.screenshot({
          path: resolve(
            output,
            `editor-identity-${viewport.width}-${name.toLowerCase().replaceAll(' ', '-')}.png`,
          ),
          fullPage: true,
        })
        evidence.push({
          viewport,
          name,
          legacyHeadingCount: 2,
          selectedEditorHeadingCount: 1,
          chronicleVisible: true,
        })
        await hideBasicParity(page)
      }
      assert.deepEqual(errors, [])
      await page.close()
      continue
    }
    if (basicServiceAcceptance) {
      if (originalRpcAcceptance) await verifyOriginalRpcAuthoring(page, viewport)
      else {
        await verifyBasicServiceAuthoring(page, viewport)
        await verifyBasicHeldRevert(page, viewport)
      }
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        status: 'passed',
        basics: 5,
        browser: browser.version(),
        transport: originalRpcAcceptance
          ? 'actual handler/service/RPC store/production migration SQL'
          : 'actual local handler/service/repository/preview/publication',
        input: viewport.width < 720 ? 'touch' : 'keyboard',
        scope: originalRpcAcceptance
          ? 'Production editor and exact SQL-backed mutation responses with a controlled local Owner identity and PGlite transport; no hosted authentication, physical contention or browser zoom claim.'
          : 'Production editor with controlled fixture actor and in-memory persistence; no hosted identity, physical browser zoom or human gameplay claim.',
      })
      await page.close()
      continue
    }
    await verifyModularReaders(page, viewport)
    await verifyModularManual(page, viewport)
    await verifyCanonicalEditor(page, viewport)
    await verifyBasicEditor(page, viewport)
    await verifyBasicHeldRevert(page, viewport)
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
    await authoring.getByLabel('New effect type').selectOption('status:blindside')
    await authoring.getByRole('button', { name: 'Add effect', exact: true }).click()
    assert.deepEqual(await page.evaluate(() => window.blindsideAuthoringEffects[1]), {
      type: 'apply-status',
      recipient: 'actor',
      statusId: 'blindside',
      stacks: 1,
      durationTurns: 1,
    })
    const addedEffect = authoring.locator('[data-effect-type="apply-status"]').nth(1)
    await openEffectParameters(addedEffect)
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
    await openEffectParameters(firstEffect)
    await firstEffect.getByLabel('Status ID', { exact: true }).fill('blindside')
    const converted = await page.evaluate(() => window.blindsideAuthoringEffects[0])
    assert.equal(converted.durationTurns, 1)
    assert.equal(converted.potencyBasisPoints, undefined)
    assert.equal(
      await firstEffect.getByLabel('Effect duration (turns)', { exact: true }).count(),
      0,
    )
    assert.ok((await firstEffect.textContent()).includes('affected character’s turn'))
    await authoring.screenshot({
      path: resolve(output, `blindside-authoring-${viewport.width}.png`),
    })
    for (const family of ['physical', 'mystic'])
      for (const surface of ['Nexus', 'Master', 'Battle']) {
        const report = page.getByRole('region', {
          name: `${surface} ${family} ${surface === 'Master' ? 'details' : 'parameters'}`,
        })
        const labels = await report.locator('dt').allTextContents()
        assert.deepEqual(labels.slice(0, 9), fields)
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
        'Target Method',
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
      target: palette.target,
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
      if (viewport.width < 720) await trigger.tap()
      else await trigger.click()
      const popup = page.getByRole('dialog', { name, exact: true })
      await popup.waitFor()
      assert.equal(await popup.locator('header > strong').textContent(), name)
      assert.deepEqual((await popup.locator('dt').allTextContents()).slice(0, 9), fields)
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
        await openEffectParameters(editor)
        await editor
          .getByLabel('Effect duration (turns)', { exact: true })
          .fill(String(scenario.duration))
        await editor
          .getByLabel('Status potency (percent)', { exact: true })
          .fill(String(scenario.potency))
      }
      const master = page.getByRole('region', { name: 'Master elemental details' })
      assert.deepEqual((await master.locator('dt').allTextContents()).slice(0, 9), fields)
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
            'Water Dmg [10] [Enemy]',
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
      await openEffectParameters(cleanseEditor)
      assert.equal(
        await cleanseEditor.getByLabel('Status IDs', { exact: true }).inputValue(),
        'frozen',
      )
      assert.equal(await cleanseEditor.getByLabel('Target', { exact: true }).inputValue(), '')
      assert.equal(
        await cleanseEditor
          .getByRole('button', { name: 'Use standard Cleanse', exact: true })
          .count(),
        0,
      )
      for (const name of ['Master Fire details', 'Nexus Fire parameters']) {
        const report = page.getByRole('region', { name })
        assert.deepEqual((await report.locator('dt').allTextContents()).slice(0, 9), fields)
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
    await verifyAttunementPointer(page, viewport)
    assert.deepEqual(errors, [])
    evidence.push({ viewport, status: 'passed' })
    await page.close()
  }
  await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
  console.log(
    `${shellReachabilityOnly ? 'Mounted Master shell control reachability' : editorIdentityOnly ? 'Mounted editor identity and retained sample Chronicle' : 'Skill parameter family/palette browser'} regression passed. Evidence: ${output}`,
  )
} catch (error) {
  const failedPage = browser
    .contexts()
    .flatMap((context) => context.pages())
    .at(-1)
  await Promise.allSettled([
    fs.writeFile(
      resolve(output, 'failure.json'),
      JSON.stringify(
        {
          error: String(error),
          browserErrors,
          pendingRequests: [...(failedPage?.pendingPaletteRequests ?? [])],
          evidence,
        },
        null,
        2,
      ),
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
  await basicFixture?.close?.()
  await browser.close()
  await sqlFixtureServer?.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
