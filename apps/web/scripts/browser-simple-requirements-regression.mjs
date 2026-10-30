// Production Master controls, native evaluator, serialized reload, and shared linked readers.
// Run: pnpm --filter @aurevane/web exec node scripts/browser-simple-requirements-regression.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'simple-requirements-browser-'))
const output =
  process.env.AV_SIMPLE_REQUIREMENTS_EVIDENCE_DIR ||
  resolve(tmpdir(), 'simple-requirements-browser-evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/simple-requirements-harness.jsx'),
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
// next/image is reached by AbilityEffectEditor → SummonProfileEditor → SkillMediaEditor.
// Next replaces these public build constants; this standalone Vite fixture must do so too.
// Keep real image components and never expose a process object or server environment.
const nextImageBrowserDefines = {
  'process.env.__NEXT_IMAGE_OPTS': 'undefined',
  'process.env.NEXT_DEPLOYMENT_ID': 'undefined',
  'process.env.NEXT_SUPPORTS_IMMUTABLE_ASSETS': 'false',
}
const config = {
  define: nextImageBrowserDefines,
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
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
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, hmr: false, watch: null, fs: { allow: [root, fixture] } },
  optimizeDeps: {
    include: ['react', 'react-dom/client'],
    rolldownOptions: { transform: { define: nextImageBrowserDefines } },
  },
}
if (process.env.AV_SIMPLE_REQUIREMENTS_COMPILE_ONLY === '1') {
  try {
    const built = await build({ ...config, build: { write: false, minify: false } })
    const chunks = (Array.isArray(built) ? built : [built])
      .flatMap((result) => result.output)
      .filter((chunk) => chunk.type === 'chunk')
    const processAccess = chunks.flatMap(
      (chunk) => chunk.code.match(/\bprocess\.env\.[A-Z_]+/g) ?? [],
    )
    assert.deepEqual(
      processAccess,
      [],
      'Standalone browser build must replace all reachable Next environment accesses',
    )
    console.log('Simple Requirements production fixture compilation passed.')
  } finally {
    await fs.rm(fixture, { recursive: true, force: true })
  }
} else {
  const server = await createServer(config)
  await server.listen()
  let browser
  const evidence = []
  const browserErrors = []
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
      browserErrors.push({ viewport, errors })
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await page.goto(server.resolvedUrls.local[0], { waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      const master = page.getByRole('region', { name: 'Master simple authoring', exact: true })
      const group = master.locator('[data-ability-group="simple-browser"]')
      const requirement = group.locator('[data-simple-requirements]').first()
      const tag = requirement.getByRole('combobox', { name: 'Requirement tag', exact: true })
      const target = requirement.getByRole('combobox', { name: 'Requirement target', exact: true })
      const percent = requirement.getByRole('spinbutton', {
        name: 'Requirement value (%)',
        exact: true,
      })
      const save = () =>
        master.getByRole('button', { name: 'Save definition JSON', exact: true }).click()
      const snapshot = () => page.evaluate(() => window.simpleRequirements.snapshot())
      const eligibility = (value) =>
        expect(page.locator('[data-native-eligible]')).toHaveAttribute(
          'data-native-eligible',
          String(value),
        )
      const readerNames = ['Nexus saved reader', 'Battle saved reader', 'Resonance saved reader']
      const requirementLine = (reader) =>
        reader
          .locator('dt')
          .filter({ hasText: /^Requirements$/ })
          .locator('xpath=following-sibling::dd[1]')
      async function assertReaders(text) {
        for (const name of readerNames) {
          const reader = page.getByRole('region', { name, exact: true })
          await expect(requirementLine(reader)).toContainText(text)
          await expect(requirementLine(reader)).not.toContainText(
            /event|action|Discipline|All conditions|Any condition/i,
          )
          const notes = reader.getByRole('list', { name: 'Requirement explanations' })
          if (text === 'None') {
            await expect(notes).toHaveCount(0)
          } else {
            const reference = requirementLine(reader).locator('[data-combat-tag-reference]').first()
            assert.equal(await reference.evaluate((node) => node.tagName), 'STRONG')
            assert.ok(
              Number(await reference.evaluate((node) => getComputedStyle(node).fontWeight)) >= 600,
            )
            await expect(notes).toContainText(await reference.innerText())
          }
        }
      }
      await expect(tag).toHaveValue('none')
      await expect(target).toHaveCount(0)
      await eligibility(true)
      await assertReaders('None')
      const options = await tag
        .locator('option')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({ value: node.value, text: node.textContent })),
        )
      for (const expected of [
        'None',
        'Burn',
        'Drenched',
        'Primed',
        'HP less than',
        'HP more than',
        'MP less than',
        'MP more than',
      ])
        assert.ok(
          options.some(({ text }) => text === expected),
          `${expected} is a finite requirement choice`,
        )
      assert.ok(
        !options.some(
          ({ value, text }) =>
            /^(all|any|action|event)$/.test(value) || /Discipline|action tag/i.test(text),
        ),
      )
      await expect(requirement.locator('input[type="text"], textarea')).toHaveCount(0)
      await expect(
        group.getByRole('combobox', { name: 'Required source Discipline', exact: true }),
      ).toHaveCount(0)
      await expect(
        group.getByRole('combobox', { name: 'Trigger module', exact: true }),
      ).toHaveCount(0)
      evidence.push({ viewport, case: 'finite tag palette and None', passed: true })

      for (const [id, label] of [
        ['hp-less-than', 'HP less than'],
        ['hp-more-than', 'HP more than'],
        ['mp-less-than', 'MP less than'],
        ['mp-more-than', 'MP more than'],
      ]) {
        await tag.selectOption(id)
        await target.selectOption('owner')
        await percent.fill('50')
        await save()
        await eligibility(false)
        await assertReaders(`${label} [50%] [Self]`)
        const saved = (await snapshot()).saved.behaviors[0].requirements
        assert.deepEqual(saved, {
          kind: 'resource-state',
          subject: 'owner',
          resource: id.slice(0, 2),
          comparison: id.endsWith('less-than') ? 'less-than' : 'more-than',
          basisPoints: 5000,
        })
        await percent.fill(id.endsWith('less-than') ? '50.01' : '49.99')
        await save()
        await eligibility(true)
        await percent.fill('50')
        await target.selectOption('selected')
        await save()
        await eligibility(id.endsWith('less-than'))
        await assertReaders(`${label} [50%] [Target]`)
        evidence.push({
          viewport,
          case: `${id} strict equality and genuine target resource`,
          passed: true,
        })
      }
      await target.selectOption('owner')
      await percent.fill('0')
      await save()
      assert.equal((await snapshot()).saved.behaviors[0].requirements.basisPoints, 0)
      await percent.fill('100')
      await save()
      assert.equal((await snapshot()).saved.behaviors[0].requirements.basisPoints, 10000)
      await expect(percent).toHaveAttribute('min', '0')
      await expect(percent).toHaveAttribute('max', '100')
      for (const invalid of ['-1', '101', '50.001']) {
        await percent.fill(invalid)
        await save()
        assert.equal((await snapshot()).saved.behaviors[0].requirements.basisPoints, 10000)
      }
      await percent.fill('40.5')
      await save()
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      await expect(percent).toHaveValue('40.5')
      await assertReaders('MP more than [40.5%] [Self]')
      const nexus = page.getByRole('region', { name: readerNames[0], exact: true })
      await nexus.getByRole('button', { name: 'Explain MP more than', exact: true }).click()
      const popup = page.getByRole('dialog')
      await expect(popup).toContainText(/strictly/)
      const box = await popup.boundingBox()
      assert.ok(
        box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= viewport.width + 1 &&
          box.y + box.height <= viewport.height + 1,
      )
      await page.screenshot({ path: resolve(output, `linked-requirement-${viewport.width}.png`) })
      await page.keyboard.press('Escape')
      await expect(popup).toHaveCount(0)
      evidence.push({
        viewport,
        case: '0–100 percentage bounds and serialized reload with linked strict explanation',
        passed: true,
      })

      await tag.selectOption('primed')
      await save()
      await eligibility(false)
      await page.getByRole('button', { name: 'Prime Controlled skill', exact: true }).click()
      await eligibility(true)
      await assertReaders('Primed [Self]')
      await page.getByRole('button', { name: 'Cancel prime', exact: true }).click()
      await eligibility(false)
      await target.selectOption('selected')
      await save()
      await page.getByRole('button', { name: 'Prime Controlled skill', exact: true }).click()
      await eligibility(false)
      await page.getByRole('button', { name: 'Cancel prime', exact: true }).click()
      evidence.push({
        viewport,
        case: 'Primed reflects genuine native Controlled state and selected unit',
        passed: true,
      })

      await tag.selectOption('wet')
      await save()
      await assertReaders('Drenched [Target]')
      for (const name of readerNames)
        await expect(
          page
            .getByRole('region', { name, exact: true })
            .locator('[data-combat-tag-reference="wet"]'),
        ).toHaveCount(1)
      const firstEffect = group.locator('[data-ability-effect="hit"]')
      await expect(
        firstEffect.getByRole('combobox', { name: 'Requirement tag', exact: true }),
      ).toHaveCount(0)
      // Seed an old saved definition, then exercise the actual editor's explicit migration.
      const legacy = structuredClone((await snapshot()).saved)
      legacy.behaviors[0].requirements = null
      legacy.behaviors[0].effects[0].requirements = {
        kind: 'status-presence',
        subject: 'owner',
        statusId: 'wet',
        present: true,
      }
      await page.evaluate((definition) => {
        localStorage.setItem('simple-requirements-native-definition', JSON.stringify(definition))
      }, legacy)
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      const retained = group.locator('[data-legacy-effect-requirements]')
      await expect(retained).toContainText('Drenched [Self]')
      await openEffectParameters(firstEffect)
      await firstEffect.getByRole('spinbutton', { name: 'Healing amount', exact: true }).fill('2')
      await save()
      assert.deepEqual(
        (await snapshot()).saved.behaviors[0].effects[0].requirements,
        legacy.behaviors[0].effects[0].requirements,
      )
      await retained
        .getByRole('button', { name: 'Apply matching conditions to whole ability', exact: true })
        .click()
      await save()
      await expect(retained).toHaveCount(0)
      const promoted = (await snapshot()).saved.behaviors[0]
      assert.deepEqual(promoted.requirements, legacy.behaviors[0].effects[0].requirements)
      assert.equal(promoted.effects[0].requirements, undefined)
      await assertReaders('Drenched [Self]')
      evidence.push({
        viewport,
        case: 'Legacy predicates survive unrelated edits and move to whole-ability Requirements only explicitly',
        passed: true,
      })

      const shape = group.getByRole('combobox', { name: 'Shape', exact: true })
      const recipient = firstEffect.getByRole('combobox', { name: 'Target', exact: true })
      await recipient.selectOption('enemy')
      for (const nextShape of ['circle', 'line']) {
        await shape.selectOption(nextShape)
        await expect(target).toHaveValue('owner')
        assert.deepEqual((await snapshot()).validationIssues, [])
        await save()
        const geometrySaved = (await snapshot()).saved.behaviors[0]
        assert.equal(geometrySaved.targeting.shape.kind, nextShape)
        assert.equal(geometrySaved.effects[0].payload.target, 'enemy')
        assert.deepEqual(geometrySaved.requirements, {
          kind: 'status-presence',
          subject: 'owner',
          statusId: 'wet',
          present: true,
        })
        assert.equal(geometrySaved.effects[0].requirements, undefined)
      }
      // The first-tab Target choice must have an explicit, executable authoring path.
      const areaBeforeUnitAim = (await snapshot()).draft.behaviors[0]
      // Playwright’s generic enabled state does not inspect native option.disabled.
      await expect(target.locator('option[value="selected"]')).toHaveJSProperty('disabled', true)
      await group
        .getByRole('combobox', { name: 'Target Requirement aim', exact: true })
        .selectOption('enemy')
      await expect(target).toHaveValue('selected')
      await expect(shape).toHaveValue('single')
      assert.deepEqual((await snapshot()).validationIssues, [])
      await save()
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      const unitAimSaved = (await snapshot()).saved.behaviors[0]
      assert.equal(unitAimSaved.requirements.subject, 'selected')
      assert.equal(unitAimSaved.targeting.kind, 'unit')
      assert.equal(unitAimSaved.targeting.shape.kind, 'single')
      assert.deepEqual(unitAimSaved.targeting.categories, ['enemy'])
      assert.deepEqual(unitAimSaved.effects, areaBeforeUnitAim.effects)
      await expect(target.locator('option[value="selected"]')).toHaveJSProperty('disabled', false)
      await assertReaders('Drenched [Target]')
      evidence.push({
        viewport,
        case: 'Explicit Single-unit Target Requirement survives save/reload and shared Skill/Battle/Resonance readers without rewriting effects',
        passed: true,
      })
      await target.selectOption('owner')
      await shape.selectOption('single')
      await recipient.selectOption('all')
      await save()
      const globalSaved = (await snapshot()).saved.behaviors[0]
      assert.equal(globalSaved.effects[0].payload.target, 'all')
      assert.equal(globalSaved.targeting.shape.kind, 'single')
      await expect(shape).toHaveCount(0)
      assert.deepEqual((await snapshot()).validationIssues, [])
      evidence.push({
        viewport,
        case: 'Circle/Line and All effects retain the first-tab whole-ability Requirement',
        passed: true,
      })

      await recipient.selectOption('enemy')
      await recipient.selectOption('self')
      await save()
      const actorSaved = (await snapshot()).saved.behaviors[0]
      assert.equal(actorSaved.effects[0].payload.recipient, 'actor')
      assert.equal(actorSaved.effects[0].requirements, undefined)
      await expect(target).toHaveValue('owner')
      await assertReaders('Drenched [Self]')
      for (const name of readerNames) {
        const reader = page.getByRole('region', { name, exact: true })
        await expect(requirementLine(reader)).not.toContainText('[Target]')
        await expect(reader.getByRole('list', { name: 'Effect explanations' })).not.toContainText(
          'Applies only when',
        )
      }
      await recipient.selectOption('enemy')
      await save()
      evidence.push({
        viewport,
        case: 'Self recovery uses the first-tab whole-ability Requirement with no tag-dependent condition authoring',
        passed: true,
      })

      await group
        .getByRole('combobox', { name: 'Group activation', exact: true })
        .selectOption('automatic')
      const activation = group.getByRole('combobox', { name: 'Automatic activation', exact: true })
      await expect(activation).toHaveValue('requirements-met')
      await save()
      assert.equal((await snapshot()).saved.behaviors[0].automaticTrigger, 'requirements-met')
      assert.deepEqual((await snapshot()).validationIssues, [])
      assert.ok((await activation.locator('option').allTextContents()).includes('Damage Taken'))
      await activation.selectOption('damage-taken')
      const automaticTarget = group.getByRole('combobox', {
        name: 'Automatic target subject',
        exact: true,
      })
      await expect(automaticTarget).toHaveValue('selected')
      await automaticTarget.selectOption('triggering')
      await tag.selectOption('burn')
      await target.selectOption('triggering')
      await group.getByRole('checkbox', { name: 'Once per action', exact: true }).check()
      await group.getByRole('checkbox', { name: 'Once per round', exact: true }).check()
      await save()
      let saved = (await snapshot()).saved.behaviors[0]
      assert.equal(saved.automaticTrigger, 'damage-taken')
      assert.deepEqual(saved.automaticTarget, { subject: 'triggering' })
      assert.deepEqual([...saved.activationLimits].sort(), ['once-per-action', 'once-per-round'])
      assert.deepEqual((await snapshot()).validationIssues, [])
      assert.deepEqual(saved.requirements, {
        kind: 'status-presence',
        subject: 'triggering',
        statusId: 'burn',
        present: true,
      })
      await assertReaders('Burn [Target]')
      for (const name of readerNames.slice(0, 2)) {
        const reader = page.getByRole('region', { name, exact: true })
        await expect(reader).toContainText('Automatic: Damage Taken')
        await expect(reader.getByRole('list', { name: 'Usage limits' })).toContainText(
          'Once per round',
        )
      }
      const resonance = page.getByRole('region', { name: readerNames[2], exact: true })
      await expect(resonance).not.toContainText('Automatic:')
      await expect(resonance.getByRole('list', { name: 'Usage limits' })).toHaveCount(0)
      await expect(resonance.getByRole('list', { name: 'Effect explanations' })).toBeVisible()
      await resonance.screenshot({
        path: resolve(output, `resonance-passive-${viewport.width}.png`),
      })
      await activation.selectOption('turn-started')
      await expect(target.locator('option')).toHaveCount(1)
      await expect(target).toHaveValue('owner')
      await activation.selectOption('damage-taken')
      await target.selectOption('triggering')
      await save()
      evidence.push({
        viewport,
        case: 'finite activation and limits remain programmable without redundant Resonance notes',
        passed: true,
      })

      await group
        .getByRole('combobox', { name: 'New effect', exact: true })
        .selectOption('conditional-cleanse')
      await group.getByRole('button', { name: 'Add new effect', exact: true }).click()
      const cleanse = group.locator('[data-ability-effect]').last()
      await openEffectParameters(cleanse)
      await expect(cleanse).toContainText('Conditional Cleanse')
      await expect(
        cleanse.getByRole('combobox', { name: 'Status removal mode', exact: true }),
      ).toHaveValue('specified')
      const statuses = cleanse.getByRole('listbox', {
        name: 'Conditional Cleanse statuses',
        exact: true,
      })
      await expect(statuses).toHaveValues(['burn'])
      await statuses.selectOption(['burn', 'wet'])
      assert.ok((await statuses.locator('option').allTextContents()).includes('Drenched'))
      await expect(cleanse.getByRole('textbox', { name: 'Status IDs', exact: true })).toHaveCount(0)
      await save()
      saved = (await snapshot()).saved.behaviors[0]
      const cleansePayload = saved.effects.at(-1).payload
      // Native multi-select returns DOM order; specified removal checks set membership.
      assert.deepEqual(
        { ...cleansePayload, statusIds: [...cleansePayload.statusIds].sort() },
        {
          type: 'remove-status',
          recipient: 'primary-unit',
          removalMode: 'specified',
          statusIds: ['burn', 'wet'],
        },
      )
      const encodedBeforeReload = JSON.stringify((await snapshot()).saved)
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      await openEffectParameters(cleanse)
      await expect
        .poll(() =>
          statuses.evaluate((node) =>
            [...node.selectedOptions].map((option) => option.value).sort(),
          ),
        )
        .toEqual(['burn', 'wet'])
      await expect(activation).toHaveValue('damage-taken')
      assert.equal(JSON.stringify((await snapshot()).saved), encodedBeforeReload)
      await assertReaders('Burn [Target]')
      await page.screenshot({
        path: resolve(output, `simple-master-${viewport.width}.png`),
        fullPage: true,
      })
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        `No overflow at ${viewport.width}`,
      )
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        case: 'Conditional Cleanse specified Burn and Drenched survives JSON reload',
        passed: true,
        errors,
      })
      // The read-only Kamehameha mechanics: adding an element must produce a saveable beam.
      const beam = (await snapshot()).saved
      beam.behaviors = [
        {
          id: 'simple-browser',
          activation: 'manual',
          mode: 'action',
          classification: 'attack',
          attackFamily: 'physical',
          costs: [
            { resource: 'ap', amount: 40 },
            { resource: 'hp', amount: 20 },
            { resource: 'mp', amount: 20 },
          ],
          cooldown: { key: 'beam', ownerTurns: 1 },
          requirementMode: 'simple',
          requirements: {
            kind: 'status-presence',
            subject: 'owner',
            statusId: 'inspired',
            present: true,
          },
          targeting: {
            geometryVersion: 2,
            kind: 'unit',
            teamPolicy: 'enemy',
            friendlyFire: 'enemies-only',
            shape: { kind: 'line', length: 5 },
            minimumRange: 0,
            maximumRange: 5,
            maximumSelections: 1,
            maximumElevationDifference: 3,
            requiresLineOfSight: false,
          },
          effects: [
            {
              id: 'hit',
              payload: {
                type: 'damage',
                recipient: 'affected-units',
                amount: 20,
                durationTurns: 0,
              },
            },
          ],
        },
      ]
      await page.evaluate(
        (definition) =>
          localStorage.setItem('simple-requirements-native-definition', JSON.stringify(definition)),
        beam,
      )
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      await openEffectParameters(firstEffect)
      for (const element of ['ice', 'water', 'storm', 'fire', '']) {
        await firstEffect
          .getByRole('combobox', { name: 'Element', exact: true })
          .selectOption(element)
        assert.deepEqual((await snapshot()).validationIssues, [])
        await save()
        const editedBeam = (await snapshot()).saved.behaviors[0]
        assert.equal(editedBeam.effects.length, element ? 2 : 1)
        assert.deepEqual(editedBeam.targeting, beam.behaviors[0].targeting)
        assert.deepEqual(editedBeam.costs, beam.behaviors[0].costs)
      }
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForFunction(() => Boolean(window.simpleRequirements))
      assert.deepEqual((await snapshot()).validationIssues, [])
      assert.equal((await snapshot()).saved.behaviors[0].effects.length, 1)
      assert.deepEqual(errors, [])
      evidence.push({
        viewport,
        case: 'Beam element changes add/delete required companion tags and save/reload without clearing costs or geometry',
        passed: true,
      })
      await page.close()
    }
    await fs.writeFile(resolve(output, 'results.json'), JSON.stringify(evidence, null, 2))
    console.log(
      `Simple Requirements browser regression passed (${evidence.length} cases). Evidence: ${output}`,
    )
  } catch (error) {
    console.error('Simple Requirements browser errors:', JSON.stringify(browserErrors))
    await fs.writeFile(
      resolve(output, 'failure.json'),
      JSON.stringify(
        {
          error: error.message,
          completedCases: evidence,
          browserErrors,
          browserAssertionsCompleted: evidence.length,
        },
        null,
        2,
      ),
    )
    throw error
  } finally {
    await browser?.close()
    await server.close()
    await fs.rm(fixture, { recursive: true, force: true })
  }
}
