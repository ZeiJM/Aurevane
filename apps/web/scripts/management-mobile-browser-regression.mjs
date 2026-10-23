// Render production management panels with production global CSS and authoritative-response fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/management-mobile-browser-regression.mjs
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const require = createRequire(import.meta.url)
const { createServer } = await import(
  pathToFileURL(require.resolve('vite', { paths: [require.resolve('vitest')] }))
)
const { chromium } = require(
  require.resolve('playwright', { paths: [require.resolve('@playwright/test')] }),
)
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(web, '../..')
const h = await fs.mkdtemp(resolve(tmpdir(), 'discipline-management-'))
const output = process.env.AV_DISCIPLINE_EVIDENCE_DIR || resolve(h, 'evidence')
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-harness.jsx'),
  resolve(h, 'discipline.jsx'),
)
await fs.writeFile(
  resolve(h, 'entry.jsx'),
  `
if(new URLSearchParams(location.search).get('profilePanel') === 'disciplines') await import('./discipline.jsx');
else await import('./skills.jsx');
`,
)
await fs.writeFile(
  resolve(h, 'skills.jsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CharacterSkillBuildPanel} from '@/components/character/character-skill-build-panel';
import {latestEnabledMatureSkills} from '@aurevane/game-core/combat/mature-skills';
import './production-styles';
const learned = latestEnabledMatureSkills().filter(d=>['vanguard','lifebinder'].includes(d.sourceDisciplineId)).map(definition=>({definition,activeSource:true,learnedAt:'earned'}));
window.calls=[];
window.fetch=async (url,options)=>{
 const payload=JSON.parse(options.body); window.calls.push(payload);
 return new Response(JSON.stringify({context:{build:{buildVersion:2,supportActionId:payload.supportActionId??'basic.guard'},disciplineSkills:{capacity:4,learnedSkills:learned,equippedSkills:(payload.skillIds??[]).map((id,slotIndex)=>({definition:learned.find(e=>e.definition.id===id).definition,slotIndex,equippedAt:'now'}))}}}));
};
createRoot(document.getElementById('root')).render(<CharacterSkillBuildPanel characterId="character-a" initialBuildVersion={1} primaryDiscipline={{id:'vanguard',name:'Vanguard'}} secondaryDiscipline={{id:'lifebinder',name:'Lifebinder'}} initialCapacity={4} initialLearnedSkills={learned} initialEquippedSkills={[]} initialResonance={null} initialEssence={null}/>);
`,
)

await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(h, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(h, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/entry.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(h, 'production-styles.js'),
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
const server = await createServer({
  configFile: false,
  root: h,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/image': resolve(h, 'next-mock.jsx'),
      'next/navigation': resolve(h, 'next-mock.jsx'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root, h] } },
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
const checks = []
await fs.mkdir(output, { recursive: true })
try {
  for (const [width, height] of [
    [390, 844],
    [320, 740],
    [430, 932],
    [760, 650],
    [844, 390],
    [1366, 768],
  ]) {
    const landscapePhone = width <= 980 && height <= 480
    const mobile = width <= 820 || landscapePhone
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: mobile,
      isMobile: mobile,
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => errors.push(error.message))
    for (const panel of process.env.AV_MANAGEMENT_PANEL
      ? [process.env.AV_MANAGEMENT_PANEL]
      : ['disciplines', 'techniques']) {
      await page.goto(server.resolvedUrls.local[0] + '?profilePanel=' + panel)
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      if (panel === 'disciplines')
        await page.waitForFunction(
          () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
        )
      await page.evaluate(async () => {
        await document.fonts.ready
        await Promise.all([...document.images].map((i) => i.decode().catch(() => {})))
      })
      const before = await dialog.evaluate((node) => {
        const rect = (e) => e.getBoundingClientRect().toJSON()
        const roster = node.querySelector('[aria-label$="Discipline library"]')
        const preview = node.querySelector('[data-testid="technique-preview"]')
        return {
          dialog: rect(node),
          overflow: node.scrollWidth - node.clientWidth,
          documentOverflow: document.documentElement.scrollWidth - innerWidth,
          ...(roster
            ? {
                primary: rect(node.querySelector('[aria-label="Edit Primary Discipline"]')),
                secondary: rect(node.querySelector('[aria-label="Edit Secondary Discipline"]')),
                roster: rect(roster),
                rosterScroll: roster.scrollHeight - roster.clientHeight,
                preview: rect(node.querySelector('[data-testid="primary-build-preview"]')),
                summaryContainsContent: [
                  ...node.querySelector('article').querySelectorAll('header,strong,small'),
                ].every(
                  (e) =>
                    e.getBoundingClientRect().bottom <=
                    node.querySelector('article').getBoundingClientRect().bottom + 1,
                ),
              }
            : {
                preview: rect(preview),
                images: preview.querySelectorAll('img').length,
                report: rect(preview.querySelector('dl')),
                heading: rect(preview.querySelector('section > div > div')),
                list: rect(node.querySelector('[data-testid="learned-skill-list"]')),
                art: rect(node.querySelector('[data-technique-art]')),
              }),
        }
      })
      await page.screenshot({ path: output + '/' + panel + '-' + width + 'x' + height + '.png' })
      assert.ok(before.overflow <= 1 && before.documentOverflow <= 1, JSON.stringify(before))
      assert.ok(before.dialog.y >= -1 && before.dialog.bottom <= height + 1, JSON.stringify(before))
      if (panel === 'disciplines' && (width <= 760 || landscapePhone)) {
        assert.ok(
          Math.abs(before.primary.y - before.secondary.y) <= 1,
          'selected Discipline slots must share one frozen row: ' + JSON.stringify(before),
        )
        assert.ok(before.rosterScroll > 0, 'middle Discipline library must own its scrolling')
        assert.ok(
          before.summaryContainsContent,
          'committed preview must not compress its content into Change Impact',
        )
        assert.ok(
          before.roster.bottom <= before.preview.y + 1,
          'library must not overlap bottom preview',
        )
        await dialog
          .locator('[aria-label$="Discipline library"]')
          .evaluate((n) => (n.scrollTop = n.scrollHeight))
        const after = await dialog
          .getByRole('button', { name: 'Edit Primary Discipline', exact: true })
          .boundingBox()
        assert.ok(
          Math.abs(after.y - before.primary.y) <= 1,
          'committed Discipline row stays frozen',
        )
        await dialog.getByRole('button', { name: 'Edit Secondary Discipline', exact: true }).click()
        await dialog.getByRole('button', { name: 'Remove Secondary Discipline' }).click()
        await page
          .getByRole('status')
          .filter({ hasText: 'Discipline changes committed.' })
          .waitFor()
        assert.match(
          await dialog
            .getByRole('button', { name: 'Edit Secondary Discipline', exact: true })
            .innerText(),
          /None/,
        )
      }
      if (panel === 'techniques') {
        assert.equal(before.images, 0, 'Technique preview must not duplicate chooser images')
        assert.ok(
          before.heading.height > 0 && before.heading.bottom <= before.report.y + 1,
          'preview heading must not overlap mechanical report: ' + JSON.stringify(before),
        )
        for (const field of [
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
        ])
          assert.equal(
            await dialog.getByTestId('technique-preview').getByText(field, { exact: true }).count(),
            1,
            field,
          )
        if (mobile) {
          assert.ok(
            before.art.width <= 44,
            'mobile choices should use compact art: ' + JSON.stringify(before),
          )
          assert.ok(
            before.preview.height >= height * 0.42,
            'frozen preview needs more room: ' + JSON.stringify(before),
          )
          assert.ok(before.list.bottom <= before.preview.y + 1, 'chooser must not overlap preview')
          const equip = dialog.getByRole('button', { name: 'Equip technique', exact: true })
          await equip.click()
          await dialog.getByRole('button', { name: 'Remove from loadout', exact: true }).waitFor()
          assert.equal(await page.evaluate(() => window.calls.length), 1)
          const rail = dialog.getByTestId('technique-preview')
          await rail.evaluate((n) => (n.scrollTop = n.scrollHeight))
          await dialog.getByRole('button', { name: 'Remove from loadout', exact: true }).click()
          await equip.waitFor()
          assert.equal(await page.evaluate(() => window.calls.length), 2)
          await dialog.getByRole('radio', { name: 'HP Recovery', exact: true }).click()
          const useSupport = dialog.getByRole('button', { name: 'Use as Support Action' })
          await useSupport.waitFor()
          assert.equal(await rail.locator('img').count(), 0)
          await useSupport.click()
          await dialog.getByRole('button', { name: '✓ Current Support Action' }).waitFor()
          assert.equal(await page.evaluate(() => window.calls.length), 3)
        } else {
          await dialog.getByRole('checkbox').first().click()
          await page
            .getByRole('status')
            .filter({ hasText: 'Techniques saved automatically.' })
            .waitFor()
          await dialog.getByRole('button', { name: 'Clear Selections' }).click()
          await page.getByRole('status').filter({ hasText: 'Selections cleared.' }).waitFor()
          assert.equal(await page.evaluate(() => window.calls.length), 2)
        }
      }
      checks.push({ panel, width, height, ...before })
    }
    await context.close()
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(
    output + '/management-mobile-results.json',
    JSON.stringify({ checks, errors }, null, 2),
  )
  console.log(JSON.stringify({ checks: checks.length, output, errors }))
} finally {
  await browser.close()
  await server.close()
}
