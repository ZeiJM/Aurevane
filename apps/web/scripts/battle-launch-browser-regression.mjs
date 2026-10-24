// Mount the production Battle Hall and styles; no account or battle writes are needed.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-launch-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-launch-'))
const output = process.env.AV_HALL_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-launch-harness.jsx'),
  resolve(fixture, 'entry.jsx'),
)
await fs.copyFile(
  resolve(web, 'e2e/fixtures/discipline-management-navigation.jsx'),
  resolve(fixture, 'next-mock.jsx'),
)
await fs.writeFile(
  resolve(fixture, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>#root{width:calc(100% - 112px);height:calc(100dvh - 120px);margin:60px auto}@media(max-width:760px){#root{width:calc(100% - 24px);height:calc(100dvh - 24px);margin:12px auto}}</style></head><body><main id="root"></main><script type="module" src="/entry.jsx"></script></body></html>',
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
  resolve(fixture, 'lobby.html'),
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/lobby.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'lobby.jsx'),
  `import React from 'react';
import {createRoot} from 'react-dom/client';
import {PvpLobbyModal} from '@/components/battle/pvp-lobby-modal';
import {STARTER_CHARACTER_PORTRAITS} from '@aurevane/game-core/character/starter-options';
import './production-styles';
const mode=new URLSearchParams(location.search).get('mode')??'1v1';const sizes=mode==='1v1v1'?[1,1,1]:mode==='3v3'?[3,3,0]:mode==='2v2'?[2,2,0]:[1,1,0];
const lobby={lobbyId:'fixture-lobby',lobbyKey:'AVL-FIXTURE',mode,ownerUserId:'host',teamSizes:sizes,status:'waiting',battleSessionId:null,battleKey:null,readyToStart:false,members:[{userId:'host',characterId:'host',characterName:'Storm',characterLevel:1,portraitRef:STARTER_CHARACTER_PORTRAITS[0].ref,profileImageUrl:null,teamIndex:0,seatIndex:0,seated:true,ready:false,isHost:true}]};
window.fetch=async input=>Response.json(String(input).endsWith('/settings')?{settings:{mapSize:'medium',elevationBias:'neutral',terrainBias:'neutral',turnTimerSeconds:60}}:{lobby});
createRoot(document.getElementById('root')).render(<PvpLobbyModal initialLobby={lobby} localCharacterId="host" onLeave={()=>{}}/>);`,
)
await fs.writeFile(
  resolve(fixture, 'profile.html'),
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script type="module" src="/profile.jsx"></script></body></html>',
)
await fs.writeFile(
  resolve(fixture, 'profile.jsx'),
  `import React from 'react';import{createRoot}from'react-dom/client';
import{CharacterProfileDetails}from'@/components/character/character-profile-details';import{LoadoutHeader}from'@/components/character/loadout-header';import{calculateDerivedStats}from'@aurevane/game-core/character/derived-stats';import './production-styles';
const attributes={might:4,finesse:3,vitality:5,agility:5,intellect:10,resolve:9};
createRoot(document.getElementById('root')).render(<><LoadoutHeader active="nexus"/><CharacterProfileDetails presentationLabel="Masculine" buildTypeLabel="Resonance Build" cycleNumber={1} attributes={attributes} derived={calculateDerivedStats({attributes,level:1})}/></>);`,
)
await fs.writeFile(
  resolve(fixture, 'next-link.jsx'),
  `import React from 'react';export default function Link({prefetch,...props}){return <a {...props}/>}`,
)
const server = await createServer({
  configFile: false,
  root: fixture,
  publicDir: resolve(web, 'public'),
  resolve: {
    alias: {
      '@': resolve(web, 'src'),
      '@aurevane/game-core': resolve(root, 'packages/game-core/src'),
      '@aurevane/ui/styles.css': resolve(root, 'packages/ui/src/styles.css'),
      'next/image': resolve(fixture, 'next-mock.jsx'),
      'next/link': resolve(fixture, 'next-link.jsx'),
      'next/navigation': resolve(fixture, 'next-mock.jsx'),
      react: resolve(web, 'node_modules/react'),
      'react-dom': resolve(web, 'node_modules/react-dom'),
    },
  },
  esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root, fixture] } },
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
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const report = []
try {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1536, height: 614 },
    { width: 1100, height: 650 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 740 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(server.resolvedUrls.local[0])
    const allies = page.getByLabel('AI sparring allies')
    const enemies = page.getByLabel('AI sparring enemies')
    await allies.waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(
      await page.getByLabel('AI sparring arena').locator('..').locator('span').innerText(),
      'Field',
    )
    const choices = page.locator('[data-hall-workspace="ai"] button[data-selected]')
    assert.equal(await choices.count(), 1)
    assert.equal(
      await choices.evaluate((element) => getComputedStyle(element).backgroundColor),
      'rgb(40, 86, 83)',
      'Selected Sparring choice uses a distinct teal highlight',
    )
    const geometry = await allies.evaluate((element) => {
      const arena = document.querySelector('[aria-label="AI sparring arena"]')
      const fieldset = element.closest('fieldset')
      const section = element.closest('[data-hall-workspace]')
      const rect = (node) => {
        const box = node.getBoundingClientRect()
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
      }
      return {
        arena: rect(arena),
        fieldset: rect(fieldset),
        controls: [...fieldset.querySelectorAll('select')].map((node) => ({
          ...rect(node),
          label: node.getAttribute('aria-label'),
          height: node.getBoundingClientRect().height,
          overflow: node.scrollWidth - node.clientWidth,
        })),
        labels: [...fieldset.querySelectorAll('label > span')].map((node) => ({
          ...rect(node),
          text: node.textContent,
          overflow: node.scrollWidth - node.clientWidth,
        })),
        overflow: [section, section.querySelector('[data-hall-scroll-body]')].map((node) => ({
          x: node.scrollWidth - node.clientWidth,
          y: node.scrollHeight - node.clientHeight,
        })),
      }
    })
    report.push({ viewport, ...geometry })
    const stem = `${viewport.width}x${viewport.height}`
    await page.screenshot({ path: resolve(output, `hall-${stem}.png`), fullPage: true })
    await fs.writeFile(resolve(output, 'geometry.json'), JSON.stringify(report, null, 2))
    for (const control of geometry.controls) {
      assert.ok(
        control.left >= geometry.arena.left - 1,
        `${stem}: ${control.label} begins within Arena select`,
      )
      assert.ok(
        control.right <= geometry.arena.right + 1,
        `${stem}: ${control.label} ends within Arena select`,
      )
      assert.ok(
        control.left >= geometry.fieldset.left,
        `${stem}: ${control.label} inside Participants`,
      )
      assert.ok(
        control.right <= geometry.fieldset.right,
        `${stem}: ${control.label} inside Participants`,
      )
      assert.ok(control.height >= 44, `${stem}: ${control.label} touch height`)
      assert.ok(control.overflow <= 1, `${stem}: ${control.label} no horizontal overflow`)
    }
    for (const label of geometry.labels) {
      assert.ok(
        label.left >= geometry.fieldset.left,
        `${stem}: ${label.text} label inside Participants`,
      )
      assert.ok(
        label.right <= geometry.fieldset.right,
        `${stem}: ${label.text} label inside Participants`,
      )
      assert.ok(label.overflow <= 1, `${stem}: ${label.text} label fully visible`)
    }
    for (const overflow of geometry.overflow) {
      assert.ok(overflow.x <= 1, `${stem}: no horizontal workspace scrolling`)
      if (viewport.width > 760)
        assert.ok(overflow.y <= 1, `${stem}: no vertical workspace scrolling`)
    }
    for (const count of [0, 1, 2]) {
      await allies.selectOption('0')
      await enemies.selectOption('5')
      await allies.selectOption(String(count))
      assert.equal(await enemies.inputValue(), String(5 - count))
      assert.equal(await enemies.locator('option').count(), 5 - count)
      assert.equal(1 + Number(await allies.inputValue()) + Number(await enemies.inputValue()), 6)
    }
    await page.getByRole('button', { name: 'Guided Fundamentals', exact: false }).click()
    assert.equal(await allies.count(), 0)
  }
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(server.resolvedUrls.local[0])
    await page.getByLabel('AI sparring arena').waitFor()
    for (const name of ['Sparring Yard', 'PVP', 'Arena Queue', 'Spectate']) {
      await page.getByRole('button', { name, exact: true }).click()
      const bounds = await page.locator('[data-hall-concept]').evaluate((hall) => {
        const rect = hall.getBoundingClientRect()
        return {
          top: rect.top,
          bottom: rect.bottom,
          headingHeight: hall.querySelector('header').getBoundingClientRect().height,
          overflowX: hall.scrollWidth - hall.clientWidth,
          overflowY: hall.scrollHeight - hall.clientHeight,
        }
      })
      const label = `${viewport.width}x${viewport.height} ${name}`
      assert.ok(bounds.headingHeight <= 90, `${label}: compact Hall heading`)
      assert.ok(bounds.top >= 0 && bounds.bottom <= viewport.height, `${label}: Hall fits viewport`)
      assert.ok(bounds.overflowX <= 1 && bounds.overflowY <= 1, `${label}: no outer Hall scrolling`)
      if (name === 'Sparring Yard') {
        const enter = page.getByRole('button', { name: 'Enter Battle', exact: true })
        await enter.scrollIntoViewIfNeeded()
        const box = await enter.boundingBox()
        assert.ok(box.y + box.height <= viewport.height, `${label}: Enter Battle reachable`)
      }
      if (name === 'PVP') {
        await page.getByRole('button', { name: 'Create Lobby', exact: true }).click()
        await page.getByRole('dialog').waitFor()
        assert.ok(await page.getByRole('button', { name: 'Close', exact: true }).isVisible())
        await page.getByRole('button', { name: 'Close', exact: true }).click()
      }
      if (name === 'Spectate')
        assert.ok(await page.getByLabel('Battle Key', { exact: true }).isVisible())
      await page.screenshot({
        path: resolve(
          output,
          `mobile-${viewport.width}-${name.replaceAll(' ', '-').toLowerCase()}.png`,
        ),
      })
    }
  }
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto(server.resolvedUrls.local[0] + '?screen=skill&profilePanel=techniques')
  const preview = page.getByTestId('technique-preview')
  await preview.waitFor()
  assert.equal(
    await preview.locator('small').first().innerText(),
    'Combatant steadies their blade for Forceful Strike.',
    'Nexus preview resolves authored flavor tokens with neutral identity',
  )
  assert.equal(await preview.locator('dt').count(), 10)
  assert.equal(await preview.getByLabel('Effect explanations').count(), 1)
  assert.doesNotMatch(await preview.innerText(), /Single target|Affects:/)
  await page.screenshot({ path: resolve(output, 'technique-neutral-flavor.png') })
  for (const mode of ['1v1', '2v2', '3v3', '1v1v1']) {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 390, height: 844 },
      { width: 320, height: 640 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto(server.resolvedUrls.local[0] + `lobby.html?mode=${mode}`)
      const dialog = page.getByRole('dialog')
      await dialog.waitFor()
      assert.equal(
        await dialog.getByRole('button', { name: /^(Hide )?Chat$/ }).count(),
        0,
        'Lobbies have no Chat button',
      )
      await dialog.getByRole('button', { name: /Mark Ready/ }).waitFor()
      await dialog.getByRole('button', { name: 'Close Lobby' }).waitFor()
      for (const emblem of await dialog.locator('[data-pvp-versus]').all()) {
        await emblem.scrollIntoViewIfNeeded()
        const { box, current, previous, modal } = await emblem.evaluate((n) => {
          const box = n.getBoundingClientRect(),
            current = n.parentElement.getBoundingClientRect(),
            previous = n.parentElement.previousElementSibling.getBoundingClientRect(),
            modal = n.closest('dialog').getBoundingClientRect()
          return {
            box: box.toJSON(),
            current: current.toJSON(),
            previous: previous.toJSON(),
            modal: modal.toJSON(),
          }
        })

        assert.ok(box.width >= 55, `${mode}/${viewport.width} VS is prominent: ${box.width}`)
        const wrapped = current.top >= previous.bottom - 1
        const expectedX = wrapped
          ? current.x + current.width / 2
          : (previous.right + current.left) / 2
        const expectedY = wrapped
          ? (previous.bottom + current.top) / 2
          : current.y + current.height / 2
        assert.ok(
          Math.abs(box.x + box.width / 2 - expectedX) <= 1 &&
            Math.abs(box.y + box.height / 2 - expectedY) <= 1,
          `${mode}/${viewport.width} VS centers on the formation seam: ${JSON.stringify({ box, current, previous, expectedX, expectedY })}`,
        )
        assert.ok(
          box.left >= modal.left &&
            box.right <= modal.right &&
            box.top >= modal.top &&
            box.bottom <= modal.bottom,
          `${mode}/${viewport.width} VS stays in lobby`,
        )
      }
      await page.screenshot({ path: resolve(output, `lobby-${mode}-${viewport.width}.png`) })
    }
  }
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto(server.resolvedUrls.local[0] + 'profile.html')
    await page.getByRole('navigation', { name: 'Arsenal sections' }).waitFor()
    assert.equal(
      await page.locator('[data-loadout-header] h1').count(),
      0,
      'Only the section switcher remains',
    )
    const fact = page.locator('[data-profile-fact]').filter({ hasText: 'Rekindling Cycle' })
    const centers = await fact.evaluate((e) => {
      const label = e.querySelector('small').getBoundingClientRect()
      const value = e.querySelector('strong').getBoundingClientRect()
      return {
        label: label.x + label.width / 2,
        value: value.x + value.width / 2,
        labelBottom: label.bottom,
        valueTop: value.top,
      }
    })
    assert.ok(
      Math.abs(centers.label - centers.value) <= 1 && centers.valueTop >= centers.labelBottom - 1,
      `Cycle is centered under its label: ${JSON.stringify(centers)}`,
    )
    await page.screenshot({ path: resolve(output, `profile-arsenal-${viewport.width}.png`) })
  }
  assert.deepEqual(errors, [])
  console.log(
    `Battle Hall: all 7 sizes keep Allies/Enemies within Arena; six-participant options preserved. Evidence: ${output}`,
  )
} finally {
  await browser.close()
  await server.close()
  await fs.rm(fixture, { recursive: true, force: true })
}
