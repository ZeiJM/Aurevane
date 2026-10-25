import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium, expect, test } from '@playwright/test'
import { exerciseMasterAtBrowserZoom } from './master-zoom-workflows'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import {
  acquirePlayersFixtureOwner,
  releasePlayersFixtureOwner,
  type FixtureOwner,
} from './players-local-fixture'

function sql(query: string) {
  const containers = execFileSync(
    'docker',
    ['ps', '--filter', 'name=supabase_db_', '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
  if (containers.length !== 1 || !containers[0]?.startsWith('supabase_db_'))
    throw new Error('Master acceptance requires one disposable local database.')
  return execFileSync(
    'docker',
    [
      'exec',
      containers[0],
      'psql',
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-Atqc',
      query,
    ],
    { encoding: 'utf8' },
  ).trim()
}

test('complete Master destinations fit desktop, touch and actual browser 200 percent', async ({
  baseURL,
}, info) => {
  test.setTimeout(180000)
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname)
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  )
  const directory = await mkdtemp(join(tmpdir(), 'master-real-zoom-'))
  const extension = join(directory, 'extension')
  const { mkdir } = await import('node:fs/promises')
  await mkdir(extension)
  await writeFile(
    join(extension, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Disposable localhost Master zoom proof',
      version: '1.0',
      permissions: ['tabs'],
      host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],
      background: { service_worker: 'background.js' },
    }),
  )
  await writeFile(
    join(extension, 'background.js'),
    'chrome.runtime.onInstalled.addListener(() => {});',
  )
  const context = await chromium.launchPersistentContext(join(directory, 'profile'), {
    channel: 'chromium',
    headless: true,
    viewport: null,
    // Explicit keys prevent Playwright Test from inheriting Desktop Chrome or
    // mobile project emulation into this native-window context.
    deviceScaleFactor: undefined,
    userAgent: undefined,
    isMobile: false,
    hasTouch: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    baseURL,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
      '--window-size=1366,768',
    ],
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  let owner: FixtureOwner | undefined
  try {
    const favicon = await context.request.get('/favicon.ico')
    expect(favicon.status()).toBe(200)
    expect(favicon.headers()['content-type']).toMatch(/^image\/(?:x-icon|vnd\.microsoft\.icon)/)
    const identity = {
      email: `master-fit-${randomUUID()}@example.test`,
      characterName: `Master ${randomUUID()
        .replace(/[^a-z]/g, '')
        .slice(0, 8)}`,
    }
    const account = await provisionAccountAndEnterCharacter({
      page,
      ...identity,
      password: 'Disposable-Master-layout-2026!',
    })
    owner = await acquirePlayersFixtureOwner(sql, account.userId)
    await page.goto('/master/combat-content')
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    const setZoom = async (factor?: number) =>
      worker.evaluate(async (factor) => {
        // Chrome's extension API performs real browser zoom. No CSS, CDP page-scale,
        // viewport emulation or device scale factor is used as zoom evidence.
        const chromeApi = (
          globalThis as unknown as {
            chrome: {
              tabs: {
                query(q: object): Promise<{ id: number; url: string }[]>
                setZoomSettings(id: number, s: object): Promise<void>
                setZoom(id: number, n: number): Promise<void>
                getZoom(id: number): Promise<number>
              }
            }
          }
        ).chrome
        const tabs = await chromeApi.tabs.query({})
        const tab = tabs.find(
          (t) =>
            /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(t.url) && t.url.includes('/master/'),
        )
        if (!tab) throw new Error('No disposable Master tab found')
        if (factor !== undefined) {
          await chromeApi.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' })
          await chromeApi.tabs.setZoom(tab.id, factor)
        }
        return chromeApi.tabs.getZoom(tab.id)
      }, factor)
    const metrics = () =>
      page.evaluate(() => ({
        innerWidth,
        innerHeight,
        outerWidth,
        outerHeight,
        dpr: devicePixelRatio,
        visualScale: visualViewport?.scale,
        cssZoom: getComputedStyle(document.documentElement).zoom,
        scrollWidth: document.documentElement.scrollWidth,
      }))
    const baseline = await metrics()
    expect(await setZoom(2)).toBe(2)
    await expect
      .poll(async () => (await metrics()).innerWidth)
      .toBeLessThan(baseline.innerWidth * 0.6)
    const zoomed = await metrics()
    expect(zoomed.innerWidth).toBeGreaterThan(baseline.innerWidth * 0.4)
    expect(zoomed.cssZoom).toBe('1')
    await info.attach('actual-browser-zoom.json', {
      body: JSON.stringify({
        browser: context.browser()?.version(),
        baseline,
        zoomed,
        readback: 2,
      }),
      contentType: 'application/json',
    })
    const layoutMetrics: unknown[] = []
    const destinations = [
      ['/master/combat-content', 'Game Content'],
      ['/master/combat-timing', 'Combat Rules'],
      ['/master/world-environment', 'World Environment'],
      ['/master/music', 'Site Music'],
      ['/master/staff', 'Staff & Access'],
      ['/master/players', 'Players'],
      ['/master/events', 'Events & Live Ops'],
      ['/master/events/live', 'Events & Live Ops'],
    ] as const
    for (const [name, width, height, factor] of [
      ['real200', 1366, 768, 2],
      ['desktop', 1366, 768, 1],
      ['large', 1440, 900, 1],
      ['mobile', 390, 844, 1],
    ] as const) {
      if (factor === 1) {
        expect(await setZoom(1)).toBe(1)
        await page.setViewportSize({ width, height })
      }
      for (const [route, title] of destinations) {
        await page.goto(route)
        await expect(
          page.getByRole('navigation', { name: 'Master Panel navigation' }),
        ).toBeVisible()
        await expect(page.getByRole('heading', { name: title, exact: true }).first()).toBeVisible()
        const readback = await setZoom(factor)
        expect(readback).toBe(factor)
        const measured = await metrics()
        expect(measured.cssZoom).toBe('1')
        if (factor === 2) expect(measured.innerWidth).toBeLessThan(baseline.innerWidth * 0.6)
        layoutMetrics.push({ route, name, readback, ...measured })
        await expect
          .poll(async () =>
            page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          )
          .toBe(true)
        if (factor === 2)
          await exerciseMasterAtBrowserZoom(page, route, identity, info, () => setZoom())
        else {
          await page.keyboard.press('Tab')
          expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true)
        }
        await page.screenshot({
          path: info.outputPath(`master-layout-${name}-${route.split('/').at(-1)}.png`),
          fullPage: true,
        })
      }
    }
    await info.attach('master-layout-metrics.json', {
      body: JSON.stringify(layoutMetrics),
      contentType: 'application/json',
    })
    // Real touch context reuses this disposable authenticated session.
    const touch = await chromium.launch({ channel: 'chromium' })
    try {
      const mobile = await touch.newContext({
        baseURL,
        storageState: await context.storageState(),
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      })
      const p = await mobile.newPage()
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto('/master/combat-content')
      await p
        .getByRole('navigation', { name: 'Master Panel navigation' })
        .getByRole('link', { name: 'Players', exact: true })
        .tap()
      await expect(p.getByRole('heading', { name: 'Players', exact: true }).first()).toBeVisible()
      await p.screenshot({
        path: info.outputPath('master-mobile-touch-players.png'),
        fullPage: true,
      })
      await mobile.close()
    } finally {
      await touch.close()
    }
    expect(errors).toEqual([])
  } finally {
    try {
      if (owner) await releasePlayersFixtureOwner(sql, owner)
    } finally {
      try {
        await context.close()
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  }
})
