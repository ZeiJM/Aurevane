import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { provisionAccountAndEnterCharacter } from './pv1f-test-helpers'
import {
  acquirePlayersFixtureOwner,
  releasePlayersFixtureOwner,
  type FixtureOwner,
} from './players-local-fixture'
import {
  worldDayPhase,
  worldTimeLabel,
  type WorldEnvironmentSettings,
} from '../src/world/environment'
import { precipitationKind, regionalWeatherLabel } from '../src/components/world/map-weather'
import type { WorldView } from '../src/world/types'

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

test('saved short World cycle and weather expiry reach the live refresh, map and right panel over real time', async ({
  page,
  baseURL,
}, info) => {
  test.setTimeout(150000)
  expect(['localhost', '127.0.0.1']).toContain(new URL(baseURL!).hostname)
  expect(['localhost', '127.0.0.1']).toContain(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
  )
  // Observe actual map lighting paint without replacing time, responses or the renderer.
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillRect
    CanvasRenderingContext2D.prototype.fillRect = function (...args) {
      if (typeof this.fillStyle === 'string' && /^rgba\(16, 28, 50,/.test(this.fillStyle))
        this.canvas.dataset.observedNightPaint = this.fillStyle
      return original.apply(this, args)
    }
  })
  let owner: FixtureOwner | undefined
  let original: WorldEnvironmentSettings | undefined
  let attemptedSave = false
  let failure: unknown
  let stage = 'provision'
  const receipts: WorldView[] = []
  const observed: {
    at: string
    phase: string
    text: string
    nightPaint: string | null
    weatherSource: string
    precipitation: string | null
  }[] = []
  const errors: string[] = []
  const pendingRender: unknown[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', async (response) => {
    if (new URL(response.url()).pathname === '/api/world' && response.ok()) {
      const body = await response.json().catch(() => null)
      if (body?.environment) receipts.push(body as WorldView)
    }
  })
  try {
    const account = await provisionAccountAndEnterCharacter({
      page,
      email: `world-cadence-${randomUUID()}@example.test`,
      password: 'Disposable-World-2026!',
      characterName: `Cycle ${randomUUID()
        .replace(/[^a-z]/g, '')
        .slice(0, 8)}`,
    })
    owner = await acquirePlayersFixtureOwner(sql, account.userId)
    const before = await page.request.get('/api/master/world-environment')
    expect(before.ok()).toBe(true)
    original = (await before.json()).settings
    expect(original!.weatherOverride).toBeNull()
    stage = 'configure-environment'
    await page.goto('/master/world-environment')
    await page.getByLabel('Day length (real minutes)', { exact: true }).fill('1')
    await page
      .getByLabel('Automatic weather roll interval (real minutes)', { exact: true })
      .fill('1')
    await page.getByLabel('Freeze the clock at a time of day').uncheck()
    await page.getByLabel('Shift world time (minutes, −1440 to 1440)').fill('0')
    await page
      .getByRole('combobox', { name: 'Weather selection', exact: true })
      .selectOption('rain')
    await page.getByLabel('Forced weather duration (minutes)').fill('1')
    const saved = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/master/world-environment' &&
        r.request().method() === 'POST',
    )
    stage = 'save-environment'
    attemptedSave = true
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click()
    const savedResponse = await saved
    expect(savedResponse.ok()).toBe(true)
    const settings: WorldEnvironmentSettings = (await savedResponse.json()).settings
    expect(settings.dayLengthMinutes).toBe(1)
    expect(settings.weatherRollMinutes).toBe(1)
    expect(settings.weatherOverrideUntil).toBeGreaterThan(Date.now() + 50000)
    stage = 'open-world'
    await page.goto('/game/world')
    await expect(page.locator('[data-world-workspace]')).toBeVisible()
    const details = page.getByRole('button', { name: 'Details', exact: true })
    if (await details.isVisible()) await details.click()
    const canvas = page.locator('canvas[data-world-stage]').first()
    await expect(canvas).toBeVisible()
    stage = 'observe-natural-cycle-and-expiry'
    // Only naturally scheduled authoritative refreshes are used. No page reload,
    // forced refresh, synthetic clock, database expiry rewrite or manual polling API.
    await expect
      .poll(
        async () => {
          const current = receipts.at(-1)
          if (!current || current.environment.settingsVersion !== settings.version) return false
          const env = current.environment
          expect(env.dayLengthMs).toBe(60000)
          const region = 'verdant-expanse' // Newly provisioned character remains at the real starting town; no travel mutation.
          const phase = worldDayPhase(env.minuteOfDay)
          const expected = `${worldTimeLabel(env.minuteOfDay)} · ${phase} · ${regionalWeatherLabel(env.weather, region)}`
          // Read both surfaces in one browser task. A naturally scheduled response
          // can replace the receipt/React view between separate awaited DOM reads;
          // the renderer then paints that new view on its next animation frame.
          const rendered = await page
            .getByLabel('World conditions', { exact: true })
            .evaluate((label) => {
              const stage = document.querySelector('canvas[data-world-stage]')
              return {
                text: (label as HTMLElement).innerText,
                precipitation: stage?.getAttribute('data-precipitation') ?? null,
                nightPaint: stage?.getAttribute('data-observed-night-paint') ?? null,
              }
            })
          const expectedPrecipitation = precipitationKind(env.weather, region) ?? 'none'
          if (
            receipts.at(-1) !== current ||
            rendered.text !== expected ||
            rendered.precipitation !== expectedPrecipitation
          ) {
            pendingRender.push({
              at: new Date().toISOString(),
              receiptAdvanced: receipts.at(-1) !== current,
              expected,
              expectedPrecipitation,
              ...rendered,
            })
            if (pendingRender.length > 50) pendingRender.shift()
            return false
          }
          const { text, precipitation, nightPaint } = rendered
          observed.push({
            at: new Date().toISOString(),
            phase,
            text,
            nightPaint,
            weatherSource: env.weatherSource,
            precipitation,
          })
          if (!observed.slice(0, -1).some((row) => row.phase === phase))
            await page.screenshot({
              path: info.outputPath(`master-world-real-cycle-${phase}.png`),
              fullPage: true,
            })
          const phases = new Set(observed.map((row) => row.phase))
          return (
            phases.has('Night') &&
            phases.has('Day') &&
            observed.some((row) => row.weatherSource === 'master') &&
            env.weatherSource === 'live' &&
            Date.now() >= settings.weatherOverrideUntil!
          )
        },
        { timeout: 95000, intervals: [2000] },
      )
      .toBe(true)
    stage = 'verify-observed-paint'
    expect(receipts.length).toBeGreaterThan(2)
    const paints = new Set(observed.map((row) => row.nightPaint).filter(Boolean))
    expect(paints.size).toBeGreaterThan(1)
    await info.attach('real-world-cycle-expiry.json', {
      body: JSON.stringify({
        settings,
        observed,
        pendingRender,
        refreshes: receipts.map((v) => ({ serverNow: v.serverNow, environment: v.environment })),
      }),
      contentType: 'application/json',
    })
    await page.screenshot({
      path: info.outputPath('master-world-real-weather-expired.png'),
      fullPage: true,
    })
    expect(errors).toEqual([])
  } catch (error) {
    failure = error
    throw error
  } finally {
    await info.attach('world-cadence-stage.json', {
      body: JSON.stringify({
        stage,
        attemptedSave,
        failure: failure instanceof Error ? failure.message : null,
        observed,
        pendingRender,
        refreshes: receipts.map((v) => ({ serverNow: v.serverNow, environment: v.environment })),
        errors,
      }),
      contentType: 'application/json',
    })
    const cleanupErrors: unknown[] = []
    try {
      if (owner && original && attemptedSave) {
        const current = await page.request.get('/api/master/world-environment')
        const response = await page.request.post('/api/master/world-environment', {
          data: {
            expectedVersion: (await current.json()).settings.version,
            change: {
              dayLengthMinutes: original.dayLengthMinutes ?? 1440,
              weatherRollMinutes: original.weatherRollMinutes ?? 360,
              timeOffsetMinutes: original.timeOffsetMinutes,
              frozenMinuteOfDay: original.frozenMinuteOfDay,
              weather: null,
              durationMinutes: 1,
            },
          },
        })
        expect(response.ok()).toBe(true)
      }
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError)
    } finally {
      try {
        if (owner) await releasePlayersFixtureOwner(sql, owner)
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }
    if (cleanupErrors.length) {
      await info.attach('world-cadence-cleanup-error.txt', {
        body: cleanupErrors.map(String).join('\n'),
        contentType: 'text/plain',
      })
      if (!failure) throw new AggregateError(cleanupErrors, 'World cadence fixture cleanup failed')
    }
  }
})
