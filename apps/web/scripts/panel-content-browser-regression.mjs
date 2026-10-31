// Actual operational components and native media; HTTP/session boundaries are local fixtures.
// AV_PANEL_CONTENT_COMPILE_ONLY=1 compiles without claiming browser execution.
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
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'panel-content-'))
const output =
  process.env.AV_PANEL_CONTENT_EVIDENCE_DIR || resolve(tmpdir(), 'panel-content-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/panel-content-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
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
  resolve(fixture, 'next-mock.jsx'),
  `import React,{useSyncExternalStore} from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>};for(const method of ['pushState','replaceState']){const original=history[method].bind(history);history[method]=(...args)=>{original(...args);dispatchEvent(new PopStateEvent('popstate'))}};const subscribe=cb=>{addEventListener('popstate',cb);return()=>removeEventListener('popstate',cb)};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/');export const useRouter=()=>({push:url=>history.pushState(null,'',url),refresh(){}});export const useSearchParams=()=>new URLSearchParams(location.search);`,
)
await fs.writeFile(
  resolve(fixture, 'shell.jsx'),
  `import React from 'react';export function AuthenticatedShellFrame({children}){return <main style={{height:'90vh',minHeight:0,overflow:'auto'}}>{children}</main>}`,
)
await fs.writeFile(
  resolve(fixture, 'supabase.js'),
  `export function createSupabaseBrowserClient(){throw new Error('Native fixture does not perform storage uploads')}`,
)
await fs.writeFile(resolve(fixture, 'server-only.js'), 'export {}')
const sharp = require('sharp')
await sharp(resolve(web, 'public/media/skills/phase3/vanguard-shield-bash.webp'))
  .resize(192, 192)
  .png()
  .toFile(resolve(fixture, 'fixture-finalized.png'))
