// Exercise production PvE/PvP result renderers with committed-log API fixtures.
// Run: pnpm --filter @aurevane/web exec node scripts/battle-completion-fit-browser-regression.mjs
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
const fixture = await fs.mkdtemp(resolve(tmpdir(), 'battle-completion-fit-'))
const output = process.env.AV_COMPLETION_FIT_EVIDENCE_DIR || resolve(fixture, 'evidence')
await fs.mkdir(output, { recursive: true })
await fs.copyFile(
  resolve(web, 'e2e/fixtures/battle-completion-fit-harness.jsx'),
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
const viewports = [
  { width: 1366, height: 768 },
  { width: 1536, height: 614 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]
const scenarios = [
  ...['victory', 'defeat'].flatMap((result) =>
    ['recruit-sparring', 'guided-fundamentals', 'mastery-trial'].map((record) => ({
      mode: 'pve',
      result,
      record,
    })),
  ),
  ...['victory', 'defeat', 'draw'].map((result) => ({ mode: 'pvp', result })),
]
const receipts = []
const failures = []
const errors = []
const readGeometry = (overlay) =>
  overlay.evaluate((element) => {
    const box = (node) => {
      const rect = node.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        scrollTop: node.scrollTop,
      }
    }
    const panel = element.querySelector(':scope > section')
    const log = panel.querySelector('section[aria-label^="Committed"]')
    const footer = panel.querySelector('button[class*="primary"]').parentElement
    const chronicle = panel.querySelector('[data-battle-chronicle]')
    const firstAction = chronicle?.querySelector('[data-chronicle-action]')
    const logScrollers = log
      ? [log, ...log.querySelectorAll('*')].filter((node) => {
          const style = getComputedStyle(node)
          return /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1
        })
      : []
    return {
      viewport: { width: innerWidth, height: innerHeight },
      overlay: box(element),
      panel: box(panel),
      footer: box(footer),
      log: log ? box(log) : null,
      firstAction: firstAction ? box(firstAction) : null,
      seal: box(panel.querySelector('svg').parentElement),
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      logScrollers: logScrollers.map(box),
    }
  })
function checkFit(geometry, label, seal) {
  const checks = [
    [
      'overlay contains its content without scrolling',
      geometry.overlay.scrollHeight <= geometry.overlay.clientHeight + 1,
    ],
    [
      'result panel contains its content without scrolling',
      geometry.panel.scrollHeight <= geometry.panel.clientHeight + 1,
    ],
    [
      'opening log does not scroll result ancestors',
      geometry.overlay.scrollTop === 0 && geometry.panel.scrollTop === 0,
    ],
    [
      'no horizontal result overflow',
      geometry.panel.scrollWidth <= geometry.panel.clientWidth + 1 &&
        geometry.overlay.scrollWidth <= geometry.overlay.clientWidth + 1,
    ],
    [
      'panel fits viewport',
      geometry.panel.y >= -1 &&
        geometry.panel.y + geometry.panel.height <= geometry.viewport.height + 1,
    ],
    [
      'footer reachable without outer scroll',
      geometry.footer.y >= geometry.panel.y - 1 &&
        geometry.footer.y + geometry.footer.height <=
          Math.min(geometry.panel.y + geometry.panel.height, geometry.viewport.height) + 1,
    ],
    [
      'log is visible without outer scroll',
      geometry.log &&
        geometry.log.height >= 64 &&
        geometry.log.y >= geometry.panel.y - 1 &&
        geometry.log.y + geometry.log.height <=
          Math.min(geometry.panel.y + geometry.panel.height, geometry.viewport.height) + 1,
    ],
    ['log itself owns scrolling for long committed history', geometry.logScrollers.length > 0],
    [
      'result artwork dimensions preserved',
      geometry.seal.width >= seal.width - 0.5 && geometry.seal.height >= seal.height - 0.5,
    ],
  ]
  for (const [message, pass] of checks) if (!pass) failures.push(`${label}: ${message}`)
  receipts.push({
    label,
    geometry,
    failures: checks.filter(([, pass]) => !pass).map(([message]) => message),
  })
}
try {
  for (const viewport of viewports)
    for (const scenario of scenarios) {
      const label = `${scenario.mode}-${scenario.record || 'match'}-${scenario.result}-${viewport.width}x${viewport.height}`
      const page = await browser.newPage({
        viewport,
        isMobile: viewport.width < 821,
        hasTouch: viewport.width < 821,
      })
      page.setDefaultTimeout(5000)
      page.on('pageerror', (error) => errors.push(`${label}: ${error.message}`))
      try {
        await page.goto(server.resolvedUrls.local[0] + '?' + new URLSearchParams(scenario))
        const overlay = page.getByTestId(
          scenario.mode === 'pvp' ? 'pvp-battle-result-overlay' : 'battle-result-overlay',
        )
        await overlay.waitFor()
        const headline =
          scenario.record === 'guided-fundamentals' && scenario.result === 'victory'
            ? 'Training Complete'
            : scenario.result[0].toUpperCase() + scenario.result.slice(1)
        assert.equal(
          await overlay.locator(':scope > section > div').first().locator('h2').innerText(),
          headline,
        )
        const initial = await readGeometry(overlay)
        const review = overlay.getByRole('button', { name: 'Review Battle Log', exact: true })
        const returnButton = overlay.getByRole('button', {
          name: 'Return to Battle Hall',
          exact: true,
        })
        assert.equal(await returnButton.count(), 1)
        if (scenario.mode === 'pve') {
          assert.equal(
            await overlay
              .getByRole('button', {
                name:
                  scenario.record === 'guided-fundamentals'
                    ? 'Run Lesson Again'
                    : 'Rematch Recruit',
                exact: true,
              })
              .count(),
            1,
          )
          assert.match(
            await overlay
              .getByRole('definition')
              .allTextContents()
              .then((values) => values.join(' ')),
            /91\/142|0\/142/,
          )
          assert.match(
            await overlay.innerText(),
            scenario.record === 'mastery-trial'
              ? /up to 50 Primary Discipline Mastery XP/
              : /Practice grants no Character XP/,
          )
        }
        await review.click()
        const log = overlay.getByRole('region', {
          name:
            scenario.mode === 'pvp'
              ? 'Committed PvP battle log review'
              : 'Committed battle log review',
          exact: true,
        })
        await log.waitFor()
        await log.locator('[data-chronicle-action]').first().waitFor()
        assert.equal(
          await log.locator('[data-chronicle-action]').count(),
          60,
          'All committed actions retained in production Chronicle',
        )
        assert.match(await log.innerText(), /60 actions/i)
        assert.equal(
          await page.evaluate(
            () =>
              window.completionFixture.calls.filter((call) => call.url.endsWith('/events')).length,
          ),
          1,
        )
        checkFit(await readGeometry(overlay), `${label}-open`, initial.seal)
        await page.screenshot({ path: resolve(output, `${label}.png`), fullPage: true })
        // Exercise real internal log scrolling, with no ancestor movement.
        const scrolled = await log.evaluate((element) => {
          const nodes = [element, ...element.querySelectorAll('*')]
          const reader = nodes.find(
            (node) =>
              /auto|scroll/.test(getComputedStyle(node).overflowY) &&
              node.scrollHeight > node.clientHeight + 1,
          )
          if (!reader) return false
          reader.scrollTop = 0
          reader.scrollTop = Math.min(100, reader.scrollHeight - reader.clientHeight)
          return reader.scrollTop > 0
        })
        assert.equal(scrolled, true, 'Long log remains internally scrollable')
        checkFit(await readGeometry(overlay), `${label}-log-scrolled`, initial.seal)
        await page.evaluate(() => {
          window.completionFixture.failure = 'copy'
        })
        await overlay.getByRole('button', { name: 'Copy Full Log', exact: true }).click()
        await overlay.getByRole('status').filter({ hasText: 'Copy unavailable' }).waitFor()
        checkFit(await readGeometry(overlay), `${label}-copy-error`, initial.seal)
        await page.evaluate(() => {
          window.completionFixture.failure = null
        })
        await overlay.getByRole('button', { name: 'Copy Full Log', exact: true }).click()
        await overlay.getByRole('status').filter({ hasText: 'Full battle log copied' }).waitFor()
        const copied = await page.evaluate(() => window.completionFixture.copied.at(-1))
        assert.match(copied, /Wayfarer/)
        assert.match(copied, /Recruit/)
        assert.equal(
          copied.match(/Basic Attack/g)?.length,
          60,
          'Copy retains every committed action',
        )
        checkFit(await readGeometry(overlay), `${label}-copied`, initial.seal)
        if (scenario.record === 'mastery-trial' && scenario.result === 'victory') {
          await page.evaluate(() => {
            window.completionFixture.failure = 'mastery'
          })
          await overlay.getByRole('button', { name: 'Claim Mastery', exact: true }).click()
          await overlay.getByRole('alert').waitFor()
          checkFit(await readGeometry(overlay), `${label}-mastery-error`, initial.seal)
          await page.evaluate(() => {
            window.completionFixture.failure = null
          })
          await overlay.getByRole('button', { name: 'Claim Mastery', exact: true }).click()
          await overlay
            .getByRole('status')
            .filter({ hasText: '+50 Mastery XP · 450/1,000 XP' })
            .waitFor()
          assert.equal(
            await overlay.getByRole('button', { name: 'Claim Mastery', exact: true }).isDisabled(),
            true,
          )
          checkFit(await readGeometry(overlay), `${label}-mastery-claimed`, initial.seal)
        }
        await overlay.getByRole('button', { name: 'Hide Battle Log', exact: true }).click()
        assert.equal(await log.count(), 0)
        await returnButton.click()
        assert.equal(new URL(page.url()).pathname, '/game/battle', 'Return control remains usable')
      } catch (error) {
        failures.push(`${label}: ${error.stack || error.message}`)
        await page.screenshot({ path: resolve(output, `${label}-failure.png`), fullPage: true })
      } finally {
        await page.close()
      }
    }
  await fs.writeFile(
    resolve(output, 'completion-fit-geometry.json'),
    JSON.stringify({ receipts, failures, errors }, null, 2),
  )
  assert.deepEqual(errors, [], 'Production renderers have no browser errors')
  assert.deepEqual(failures, [], 'Completion result fits; only the log scrolls')
  console.log(
    `Completion-fit regression passed ${viewports.length * scenarios.length} production-renderer cases. Evidence: ${output}`,
  )
} finally {
  await browser.close()
  await server.close()
}
