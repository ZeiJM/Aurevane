// Mount the production Discipline Management component without a database or Next server.
// Run: pnpm --filter @aurevane/web exec node scripts/discipline-management-browser-regression.mjs
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
  resolve(h, 'entry.jsx'),
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
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } })
const url = server.resolvedUrls.local[0]
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
try {
  const dialog = page.getByRole('dialog', { name: 'Discipline Management' })
  const primary = page.getByRole('button', { name: 'Edit Primary Discipline', exact: true })
  const secondary = page.getByRole('button', { name: 'Edit Secondary Discipline', exact: true })
  const choice = (name, slot = 'Primary') =>
    page.getByRole('button', { name: `Select ${name} as ${slot} Discipline`, exact: true })
  const impact = page.getByRole('complementary', { name: 'Change Impact' })
  const committed = () =>
    page.getByRole('status').filter({ hasText: 'Discipline changes committed.' }).waitFor()
  const methods = () =>
    page.evaluate(() =>
      window.calls.filter((call) => call.method !== 'GET').map((call) => call.method),
    )
  const reset = async () => {
    await page.goto(url + '?profilePanel=disciplines')
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Close', exact: true }).waitFor()
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
    )
  }
  const checks = []
  const check = async (name, action) => {
    await reset()
    await action()
    checks.push(name)
  }

  await page.goto(url + '?profilePanel=disciplines&holdGet')
  await dialog.waitFor()
  await page.waitForFunction(() => window.calls.some((c) => c.method === 'GET'))
  assert.equal(await primary.isDisabled(), true)
  assert.equal(await choice('Aetherist').isDisabled(), true)
  assert.match(await dialog.innerText(), /Refreshing committed Disciplines/)
  assert.deepEqual(await methods(), [])
  await page.evaluate(() => {
    window.hold = false
    window.release()
  })
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
  )
  checks.push('mounted-open synchronization blocks writes before authority is loaded')
  await check('immediate authoritative commit, version, identity and impact', async () => {
    assert.equal(await dialog.getByRole('button', { name: 'Confirm Change' }).count(), 0)
    assert.equal(await dialog.locator('article').count(), 1)
    assert.equal(await dialog.locator('aside').count(), 1)
    await page.evaluate(() => (window.buildVersion = 12))
    await choice('Aetherist').click()
    await committed()
    assert.deepEqual(await methods(), ['POST', 'PUT'])
    const payload = await page.evaluate(
      () => window.calls.find((call) => call.method === 'PUT').payload,
    )
    assert.equal(payload.expectedBuildVersion, 12)
    assert.equal(payload.expectedCharacterId, 'character-a')
    assert.match(payload.idempotencyKey, /^[a-f0-9-]{36}$/)
    assert.equal('secondaryDisciplineId' in payload, false)
    assert.match(await primary.innerText(), /Aetherist/)
    const text = await impact.innerText()
    assert.match(text, /Last successful change/)
    assert.match(text, /7 → 2/)
    assert.match(text, /Intellect/)
    assert.match(text, /3 → 10/)
    assert.match(text, /6 → 9/)
    await secondary.click()
    assert.match(await dialog.innerText(), /Selected Secondary/)
    assert.equal(await secondary.getAttribute('aria-pressed'), 'true')
    assert.equal(await primary.getAttribute('aria-pressed'), 'false')
    assert.equal(await impact.innerText(), text)
    await primary.click()
    await choice('Aetherist').click()
    assert.deepEqual(await methods(), ['POST', 'PUT'])
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await page.getByRole('button', { name: /Manage Disciplines/ }).click()
    assert.doesNotMatch(await impact.innerText(), /Last successful/)
    assert.match(await primary.innerText(), /Aetherist/)
  })
  for (const editedSlot of ['Primary', 'Secondary'])
    await check(
      `concurrent untouched ${editedSlot === 'Primary' ? 'Secondary' : 'Primary'} change is preserved`,
      async () => {
        if (editedSlot === 'Primary') {
          await page.evaluate(() => {
            window.secondary = 'shadehand'
            window.buildVersion = 9
          })
          await choice('Aetherist').click()
        } else {
          await secondary.click()
          await page.evaluate(() => {
            window.primary = 'aetherist'
            window.buildVersion = 9
          })
          await choice('Farstrider', 'Secondary').click()
        }
        await committed()
        assert.equal(await page.evaluate(() => window.primary), 'aetherist')
        assert.equal(
          await page.evaluate(() => window.secondary),
          editedSlot === 'Primary' ? 'shadehand' : 'farstrider',
        )
        assert.match(await primary.innerText(), /Aetherist/)
        assert.match(
          await secondary.innerText(),
          editedSlot === 'Primary' ? /Shadehand/ : /Farstrider/,
        )
        const calls = await page.evaluate(() =>
          window.calls.filter((c) => ['POST', 'PUT'].includes(c.method)),
        )
        for (const call of calls)
          assert.equal(
            editedSlot === 'Primary'
              ? 'secondaryDisciplineId' in call.payload
              : 'primaryDisciplineId' in call.payload,
            false,
          )
        assert.equal(calls[1].payload.expectedBuildVersion, 9)
      },
    )
  await check('immediate secondary removal', async () => {
    await secondary.click()
    await page.getByRole('button', { name: 'Remove Secondary Discipline' }).click()
    await committed()
    assert.equal(
      (await page.evaluate(() => window.calls.find((call) => call.method === 'PUT').payload))
        .secondaryDisciplineId,
      null,
    )
    assert.match(await secondary.innerText(), /None/)
    assert.match(await impact.innerText(), /No stat changes in the last successful change/)
  })
  for (const phase of ['POST', 'PUT'])
    await check(
      `pending ${phase} blocks duplicate input and represents only committed build`,
      async () => {
        await page.evaluate((phase) => (window.hold = phase), phase)
        await choice('Aetherist').evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await page.waitForFunction(
          (phase) => window.calls.some((call) => call.method === phase),
          phase,
        )
        assert.deepEqual(await methods(), phase === 'POST' ? ['POST'] : ['POST', 'PUT'])
        assert.equal(await choice('Farstrider').isDisabled(), true)
        assert.equal(await primary.isDisabled(), true)
        assert.equal(
          await dialog.getByRole('button', { name: 'Close', exact: true }).isDisabled(),
          true,
        )
        assert.match(await primary.innerText(), /Vanguard/)
        assert.doesNotMatch(await impact.innerText(), /Last successful/)
        await page.keyboard.press('Escape')
        assert.equal(await dialog.isVisible(), true)
        await page.evaluate(() => {
          window.hold = false
          window.release()
        })
        await committed()
        assert.deepEqual(await methods(), ['POST', 'PUT'])
      },
    )
  for (const phase of ['POST', 'PUT'])
    await check(`${phase} failure preserves committed identity and previous impact`, async () => {
      await choice('Aetherist').click()
      await committed()
      const text = await impact.innerText()
      await page.evaluate((phase) => (window.fail = phase), phase)
      await choice('Farstrider').click()
      await page.getByRole('status').filter({ hasText: 'Fixture failure' }).waitFor()
      assert.match(await primary.innerText(), /Aetherist/)
      assert.equal(await impact.innerText(), text)
      assert.equal(await choice('Farstrider').getAttribute('aria-pressed'), 'false')
      assert.equal(
        await dialog.getByRole('button', { name: 'Close', exact: true }).isEnabled(),
        true,
      )
    })
  for (const phase of ['POST', 'PUT'])
    await check(`${phase} network failure states confirmed outcome honestly`, async () => {
      await page.evaluate((phase) => (window.throwMethod = phase), phase)
      await choice('Aetherist').click()
      await page
        .getByRole('status')
        .filter({
          hasText:
            phase === 'POST'
              ? 'Nothing was changed.'
              : 'Refresh to check your committed Disciplines.',
        })
        .waitFor()
      assert.match(await primary.innerText(), /Vanguard/)
      assert.doesNotMatch(await impact.innerText(), /Last successful/)
    })
  await check('authoritative preview cooldown prevents commit', async () => {
    await page.evaluate(() => (window.cooldown = 60))
    await choice('Aetherist').click()
    await page.getByRole('status').filter({ hasText: 'still attuning' }).waitFor()
    assert.deepEqual(await methods(), ['POST'])
    assert.match(await primary.innerText(), /Vanguard/)
    await secondary.click()
    assert.equal(await choice('Farstrider', 'Secondary').isEnabled(), true)
  })
  await check('foreign preview prevents commit', async () => {
    await page.evaluate(() => (window.characterId = 'character-b'))
    await choice('Aetherist').click()
    await page.getByRole('status').filter({ hasText: 'selected character changed' }).waitFor()
    assert.deepEqual(await methods(), ['POST'])
    assert.match(await primary.innerText(), /Vanguard/)
  })
  await check('foreign commit response cannot replace visible character', async () => {
    await page.evaluate(() => (window.contextCharacter = 'character-b'))
    await choice('Aetherist').click()
    await page.getByRole('status').filter({ hasText: 'selected character changed' }).waitFor()
    assert.match(await primary.innerText(), /Vanguard/)
    assert.doesNotMatch(await impact.innerText(), /Last successful/)
  })
  for (const phase of ['POST', 'PUT'])
    await check(`leave during ${phase} discards stale completion`, async () => {
      await page.evaluate((phase) => (window.hold = phase), phase)
      await choice('Aetherist').click()
      await page.waitForFunction(
        (phase) => window.calls.some((call) => call.method === phase),
        phase,
      )
      await page.evaluate(() => history.replaceState(null, '', '?profilePanel=other'))
      await dialog.waitFor({ state: 'hidden' })
      await page.evaluate(() => {
        window.hold = false
        window.release()
      })
      await page.getByRole('button', { name: /Manage Disciplines/ }).click()
      await dialog.waitFor()
      await page.waitForFunction(
        () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
      )
      assert.match(await primary.innerText(), phase === 'PUT' ? /Aetherist/ : /Vanguard/)
      if (phase === 'PUT') assert.match(await dialog.locator('article').innerText(), /Might\s*2/)
      assert.doesNotMatch(await impact.innerText(), /Last successful/)
      assert.deepEqual(await methods(), phase === 'POST' ? ['POST'] : ['POST', 'PUT'])
    })
  await check('reopen before PUT settlement waits and reloads authority', async () => {
    await page.evaluate(() => (window.hold = 'PUT'))
    await choice('Aetherist').click()
    await page.waitForFunction(() => window.calls.some((c) => c.method === 'PUT'))
    await page.evaluate(() => history.replaceState(null, '', '?profilePanel=other'))
    await dialog.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: /Manage Disciplines/ }).click()
    await dialog.waitFor()
    assert.equal(await primary.isDisabled(), true)
    assert.match(await dialog.innerText(), /Loading Committed Disciplines/)
    assert.equal(
      await page.evaluate(() => window.calls.filter((c) => c.method === 'GET').length),
      1,
    )
    await page.evaluate(() => {
      window.hold = false
      window.release()
    })
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
    )
    assert.match(await primary.innerText(), /Aetherist/)
    assert.match(await dialog.locator('article').innerText(), /Might\s*2/)
    assert.doesNotMatch(await impact.innerText(), /Last successful/)
    assert.equal(
      await page.evaluate(() => window.calls.filter((c) => c.method === 'GET').length),
      2,
    )
  })
  await check('lost PUT response reconciles actual committed build', async () => {
    await page.evaluate(() => {
      window.throwMethod = 'PUT'
      window.commitThenThrow = true
    })
    await choice('Aetherist').click()
    await page.waitForFunction(() => window.calls.filter((c) => c.method === 'GET').length === 2)
    await page.waitForFunction(
      () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
    )
    assert.match(await primary.innerText(), /Aetherist/)
    assert.match(await dialog.locator('article').innerText(), /Might\s*2/)
    assert.doesNotMatch(await impact.innerText(), /Last successful/)
  })
  await check(
    'failed reopen synchronization exposes last-known state and blocks edits',
    async () => {
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await page.evaluate(() => (window.fail = 'GET'))
      await page.getByRole('button', { name: /Manage Disciplines/ }).click()
      await page.getByRole('status').filter({ hasText: 'Fixture failure' }).waitFor()
      assert.match(await dialog.innerText(), /Last known/i)
      assert.equal(await primary.isDisabled(), true)
      assert.equal(await choice('Aetherist').isDisabled(), true)
      assert.deepEqual(await methods(), [])
      await dialog.getByRole('button', { name: 'Close', exact: true }).click()
      await page.evaluate(() => {
        window.fail = null
        window.primary = 'aetherist'
      })
      await page.getByRole('button', { name: /Manage Disciplines/ }).click()
      await page.waitForFunction(
        () => !document.querySelector('[aria-label="Edit Primary Discipline"]')?.disabled,
      )
      assert.match(await primary.innerText(), /Aetherist/)
    },
  )
  await check('foreign reopen synchronization cannot replace character state', async () => {
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await page.evaluate(() => {
      window.contextCharacter = 'character-b'
      window.primary = 'aetherist'
    })
    await page.getByRole('button', { name: /Manage Disciplines/ }).click()
    await page.getByRole('status').filter({ hasText: 'selected character changed' }).waitFor()
    assert.match(await primary.innerText(), /Vanguard/)
    assert.equal(await choice('Aetherist').isDisabled(), true)
    assert.deepEqual(await methods(), [])
  })
  for (const phase of ['POST', 'PUT'])
    await check(`character switch during ${phase} discards old callback`, async () => {
      await page.evaluate((phase) => (window.hold = phase), phase)
      await choice('Aetherist').click()
      await page.waitForFunction(
        (phase) => window.calls.some((call) => call.method === phase),
        phase,
      )
      await page.evaluate(() => {
        window.characterId = 'character-b'
        window.renderPanel('character-b')
      })
      await dialog.getByRole('button', { name: 'Close', exact: true }).waitFor()
      await page.evaluate(() => {
        window.hold = false
        window.release()
      })
      assert.match(await primary.innerText(), /Vanguard/)
      assert.doesNotMatch(await impact.innerText(), /Last successful/)
      assert.deepEqual(await methods(), phase === 'POST' ? ['POST'] : ['POST', 'PUT'])
    })
  await reset()
  const sizes = [
    [1920, 1080],
    [1536, 614],
    [1366, 768],
    [1280, 720],
    [1024, 576],
    [390, 844],
    [320, 740],
  ]
  await choice('Aetherist').click()
  await committed()
  const metrics = []
  await fs.mkdir(output, { recursive: true })
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await primary.scrollIntoViewIfNeeded()
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})))
    })
    const measure = await dialog.evaluate((node) => {
      const rect = (element) => element.getBoundingClientRect().toJSON()
      const roster = node.querySelector('[aria-label$="Discipline library"]')
      return {
        dialog: rect(node),
        roster: rect(roster),
        rosterScroll: roster.scrollHeight - roster.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
        dialogOverflow: node.scrollWidth - node.clientWidth,
        primary: rect(node.querySelector('[aria-label="Edit Primary Discipline"]')),
        secondary: rect(node.querySelector('[aria-label="Edit Secondary Discipline"]')),
        panels: [...node.querySelectorAll('article,aside')].map(rect),
      }
    })
    assert.ok(measure.dialog.x >= 0 && measure.dialog.right <= width + 1)
    assert.ok(measure.dialog.y >= 0 && measure.dialog.bottom <= height + 1)
    assert.ok(
      measure.horizontalOverflow <= 1 && measure.dialogOverflow <= 1,
      JSON.stringify({ width, height, ...measure }),
    )
    assert.ok(measure.rosterScroll > 0)
    if (width > 980)
      for (const box of [...measure.panels, measure.primary, measure.secondary])
        assert.ok(box.bottom <= measure.dialog.bottom && box.right <= measure.dialog.right)
    await page.screenshot({ path: output + `/discipline-${width}x${height}.png` })
    if (width <= 980) {
      await impact.scrollIntoViewIfNeeded()
      const summary = await dialog.locator('article').evaluate((article) => {
        const box = article.getBoundingClientRect()
        return {
          height: box.height,
          overflow: article.scrollWidth - article.clientWidth,
          cells: [...article.querySelectorAll('strong,small,header')].map((cell) => {
            const rect = cell.getBoundingClientRect()
            return (
              rect.right <= box.right + 1 &&
              rect.left >= box.left - 1 &&
              rect.bottom <= box.bottom + 1
            )
          }),
        }
      })
      assert.ok(summary.height > 150 && summary.overflow <= 1 && summary.cells.every(Boolean))
      await page.screenshot({ path: output + `/discipline-${width}x${height}-summary.png` })
    }
    metrics.push({ width, height, ...measure })
  }
  await reset()
  await page.setViewportSize({ width: 1366, height: 768 })
  await choice('Aetherist').click()
  await committed()
  await page.screenshot({ path: output + '/discipline-primary-committed.png' })
  await secondary.click()
  await page.screenshot({ path: output + '/discipline-secondary-active.png' })
  await page.getByRole('button', { name: 'Remove Secondary Discipline' }).click()
  await committed()
  await page.screenshot({ path: output + '/discipline-secondary-removed.png' })
  assert.deepEqual(errors, [])
  await fs.writeFile(output + '/results.json', JSON.stringify({ checks, metrics, errors }, null, 2))
  console.log(JSON.stringify({ checks: checks.length, viewports: metrics.length, output, errors }))
} finally {
  await browser.close()
  await server.close()
}