// A valid short PCM16 WAV exercises native preview decoding, without external audio.
const wav = Buffer.alloc(44 + 4410 * 2)
wav.write('RIFF', 0)
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(44100, 24)
wav.writeUInt32LE(88200, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(wav.length - 44, 40)
for (let i = 0; i < 4410; i++)
  wav.writeInt16LE(Math.round(Math.sin((i * 2 * Math.PI * 440) / 44100) * 1200), 44 + i * 2)
await fs.writeFile(resolve(fixture, 'fixture-sound.wav'), wav)
const config = {
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@/components/shell/authenticated-game-shell': resolve(fixture, 'shell.jsx'),
      '@/lib/supabase/client': resolve(fixture, 'supabase.js'),
      'server-only': resolve(fixture, 'server-only.js'),
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/validation': resolve(root, 'packages/validation/src'),
      '@aurevane/audio': resolve(root, 'packages/audio/src/index.ts'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/link': resolve(fixture, 'next-link.jsx'),
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

if (process.env.AV_PANEL_CONTENT_COMPILE_ONLY === '1') {
  try {
    await build({ ...config, build: { write: false, minify: false } })
    console.log('Actual Game Content and Players fixture compiled; browser not run.')
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
  process.exit(0)
}
const server = await createServer(config)
await server.listen()
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.AV_PANEL_CONTENT_BROWSER_EXECUTABLE || chromium.executablePath(),
})
const evidence = [],
  failures = []
const { expect } = require('@playwright/test')
try {
  const origin = server.resolvedUrls.local[0]
  if (
    !process.env.AV_PANEL_CONTENT_SCENARIO ||
    process.env.AV_PANEL_CONTENT_SCENARIO === 'new-discipline-skill'
  ) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const page = await browser.newPage({ viewport })
      try {
        await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded' })
        const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
        await workspace
          .getByRole('group', { name: 'Editor sections', exact: true })
          .getByRole('button', { name: 'Skills', exact: true })
          .click()
        await expect(workspace).toContainText('1/8 Skills')
        await workspace.getByText('New Skill', { exact: true }).click()
        await workspace.getByRole('button', { name: 'Create Skill', exact: true }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
          'New Skill',
        )
        await dialog
          .getByRole('textbox', { name: 'Name', exact: true })
          .fill('New independent Skill')
        await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
        await expect(dialog).toContainText('Changes committed and available to the game.')
        await dialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
        await expect(workspace).toContainText('2/8 Skills')
        const template = await page.evaluate(() => window.__contentFixture.skillId)
        await workspace
          .getByRole('combobox', { name: 'New Skill starting point', exact: true })
          .selectOption(template)
        await workspace.getByRole('button', { name: 'Create Skill', exact: true }).click()
        await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
          'New Skill',
        )
        const copies = await page.evaluate((sourceKey) => {
          const source = window.__contentFixture.records.get(sourceKey).current.definition
          const key = [...window.__contentFixture.creations.values()].at(-1).key
          const copy = window.__contentFixture.records.get(key).draft.definition
          return {
            key,
            sourceId: source.id,
            copyId: copy.id,
            sourceName: source.name,
            copyName: copy.name,
            sourceEffects: source.effects,
            copyEffects: copy.effects,
            parent: copy.sourceDisciplineId,
          }
        }, template)
        assert.notEqual(copies.copyId, copies.sourceId)
        assert.equal(copies.copyId, copies.key)
        assert.equal(copies.parent, 'bastion')
        assert.equal(copies.copyName, 'New Skill')
        assert.deepEqual(copies.copyEffects, copies.sourceEffects)
        evidence.push({ scenario: 'new-discipline-skill', viewport, blankAndTemplate: 'passed' })
      } finally {
        await page.close()
      }
    }
  }
  if (
    !process.env.AV_PANEL_CONTENT_SCENARIO ||
    process.env.AV_PANEL_CONTENT_SCENARIO === 'hydration-guard'
  ) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    await page.goto(origin + '?view=content&holdRestore=1&holdRead=1', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    })
    await page.waitForFunction(() => typeof window.__releaseContentRestore === 'function')
    const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
    const enabled = await workspace
      .locator('input,select,textarea,button')
      .evaluateAll((elements) =>
        elements
          .filter((element) => !element.matches(':disabled'))
          .map(
            (element) =>
              element.getAttribute('aria-label') ?? element.textContent ?? element.tagName,
          ),
      )
    assert.deepEqual(enabled, [], 'Content controls must remain disabled until recovery finishes')
    await page.evaluate(() => window.__releaseContentRestore())
    await expect(
      workspace.getByRole('combobox', { name: 'Content category', exact: true }),
    ).toBeEnabled()
    const name = workspace.getByRole('textbox', { name: 'Name', exact: true })
    await name.fill('Recovered after delayed list and read')
    const beforeReload = await page.evaluate(() => window.__contentCommitCount)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.__releaseContentRestore === 'function')
    const enabledOnReload = await workspace
      .locator('input,select,textarea,button')
      .evaluateAll((elements) =>
        elements
          .filter((element) => !element.matches(':disabled'))
          .map((element) => element.getAttribute('aria-label') ?? element.textContent),
      )
    assert.deepEqual(enabledOnReload, [], 'Controls stay frozen while the recovery list is pending')
    await page.evaluate(() => window.__releaseContentRestore())
    await page.waitForFunction(() => typeof window.__releaseContentRead === 'function')
    const enabledDuringRead = await workspace
      .locator('input,select,textarea,button')
      .evaluateAll((elements) =>
        elements
          .filter((element) => !element.matches(':disabled'))
          .map((element) => element.getAttribute('aria-label') ?? element.textContent),
      )
    assert.deepEqual(
      enabledDuringRead,
      [],
      'Controls stay frozen until the recovered record read completes',
    )
    await page.evaluate(() => window.__releaseContentRead())
    await expect(name).toBeEnabled()
    await expect(name).toHaveValue('Recovered after delayed list and read')
    assert.equal(await page.evaluate(() => window.__contentCommitCount), beforeReload)
    evidence.push({
      scenario: 'hydration-guard',
      controlsDisabledDuringRestore: true,
      heldListAndReadOnReload: true,
      localDraftRetained: true,
      reloadCommits: 0,
    })
    await page.close()
  }
  if (
    !process.env.AV_PANEL_CONTENT_SCENARIO ||
    process.env.AV_PANEL_CONTENT_SCENARIO === 'ambiguous-create'
  ) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    page.setDefaultNavigationTimeout(60000)
    await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded' })
    const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
    const sidebar = page.getByRole('complementary', { name: 'Content browser', exact: true })
    await expect(
      workspace
        .getByRole('navigation', { name: 'Content records', exact: true })
        .getByRole('button'),
    ).toHaveCount(127)
    await sidebar.getByRole('button', { name: 'New', exact: true }).click()
    const name = workspace.getByRole('textbox', { name: 'Name', exact: true })
    await name.fill('First creation request')
    await page.evaluate(() => (window.__contentFixture.loseCreateResponse = true))
    await page
      .getByRole('group', { name: 'Save content', exact: true })
      .getByRole('button', { name: 'Commit Now', exact: true })
      .click()
    await expect(workspace.getByRole('alert')).toContainText(
      'Fixture response was lost after creation.',
    )
    assert.equal(await page.evaluate(() => window.__contentFixture.creations.size), 1)
    const frozen = await page.evaluate(() => [...window.__contentFixture.creations.values()][0])
    await name.fill('Newer local creation edits')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(name).toHaveValue('Newer local creation edits')
    await page
      .getByRole('group', { name: 'Save content', exact: true })
      .getByRole('button', { name: 'Commit Now', exact: true })
      .click()
    await expect(
      workspace
        .getByRole('status')
        .filter({ hasText: 'Changes committed and available to the game.' }),
    ).toBeVisible()
    assert.equal(await page.evaluate(() => window.__contentFixture.creations.size), 1)
    const created = await page.evaluate(
      (key) => window.__contentFixture.records.get(key),
      frozen.key,
    )
    assert.equal(created.current.definition.name, 'Newer local creation edits')
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse([...window.__contentFixture.creations.values()][0].fingerprint).definition
            .name,
      ),
      'First creation request',
    )
    assert.equal(
      await page.evaluate(
        () =>
          [...window.__contentFixture.records.values()].filter((row) =>
            row.contentKey.startsWith('discipline.created.'),
          ).length,
      ),
      1,
    )
    evidence.push({
      scenario: 'ambiguous-create',
      lostResponse: true,
      editsRetainedAcrossReload: true,
      frozenIdempotentCreate: true,
      createdRecords: 1,
    })
    await page.close()
  }
  if (
    !process.env.AV_PANEL_CONTENT_SCENARIO ||
    process.env.AV_PANEL_CONTENT_SCENARIO === 'rejected-create'
  ) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
    await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded', timeout: 60000 })
    const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
    const sidebar = page.getByRole('complementary', { name: 'Content browser', exact: true })
    await expect(sidebar.getByRole('button', { name: 'New', exact: true })).toBeEnabled()
    await sidebar.getByRole('button', { name: 'New', exact: true }).click()
    await workspace.getByRole('textbox', { name: 'Name', exact: true }).fill('Corrected creation')
    const might = workspace.getByRole('spinbutton', { name: 'might base', exact: true })
    const initialMight = Number(await might.inputValue())
    await might.fill(String(initialMight + 1))
    await page
      .getByRole('group', { name: 'Save content', exact: true })
      .getByRole('button', { name: 'Commit Now', exact: true })
      .click()
    await expect(workspace.getByRole('alert')).toContainText(
      'Six positive integer bases must total 31',
    )
    assert.equal(await page.evaluate(() => window.__contentFixture.creations.size), 0)
    await might.fill(String(initialMight))
    await page
      .getByRole('group', { name: 'Save content', exact: true })
      .getByRole('button', { name: 'Commit Now', exact: true })
      .click()
    await expect(
      workspace
        .getByRole('status')
        .filter({ hasText: 'Changes committed and available to the game.' }),
    ).toBeVisible()
    const requests = await page.evaluate(() =>
      window.__contentRequests
        .filter((row) => row.body.command?.action === 'create')
        .map((row) => row.body.command),
    )
    assert.equal(requests.length, 2)
    assert.notEqual(requests[0].requestId, requests[1].requestId)
    assert.equal(await page.evaluate(() => window.__contentFixture.creations.size), 1)
    evidence.push({
      scenario: 'rejected-create',
      actualAuthoringValidation: true,
      invalidCreatedRecords: 0,
      correctedCreatedRecords: 1,
      freshRequestAfterDefiniteRejection: true,
    })
    await page.close()
  }
  if (
    !process.env.AV_PANEL_CONTENT_SCENARIO ||
    process.env.AV_PANEL_CONTENT_SCENARIO === 'skill-availability'
  ) {
    for (const viewport of [
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width === 390 })
      const page = await context.newPage()
      page.setDefaultNavigationTimeout(60000)
      await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded' })
      const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
      const sidebar = page.getByRole('complementary', { name: 'Content browser', exact: true })
      const category = sidebar.getByRole('combobox', { name: 'Content category', exact: true })
      const records = workspace.getByRole('navigation', { name: 'Content records', exact: true })
      await expect(records.getByRole('button')).toHaveCount(127)
      await expect(sidebar.getByRole('button', { name: 'Commit Now', exact: true })).toHaveCount(0)
      await expect(commit).toBeVisible()
      assert.equal(
        await sidebar.evaluate((browser) => {
          const search = browser.querySelector('input[type="search"]')
          const list = browser.querySelector('nav')
          return !!(search.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)
        }),
        true,
        'Search precedes the content list',
      )
      await category.selectOption('skill')
      await sidebar.getByRole('button', { name: 'New', exact: true }).click()
      await workspace
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('Created Bastion Skill')
      await workspace
        .getByRole('combobox', { name: 'Source Discipline', exact: true })
        .selectOption('bastion')
      await page
        .getByRole('group', { name: 'Save content', exact: true })
        .getByRole('button', { name: 'Commit Now', exact: true })
        .click()
      await expect(
        workspace
          .getByRole('status')
          .filter({ hasText: 'Changes committed and available to the game.' }),
      ).toBeVisible()
      const skillKey = await page.evaluate(
        () => [...window.__contentFixture.creations.values()][0].key,
      )
      await category.selectOption('discipline')
      await records.locator('[data-content-key="bastion"]').click()
      const parentBefore = await page.evaluate(() =>
        structuredClone(window.__contentFixture.records.get('bastion').current.definition),
      )
      await workspace
        .getByRole('textbox', { name: 'Description', exact: true })
        .fill('Unrelated pending parent description.')
      const tabs = workspace.getByRole('group', { name: 'Editor sections', exact: true })
      await tabs.getByRole('button', { name: 'Skills', exact: true }).click()
      const skills = workspace.getByRole('region', { name: 'Discipline skills', exact: true })
      await expect(
        skills.getByRole('button', { name: 'Unrelated Source Skill', exact: true }),
      ).toHaveCount(0)
      const trigger = skills.getByRole('button', { name: 'Created Bastion Skill', exact: true })
      await expect(trigger).toBeVisible()
      const beforeOpen = await page.evaluate(() => window.__contentCommitCount)
      await trigger.click()
      const dialog = page.getByRole('dialog')
      const availability = dialog.getByRole('checkbox', {
        name: 'Available in this Discipline',
        exact: true,
      })
      const mastery = dialog.getByRole('spinbutton', {
        name: 'Required mastery stage',
        exact: true,
      })
      await expect(availability).not.toBeChecked()
      await expect(mastery).toHaveCount(0)
      assert.equal(await page.evaluate(() => window.__contentCommitCount), beforeOpen)
      assert.deepEqual(
        await page.evaluate(
          () => window.__contentFixture.records.get('bastion').current.definition,
        ),
        parentBefore,
      )
      await availability.check()
      await mastery.fill('3')
      const childDescription = dialog.getByRole('textbox', { name: 'Description', exact: true })
      const childBefore = await childDescription.inputValue()
      await childDescription.fill('Submitted child description.')
      await page.evaluate(() => (window.__contentFixture.holdCommit = true))
      await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await page.waitForFunction(() => typeof window.__releaseContentCommit === 'function')
      // Both edits happen after Commit: parent intent must remain stage3, and
      // reverting to the old child text must remain an explicit newer edit.
      await childDescription.fill(childBefore)
      await mastery.fill('4')
      await page.evaluate(() => window.__releaseContentCommit())
      await expect(dialog.getByRole('status')).toContainText('newer edits remain uncommitted')
      await expect(childDescription).toHaveValue(childBefore)
      await expect(mastery).toHaveValue('4')
      const afterFirst = await page.evaluate(
        (key) => ({
          parent: window.__contentFixture.records.get('bastion'),
          child: window.__contentFixture.records.get(key),
        }),
        skillKey,
      )
      assert.equal(afterFirst.child.current.definition.description, 'Submitted child description.')
      assert.equal(afterFirst.parent.current.definition.description, parentBefore.description)
      assert.ok(afterFirst.parent.current.definition.linkedSkills.includes(skillKey))
      assert.equal(
        afterFirst.parent.current.definition.skillStages.find((row) => row.skillId === skillKey)
          .minimumStage,
        3,
      )
      const parentCommands = await page.evaluate(() =>
        window.__contentRequests
          .filter(
            (row) =>
              row.body?.command?.action === 'commit' && row.body.command.contentKey === 'bastion',
          )
          .map((row) => row.body.command),
      )
      assert.equal(parentCommands.length, 1)
      assert.equal(parentCommands[0].expectedRevision, 2)
      assert.deepEqual(
        parentCommands[0].definition.skillStages.filter((row) => row.skillId !== skillKey),
        parentBefore.skillStages,
      )
      await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await expect(dialog.getByRole('status')).toContainText(
        'Saved; discipline edits remain uncommitted.',
      )
      const afterSecond = await page.evaluate(
        (key) => ({
          parent: window.__contentFixture.records.get('bastion'),
          child: window.__contentFixture.records.get(key),
        }),
        skillKey,
      )
      assert.equal(afterSecond.child.current.definition.description, childBefore)
      assert.equal(
        afterSecond.parent.current.definition.skillStages.find((row) => row.skillId === skillKey)
          .minimumStage,
        4,
      )
      assert.equal(afterSecond.parent.current.definition.description, parentBefore.description)
      await availability.uncheck()
      await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await expect(dialog.getByRole('status')).toContainText(
        'Saved; discipline edits remain uncommitted.',
      )
      const removed = await page.evaluate(
        () => window.__contentFixture.records.get('bastion').current.definition,
      )
      assert.ok(!removed.linkedSkills.includes(skillKey))
      assert.ok(!removed.skillStages.some((row) => row.skillId === skillKey))
      await availability.check()
      await mastery.fill('2')
      await page.evaluate(() => window.__contentFixture.records.get('bastion').revision++)
      await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await expect(dialog.getByRole('alert')).toContainText(
        'Skill saved; the discipline settings are still uncommitted.',
      )
      await expect(availability).toBeChecked()
      await expect(mastery).toHaveValue('2')
      await dialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      await tabs.getByRole('button', { name: 'Discipline Details', exact: true }).click()
      await expect(
        workspace.getByRole('textbox', { name: 'Description', exact: true }),
      ).toHaveValue('Unrelated pending parent description.')
      assert.equal(
        await page.evaluate(
          () => window.__contentFixture.records.get('bastion').current.definition.description,
        ),
        parentBefore.description,
      )
      // Archived parents retain independent child editing while parent inclusion
      // and mastery controls are disabled.
      await page.evaluate(
        () => (window.__contentFixture.records.get('bastion').lifecycle = 'archived'),
      )
      await records.locator('[data-content-key="bastion"]').click()
      await tabs.getByRole('button', { name: 'Skills', exact: true }).click()
      const originalSkillName = await page.evaluate(
        () =>
          window.__contentFixture.records.get(window.__contentFixture.skillId).current.definition
            .name,
      )
      await skills.getByRole('button', { name: originalSkillName, exact: true }).click()
      await expect(availability).toBeDisabled()
      await expect(mastery).toBeDisabled()
      await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeEnabled()
      await dialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        .toBe(true)
      await page.screenshot({
        path: resolve(output, `skill-availability-${viewport.width}.png`),
        fullPage: true,
      })
      evidence.push({
        scenario: 'skill-availability',
        viewport,
        globalCreateSource: true,
        openingDoesNotAssign: true,
        exactSourceCandidates: true,
        explicitAssociationAndMastery: true,
        parentExpectedRevision: 2,
        unrelatedParentEditsRetained: true,
        reviewedAssociationSnapshot: true,
        modalHeldSaveThenRevertRetained: true,
        removal: true,
        partialSaveCasErrorRetained: true,
        parentReadOnlyControls: true,
        authority:
          'Production components with local HTTP transport; unchanged SQL projector/authority checked separately.',
      })
      await context.close()
    }
  }
  if (
    !process.env.AV_PANEL_CONTENT_SCENARIO ||
    ['modal-save-races', 'modal-baseline-revert', 'modal-close-context'].includes(
      process.env.AV_PANEL_CONTENT_SCENARIO,
    )
  ) {
    for (const race of ['modal-baseline-revert', 'modal-close-context']) {
      if (
        process.env.AV_PANEL_CONTENT_SCENARIO &&
        !['modal-save-races', race].includes(process.env.AV_PANEL_CONTENT_SCENARIO)
      )
        continue
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } })
      const page = await context.newPage()
      page.setDefaultNavigationTimeout(60000)
      try {
        await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded' })
        const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
        const sidebar = page.getByRole('complementary', { name: 'Content browser', exact: true })
        const records = workspace.getByRole('navigation', { name: 'Content records', exact: true })
        await expect(records.getByRole('button')).toHaveCount(127)
        const tabs = workspace.getByRole('group', { name: 'Editor sections', exact: true })
        await tabs.getByRole('button', { name: 'Skills', exact: true }).click()
        const skillId = await page.evaluate(() => window.__contentFixture.skillId)
        const skillName = await page.evaluate(
          (key) => window.__contentFixture.records.get(key).current.definition.name,
          skillId,
        )
        await workspace
          .getByRole('region', { name: 'Discipline skills', exact: true })
          .getByRole('button', { name: skillName, exact: true })
          .click()
        const dialog = page.getByRole('dialog')
        const mastery = dialog.getByRole('spinbutton', {
          name: 'Required mastery stage',
          exact: true,
        })
        const availability = dialog.getByRole('checkbox', {
          name: 'Available in this Discipline',
          exact: true,
        })
        await expect(mastery).toHaveValue('1')
        await mastery.fill('3')
        await page.evaluate(() => {
          delete window.__releaseContentCommit
          window.__contentFixture.holdCommit = true
        })
        await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
        await page.waitForFunction(() => typeof window.__releaseContentCommit === 'function')
        if (race === 'modal-baseline-revert') {
          // The parent is otherwise clean: this reversion exactly matches its old base.
          await mastery.fill('1')
          await page.evaluate(() => window.__releaseContentCommit())
          await expect(
            dialog.getByRole('button', { name: 'Commit Now', exact: true }),
          ).toBeEnabled()
          await expect(mastery).toHaveValue('1')
          await expect(dialog.getByRole('status')).toContainText(
            'discipline edits remain uncommitted',
          )
          assert.equal(
            await page.evaluate(
              (key) =>
                window.__contentFixture.records
                  .get('bastion')
                  .current.definition.skillStages.find((row) => row.skillId === key).minimumStage,
              skillId,
            ),
            3,
          )
          await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
          await expect(dialog.getByRole('status')).toContainText(
            'Changes committed and available to the game.',
          )
          assert.equal(
            await page.evaluate(
              (key) =>
                window.__contentFixture.records
                  .get('bastion')
                  .current.definition.skillStages.find((row) => row.skillId === key).minimumStage,
              skillId,
            ),
            1,
          )
          // The same baseline boundary applies to inclusion, not only numeric mastery.
          await availability.uncheck()
          await page.evaluate(() => {
            delete window.__releaseContentCommit
            window.__contentFixture.holdCommit = true
          })
          await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
          await page.waitForFunction(() => typeof window.__releaseContentCommit === 'function')
          await availability.check()
          await page.evaluate(() => window.__releaseContentCommit())
          await expect(
            dialog.getByRole('button', { name: 'Commit Now', exact: true }),
          ).toBeEnabled()
          await expect(availability).toBeChecked()
          await expect(mastery).toHaveValue('1')
          await expect(dialog.getByRole('status')).toContainText(
            'discipline edits remain uncommitted',
          )
          assert.equal(
            await page.evaluate(
              (key) =>
                window.__contentFixture.records
                  .get('bastion')
                  .current.definition.linkedSkills.includes(key),
              skillId,
            ),
            false,
          )
          evidence.push({
            scenario: race,
            parentOnlyMasteryRevertRetained: true,
            parentOnlyInclusionRevertRetained: true,
            noticeTruthful: true,
          })
        } else {
          await page.keyboard.press('Escape')
          await expect(dialog).toHaveCount(0)
          await expect(sidebar.getByRole('button', { name: 'New', exact: true })).toBeDisabled()
          await expect(
            sidebar.getByRole('combobox', { name: 'Content category', exact: true }),
          ).toBeDisabled()
          await expect(
            tabs.getByRole('button', { name: 'Discipline Details', exact: true }),
          ).toBeDisabled()
          await expect(records.getByRole('button').first()).toBeDisabled()
          await page.evaluate(() => window.__releaseContentCommit())
          await expect(sidebar.getByRole('button', { name: 'New', exact: true })).toBeEnabled()
          assert.equal(
            await page.evaluate(
              (key) =>
                window.__contentFixture.records
                  .get('bastion')
                  .current.definition.skillStages.find((row) => row.skillId === key).minimumStage,
              skillId,
            ),
            3,
          )
          await sidebar.getByRole('button', { name: 'New', exact: true }).click()
          await workspace
            .getByRole('textbox', { name: 'Name', exact: true })
            .fill('New draft after the modal transaction settled')
          await expect(workspace.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
            'New draft after the modal transaction settled',
          )
          evidence.push({
            scenario: race,
            escapeAllowed: true,
            newAndNavigationDisabledUntilBothWritesFinish: true,
            newWorksAfterAcknowledgement: true,
          })
        }
        await page.screenshot({ path: resolve(output, race + '.png'), fullPage: true })
      } catch (error) {
        failures.push({ scenario: race, message: String(error) })
        console.error('MODAL RACE FAILURE', race, String(error))
        await page.screenshot({ path: resolve(output, race + '-failure.png'), fullPage: true })
      } finally {
        await context.close()
      }
    }
  }
  for (const scenario of [
    { label: 'desktop', width: 1366, height: 768 },
    { label: 'mobile', width: 390, height: 844 },
    { label: 'short-responsive', width: 683, height: 384 },
  ]) {
    if (
      process.env.AV_PANEL_CONTENT_SCENARIO &&
      process.env.AV_PANEL_CONTENT_SCENARIO !== scenario.label
    )
      continue
    const context = await browser.newContext({
      viewport: scenario,
      hasTouch: scenario.label === 'mobile',
    })
    const page = await context.newPage(),
      errors = []
    page.setDefaultTimeout(15000)
    page.setDefaultNavigationTimeout(60000)
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.route('**/api/master/combat-content/media/*', (route) =>
      route.fulfill({
        path: resolve(
          fixture,
          route.request().url().endsWith('111111111112')
            ? 'fixture-sound.wav'
            : 'fixture-finalized.png',
        ),
        contentType: route.request().url().endsWith('111111111112') ? 'audio/wav' : 'image/png',
      }),
    )
    try {
      console.log('Verifying content', scenario.label)
      await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded', timeout: 60000 })
      const workspace = page.getByRole('region', { name: 'Game Content workspace', exact: true })
      const sidebar = page.getByRole('complementary', { name: 'Content browser', exact: true })
      const records = page.getByRole('navigation', { name: 'Content records', exact: true })
      const tabs = workspace.getByRole('group', { name: 'Editor sections', exact: true })
      const description = workspace.getByRole('textbox', { name: 'Description', exact: true })
      const commit = page
        .getByRole('group', { name: 'Save content', exact: true })
        .getByRole('button', { name: 'Commit Now', exact: true })
      await expect(records.getByRole('button')).toHaveCount(127)
      assert.deepEqual(await tabs.getByRole('button').allTextContents(), [
        'Discipline Details',
        'Artwork',
        'Skills',
        'Resonances',
        'Usage & Balance',
      ])
      for (const removed of [
        'History',
        'Text',
        'Parameters',
        'Identity & Relations',
        'Next page',
        'Previous page',
      ])
        assert.equal(await workspace.getByRole('button', { name: removed, exact: true }).count(), 0)
      assert.equal(await workspace.getByRole('combobox', { name: 'State', exact: true }).count(), 0)
      assert.equal(
        await workspace
          .locator('details')
          .filter({ hasText: /^Find / })
          .count(),
        0,
      )
      const geometry = await sidebar.evaluate((sidebar) => {
        const list = sidebar.querySelector('nav'),
          parent = sidebar.parentElement
        return {
          columns: getComputedStyle(parent).gridTemplateColumns,
          listHeight: list.clientHeight,
          listScrollHeight: list.scrollHeight,
          sidebarWidth: sidebar.getBoundingClientRect().width,
          editorWidth: parent.lastElementChild.getBoundingClientRect().width,
        }
      })
      if (scenario.label === 'desktop') {
        assert.equal(geometry.columns.split(' ').length, 2)
        assert.ok(geometry.editorWidth > geometry.sidebarWidth * 1.8)
        assert.ok(geometry.listScrollHeight > geometry.listHeight)
        const core = workspace.getByRole('group', {
          name: 'Core attributes and availability',
          exact: true,
        })
        const boxes = await core
          .locator('input[type="number"]')
          .evaluateAll((inputs) => inputs.map((input) => input.getBoundingClientRect().top))
        assert.equal(boxes.length, 6)
        assert.ok(
          Math.max(...boxes) - Math.min(...boxes) <= 1,
          'Six attributes share one desktop row',
        )
      }
      await records.locator('[data-content-key="discipline.fixture.124"]').click()
      await expect(
        workspace.getByRole('heading', { name: 'Additional Discipline 125', exact: true }),
      ).toBeVisible()
      await records.locator('[data-content-key="bastion"]').click()
      await expect(description).toHaveValue('Current Bastion text.')
      await tabs.getByRole('button', { name: 'Artwork', exact: true }).click()
      await workspace
        .getByRole('img', { name: 'Current artwork', exact: true })
        .evaluate((image) => image.decode())
      await tabs.getByRole('button', { name: 'Discipline Details', exact: true }).click()
      assert.equal(await workspace.getByRole('textbox', { name: 'Name', exact: true }).count(), 1)
      await description.fill('Recovered local discipline draft. No automatic commit.')
      await workspace
        .getByRole('searchbox', { name: 'Search content', exact: true })
        .fill('Discipline')
      await workspace
        .getByRole('combobox', { name: 'Sort content', exact: true })
        .selectOption('name-desc')
      await records.evaluate((list) => {
        list.scrollTop = 350
        list.dispatchEvent(new Event('scroll'))
      })
      console.log('Content list and fields passed', scenario.label)
      const commitsBeforeReload = await page.evaluate(() => window.__contentCommitCount)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(description).toHaveValue(
        'Recovered local discipline draft. No automatic commit.',
      )
      await expect(
        workspace.getByRole('searchbox', { name: 'Search content', exact: true }),
      ).toHaveValue('Discipline')
      await expect(
        workspace.getByRole('combobox', { name: 'Sort content', exact: true }),
      ).toHaveValue('name-desc')
      assert.equal(await page.evaluate(() => window.__contentCommitCount), commitsBeforeReload)
      assert.equal(
        await page.evaluate(
          () => window.__contentFixture.records.get('bastion').current.definition.description,
        ),
        'Current Bastion text.',
      )
      await expect.poll(() => records.evaluate((list) => list.scrollTop)).toBeGreaterThan(250)
      // Changing the actor recovery scope cannot restore another actor's local edits.
      await page.goto(origin + '?view=content&actor=other-account:selected-character', {
        waitUntil: 'domcontentloaded',
      })
      await expect(description).toHaveValue('Current Bastion text.')
      await page.goto(origin + '?view=content', { waitUntil: 'domcontentloaded' })
      await expect(description).toHaveValue(
        'Recovered local discipline draft. No automatic commit.',
      )
      await workspace.getByRole('searchbox', { name: 'Search content', exact: true }).fill('')
      await sidebar.getByRole('button', { name: 'Search', exact: true }).click()
      await page.evaluate(() => (window.__contentFixture.holdCommit = true))
      await commit.click()
      await page.waitForFunction(() => typeof window.__releaseContentCommit === 'function')
      await description.fill('Newer edit retained during a commit.')
      await page.evaluate(() => window.__releaseContentCommit())
      await expect(
        workspace
          .getByRole('status')
          .filter({ hasText: 'Saved; newer local edits remain uncommitted.' }),
      ).toBeVisible()
      await expect(description).toHaveValue('Newer edit retained during a commit.')
      await commit.click()
      await expect(
        workspace
          .getByRole('status')
          .filter({ hasText: 'Changes committed and available to the game.' }),
      ).toBeVisible()
      await description.fill('Retained after server rejection.')
      await page.evaluate(() => (window.__contentFixture.failCommit = true))
      await commit.click()
      await expect(workspace.getByRole('alert')).toContainText(
        'Fixture server rejected this commit.',
      )
      await expect(description).toHaveValue('Retained after server rejection.')
      await description.fill('Newer edit retained during a commit.')
      console.log('Content recovery and commits passed', scenario.label)
      await tabs.getByRole('button', { name: 'Usage & Balance', exact: true }).click()
      await expect(
        workspace.getByRole('heading', { name: 'Usage & Balance', exact: true }),
      ).toBeVisible()
      await expect(workspace).toContainText('Awaiting eligible completed battles')
      await expect(workspace.locator('[data-chart="adoption"] meter').first()).toHaveAttribute(
        'value',
        '3',
      )
      await expect(workspace.locator('[data-chart="adoption"] meter').first()).toHaveAttribute(
        'max',
        '5',
      )
      const reportingWeek = workspace.getByLabel('Week', { exact: true })
      await reportingWeek.selectOption('2026-10-19')
      await expect(workspace).toContainText('2 player appearances')
      await expect(workspace.locator('[data-chart="outcomes"]')).toHaveCount(1)
      await expect(workspace.locator('[data-chart="skills"]')).toBeVisible()
      await workspace.getByText('Exact Skill counts', { exact: true }).click()
      await expect(workspace.getByRole('table')).toBeVisible()
      await expect(workspace.locator('[data-chart="adoption"] meter').first()).toHaveAttribute(
        'value',
        '3',
      )
      await reportingWeek.selectOption('')
      await expect(workspace).toContainText('Actual-use data unavailable')
      await expect(workspace.locator('[data-chart="outcomes"]')).toHaveCount(0)
      await tabs.getByRole('button', { name: 'Skills', exact: true }).click()
      const skills = workspace.getByRole('region', { name: 'Discipline skills', exact: true })
      const skillTrigger = skills.getByRole('button').first()
      await skillTrigger.click()
      let dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
      const modalName = dialog.getByRole('textbox', { name: 'Name', exact: true })
      await dialog
        .getByRole('spinbutton', { name: 'Required mastery stage', exact: true })
        .fill('3')
      await dialog.getByRole('tab', { name: 'Execution Characteristics', exact: true }).click()
      await expect(
        dialog.getByRole('spinbutton', { name: 'Action Economy (AP)', exact: true }),
      ).toHaveCount(1)
      await expect(
        dialog.getByRole('combobox', { name: 'Accuracy mode', exact: true }),
      ).toBeVisible()
      await expect(dialog.getByRole('combobox', { name: 'Target kind', exact: true })).toHaveCount(
        0,
      )
      await dialog.getByRole('tab', { name: 'Details & Text', exact: true }).click()
      await expect(dialog.getByText('Wording overrides', { exact: true })).toHaveCount(0)
      await expect(
        dialog.getByRole('textbox', { name: 'In-battle text', exact: true }),
      ).toHaveCount(1)
      await expect(
        dialog.getByRole('textbox', { name: 'Full public description', exact: true }),
      ).toHaveCount(1)
      await page.keyboard.press('Tab')
      assert.equal(
        await dialog.evaluate((element) => element.contains(document.activeElement)),
        true,
      )
      await modalName.fill('Fixture Skill Revised')
      await dialog
        .getByRole('textbox', { name: 'Description', exact: true })
        .fill('Full skill modal draft retained on close.')
      await expect(
        dialog.getByRole('tablist', { name: 'Ability sections', exact: true }),
      ).toBeVisible()
      assert.deepEqual(await dialog.getByRole('tab').allTextContents(), [
        'Details & Text',
        'Media',
        'Range & Area',
        'Execution Characteristics',
        'Effects',
      ])
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(skillTrigger).toBeFocused()
      const beforeModalRecovery = await page.evaluate(() => window.__contentCommitCount)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(tabs.getByRole('button', { name: 'Skills', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      assert.equal(await page.evaluate(() => window.__contentCommitCount), beforeModalRecovery)
      await skillTrigger.click()
      await expect(modalName).toHaveValue('Fixture Skill Revised')
      await expect(
        dialog.getByRole('spinbutton', { name: 'Required mastery stage', exact: true }),
      ).toHaveValue('3')
      await dialog.getByRole('tab', { name: 'Media', exact: true }).click()
      const soundPool = dialog.getByLabel('Skill audio hook', { exact: true })
      await expect(soundPool.locator('option')).toHaveCount(154)
      await soundPool.selectOption('audio.skill-fx.v01.082')
      await expect(soundPool).toHaveValue('audio.skill-fx.v01.082')
      const groupPreview = dialog.getByLabel('Battle audio preview', { exact: true })
      await expect(groupPreview).toHaveAttribute('src', '/media/audio/sfx/skill-fx-v01/082-1.mp3')
      await groupPreview.evaluate((audio) => audio.load())
      await expect.poll(() => groupPreview.evaluate((audio) => audio.readyState)).toBeGreaterThan(1)
      await dialog
        .getByLabel('Upload content media', { exact: true })
        .setInputFiles(resolve(fixture, 'fixture-finalized.png'))
      await expect(dialog.getByRole('button', { name: 'Upload file', exact: true })).toHaveCount(0)
      await dialog
        .getByRole('img', { name: 'Finalized artwork crop', exact: true })
        .evaluate((image) => image.decode())
      await expect(dialog.getByRole('img', { name: 'Current artwork', exact: true })).toHaveCount(0)
      await expect(dialog.getByRole('button', { name: 'Commit Now', exact: true })).toBeEnabled()
      await dialog
        .getByLabel('Upload content media', { exact: true })
        .setInputFiles(resolve(fixture, 'fixture-sound.wav'))
      const finalizedSound = dialog.getByLabel('Finalized sound preview', { exact: true })
      await finalizedSound.evaluate((audio) => {
        audio.load()
      })
      await expect
        .poll(() => finalizedSound.evaluate((audio) => audio.readyState))
        .toBeGreaterThanOrEqual(1)
      await finalizedSound.evaluate(async (audio) => {
        await audio.play()
        audio.pause()
      })
      await dialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await expect(dialog.getByRole('status')).toContainText(
        'Changes committed and available to the game.',
      )
      assert.equal(
        await page.evaluate(
          () =>
            window.__contentFixture.records.get(window.__contentFixture.skillId).current.definition
              .name,
        ),
        'Fixture Skill Revised',
      )
      assert.equal(
        await page.evaluate(
          () =>
            window.__contentFixture.records.get('bastion').current.definition.skillStages[0]
              .minimumStage,
        ),
        3,
      )
      await dialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      console.log('Content skill modal passed', scenario.label)
      await tabs.getByRole('button', { name: 'Resonances', exact: true }).click()
      const relationships = workspace.getByRole('region', {
        name: 'Discipline relationships',
        exact: true,
      })
      await expect(relationships).toContainText('None (Essence)')
      // An empty relationship opens its new editor in one click.
      await relationships
        .getByRole('button', { name: 'Edit power for Additional Discipline 001', exact: true })
        .click()
      await expect(page.getByRole('dialog', { name: /^Select power/ })).toHaveCount(0)
      const directEditor = page.getByRole('dialog')
      await expect(
        directEditor.getByRole('heading', { name: 'New Resonance', exact: true }),
      ).toBeVisible()
      await directEditor
        .getByRole('textbox', { name: 'Name', exact: true })
        .fill('Directly created Resonance')
      await directEditor.getByRole('button', { name: 'Commit Now', exact: true }).click()
      await expect(directEditor.getByRole('status')).toContainText('Changes committed')
      await directEditor.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      await expect(
        relationships.getByRole('button', {
          name: 'Change power for Additional Discipline 001',
          exact: true,
        }),
      ).toBeVisible()
      const associationWrites = await page.evaluate(() => window.__contentCommitCount)
      const parentBefore = await page.evaluate(() =>
        structuredClone(window.__contentFixture.records.get('bastion').current.definition),
      )
      await relationships
        .getByRole('button', { name: 'Change power for Partner Discipline', exact: true })
        .click()
      let associationDialog = page.getByRole('dialog', {
        name: 'Select power · Partner Discipline',
        exact: true,
      })
      await expect(
        associationDialog.getByRole('combobox', { name: 'Power', exact: true }).locator('option'),
      ).toHaveCount(3)
      await associationDialog
        .getByRole('combobox', { name: 'Power', exact: true })
        .selectOption('resonance.fixture.alternative')
      await associationDialog.getByRole('button', { name: 'Apply selection', exact: true }).click()
      await relationships
        .getByRole('button', { name: 'Edit power for Partner Discipline', exact: true })
        .click()
      await expect(
        page.getByRole('dialog').getByRole('textbox', { name: 'Name', exact: true }),
      ).toHaveValue('Alternative Shared Power')
      await page.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      await relationships
        .getByRole('button', { name: 'Change power for Partner Discipline', exact: true })
        .click()
      associationDialog = page.getByRole('dialog', {
        name: 'Select power · Partner Discipline',
        exact: true,
      })
      await associationDialog
        .getByRole('combobox', { name: 'Power', exact: true })
        .selectOption(await page.evaluate(() => window.__contentFixture.resonanceId))
      await associationDialog.getByRole('button', { name: 'Apply selection', exact: true }).click()
      await relationships
        .getByRole('button', { name: 'Change power for None (Essence)', exact: true })
        .click()
      associationDialog = page.getByRole('dialog', {
        name: 'Select power · None (Essence)',
        exact: true,
      })
      await expect(
        associationDialog.getByRole('combobox', { name: 'Power', exact: true }).locator('option'),
      ).toHaveCount(3)
      await associationDialog
        .getByRole('combobox', { name: 'Power', exact: true })
        .selectOption('essence.fixture.alternative')
      await associationDialog.getByRole('button', { name: 'Apply selection', exact: true }).click()
      await relationships
        .getByRole('button', { name: 'Change power for None (Essence)', exact: true })
        .click()
      associationDialog = page.getByRole('dialog', {
        name: 'Select power · None (Essence)',
        exact: true,
      })
      await associationDialog
        .getByRole('combobox', { name: 'Power', exact: true })
        .selectOption(await page.evaluate(() => window.__contentFixture.essenceId))
      await associationDialog.getByRole('button', { name: 'Apply selection', exact: true }).click()
      assert.equal(
        await page.evaluate(() => window.__contentCommitCount),
        associationWrites,
        'Association selection must remain local',
      )
      assert.deepEqual(
        await page.evaluate(
          () => window.__contentFixture.records.get('bastion').current.definition,
        ),
        parentBefore,
      )
      const resonanceTrigger = relationships.getByRole('button', {
        name: 'Edit power for Partner Discipline',
        exact: true,
      })
      await resonanceTrigger.click()
      dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible()
      await dialog
        .getByRole('textbox', { name: 'Description', exact: true })
        .fill('Resonance modal retains its complete supported editor.')
      await dialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      await resonanceTrigger.click()
      await expect(dialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
        'Resonance modal retains its complete supported editor.',
      )
      await dialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
      // A created power is independently recoverable; closing it cannot poison
      // the Discipline with an unpublished reference. Exercise real callbacks.
      for (const kind of ['Essence', 'Resonance']) {
        const label = kind === 'Essence' ? 'None (Essence)' : 'Partner Discipline'
        const before = await page.evaluate(() =>
          structuredClone(window.__contentFixture.records.get('bastion').current.definition),
        )
        await relationships
          .getByRole('button', { name: `Change power for ${label}`, exact: true })
          .click()
        let selection = page.getByRole('dialog', { name: `Select power · ${label}`, exact: true })
        await selection.getByRole('button', { name: `Create new ${kind}`, exact: true }).click()
        let powerDialog = page.getByRole('dialog')
        await expect(powerDialog).toBeVisible()
        const draftKey = await page.evaluate(
          (kind) =>
            [...window.__contentFixture.records.values()].find(
              (row) => row.contentKind === kind.toLowerCase() && row.lifecycle === 'draft',
            ).contentKey,
          kind,
        )
        await powerDialog
          .getByRole('textbox', { name: 'Name', exact: true })
          .fill(`Recovered ${kind}`)
        await powerDialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
        assert.deepEqual(
          await page.evaluate(
            () => window.__contentFixture.records.get('bastion').current.definition,
          ),
          before,
        )
        await page
          .getByRole('group', { name: 'Save content', exact: true })
          .getByRole('button', { name: 'Commit Now', exact: true })
          .click()
        await expect(
          workspace.getByRole('status', { name: 'Save status', exact: true }),
        ).toHaveText('Saved')
        assert.deepEqual(
          await page.evaluate(
            () => window.__contentFixture.records.get('bastion').current.definition,
          ),
          before,
        )
        await relationships
          .getByRole('button', { name: `Change power for ${label}`, exact: true })
          .click()
        selection = page.getByRole('dialog', { name: `Select power · ${label}`, exact: true })
        await selection.getByRole('combobox', { name: 'Power', exact: true }).selectOption(draftKey)
        await selection.getByRole('button', { name: 'Apply selection', exact: true }).click()
        await page
          .getByRole('group', { name: 'Save content', exact: true })
          .getByRole('button', { name: 'Commit Now', exact: true })
          .click()
        await expect(workspace.getByRole('alert')).toContainText(
          'Commit the power in its editor first',
        )
        await relationships
          .getByRole('button', { name: `Edit power for ${label}`, exact: true })
          .click()
        powerDialog = page.getByRole('dialog', { name: `Recovered ${kind}`, exact: true })
        await expect(powerDialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
          `Recovered ${kind}`,
        )
        await powerDialog.getByRole('button', { name: 'Commit Now', exact: true }).click()
        await expect(powerDialog.getByRole('status')).toContainText(
          'Changes committed and available to the game.',
        )
        await powerDialog.getByRole('button', { name: 'Close skill editor', exact: true }).click()
        const persisted = await page.evaluate(() =>
          structuredClone(window.__contentFixture.records.get('bastion').current.definition),
        )
        assert.equal(
          kind === 'Essence'
            ? persisted.essenceId
            : persisted.resonanceSelections.find(
                (row) => row.withDisciplineId === before.resonanceSelections[0].withDisciplineId,
              ).resonanceId,
          draftKey,
        )
        await page.reload()
        await expect(
          workspace.getByRole('status', { name: 'Save status', exact: true }),
        ).toHaveText('Saved')
        await expect(relationships).toContainText(`Recovered ${kind}`)
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        .toBe(true)
      assert.deepEqual(errors, [])
      await page.screenshot({
        path: resolve(output, 'content-' + scenario.label + '.png'),
        fullPage: true,
      })
      evidence.push({
        scenario: scenario.label,
        geometry,
        modalScroll,
        continuousRecords: 127,
        actorScopedRefresh: true,
        refreshDoesNotCommit: true,
        commitInFlight: true,
        rejectedCommitRetainsEdits: true,
        fullSkillModal: true,
        modalCloseRetainsEdits: true,
        masteryAndSkillCommit: true,
        replacementPreview: true,
        resonanceModal: true,
        associationChangeAndRemoval: true,
        authority:
          'Local transport fixture only; no SQL, permissions or hosted publication acceptance.',
      })
    } catch (error) {
      failures.push({ scenario: scenario.label, message: String(error) })
      console.error('CONTENT FAILURE', scenario.label, String(error))
      await page.screenshot({
        path: resolve(output, 'content-failure-' + scenario.label + '.png'),
        fullPage: true,
      })
    } finally {
      await context.close()
    }
  }
  await fs.writeFile(
    resolve(output, 'content-results.json'),
    JSON.stringify({ browser: browser.version(), evidence, failures }, null, 2),
  )
  console.log(JSON.stringify({ browser: browser.version(), evidence, failures }))
  assert.deepEqual(failures, [])
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
