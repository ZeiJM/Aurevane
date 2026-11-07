import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import {
  expect,
  test,
  type APIResponse,
  type Browser,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { WORLD_REGIONS } from '../src/world/catalog'
import type { WorldPosition, WorldView } from '../src/world/types'
import {
  cleanupWorldPresenceFixtures,
  summarizeWorldSocketFrame,
} from './world-presence-diagnostics'

const cohortSize = 8
const hotSector = 'atlas:58:28'
const worldStage = 'canvas[data-world-stage]'

function socketRef(payload: string | Buffer) {
  try {
    const frame = JSON.parse(payload.toString())
    const ref = Array.isArray(frame) ? frame[1] : frame.ref
    return typeof ref === 'string' && /^\d+$/.test(ref) ? ref : null
  } catch {
    return null
  }
}

function percentiles(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b)
  const at = (fraction: number) =>
    Number((sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0).toFixed(1))
  return { samples: values.length, p50: at(0.5), p95: at(0.95), p99: at(0.99) }
}

async function measured<T>(send: () => Promise<APIResponse>) {
  const started = performance.now()
  const response = await send()
  const body = await response.body()
  const ms = performance.now() - started
  const timing = response.headers()['server-timing']?.match(/total;dur=([\d.]+)/)
  return {
    status: response.status(),
    bytes: body.byteLength,
    ms,
    serverMs: timing ? Number(timing[1]) : null,
    body: JSON.parse(body.toString('utf8')) as T,
  }
}

function summarize(rows: { status: number; bytes: number; ms: number; serverMs: number | null }[]) {
  return {
    statuses: rows.map(({ status }) => status),
    responseBytes: percentiles(rows.map(({ bytes }) => bytes)),
    roundTripMs: percentiles(rows.map(({ ms }) => ms)),
    serverMs: percentiles(rows.flatMap(({ serverMs }) => (serverMs === null ? [] : [serverMs]))),
  }
}

export function registerWorldMultiplayerLoadCase({
  enter,
  world,
  place,
  sql,
}: {
  enter: (page: Page) => Promise<string>
  world: (page: Page) => Promise<WorldView>
  place: (id: string, sector: string, x: number, y: number) => void
  sql: (query: string) => string
}) {
  test('measures eight real sessions dispersed, crowded and reconnecting in the isolated World', async ({
    browser,
  }, info) => {
    test.skip(
      info.project.name !== 'desktop-chromium',
      'One runner measures this real session cohort.',
    )
    await measureWorldMultiplayer(browser, info, { enter, world, place, sql })
  })
}

async function measureWorldMultiplayer(
  browser: Browser,
  info: TestInfo,
  { enter, world, place, sql }: Parameters<typeof registerWorldMultiplayerLoadCase>[0],
) {
  test.setTimeout(240_000)
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://invalid')
  const app = new URL(info.project.use.baseURL ?? 'http://invalid')
  const loopback = ['127.0.0.1', 'localhost']
  if (!loopback.includes(url.hostname) || !loopback.includes(app.hostname))
    throw new Error('The World load case requires a disposable local application and Supabase.')

  const contexts = []
  const participants: { page: Page; id: string; worldUrl: string }[] = []
  const socket = { joins: 0, broadcasts: 0, errors: 0, sampledFrameBytes: 0 }
  const browsersAttemptingJoin = new Set<string>()
  const browsersReceivingJoinReply = new Set<string>()
  const reconnected = new Set<string>()
  let reconnecting = false
  const result: Record<string, unknown> = {
    mode: 'Authenticated browser sessions on a disposable Supabase Auth/Postgres/Realtime stack',
    browser: browser.version(),
    cohortSize,
    frameProfile: '393×851 CSS px, DPR 2.75, runner Chromium without simulated CPU throttle',
  }
  let failed = false
  try {
    for (let i = 0; i < cohortSize; i++) {
      const context = await browser.newContext({
        baseURL: app.origin,
        viewport: { width: 393, height: 851 },
        deviceScaleFactor: 2.75,
        isMobile: true,
        hasTouch: true,
      })
      contexts.push(context)
      const page = await context.newPage()
      await enter(page)
      const { characterId: id } = await world(page)
      participants.push({ page, id, worldUrl: page.url() })
      await page.goto('about:blank')
      page.on('websocket', (connection) => {
        if (new URL(connection.url()).pathname !== '/realtime/v1/websocket') return
        const isReconnect = reconnecting
        const joinRefs = new Set<string>()
        connection.on('socketerror', () => socket.errors++)
        connection.on('framesent', ({ payload }) => {
          const frame = summarizeWorldSocketFrame(payload)
          if (frame?.event === 'phx_join') {
            socket.joins++
            browsersAttemptingJoin.add(id)
            const ref = socketRef(payload)
            if (ref) joinRefs.add(ref)
          }
        })
        connection.on('framereceived', ({ payload }) => {
          const frame = summarizeWorldSocketFrame(payload)
          if (!frame) return
          if (frame.event === 'broadcast') socket.broadcasts++
          const ref = socketRef(payload)
          if (frame.event === 'phx_reply' && ref && joinRefs.delete(ref) && frame.status === 'ok') {
            browsersReceivingJoinReply.add(id)
            if (isReconnect) reconnected.add(id)
          }
          if (frame.status === 'error' || frame.event === 'phx_error') socket.errors++
          socket.sampledFrameBytes += Buffer.byteLength(payload)
        })
      })
    }

    const ids = new Set(participants.map(({ id }) => id))
    const load = (reload: boolean) =>
      Promise.all(
        participants.map(async ({ page, worldUrl }) => {
          const started = performance.now()
          if (reload) await page.reload({ waitUntil: 'domcontentloaded' })
          else await page.goto(worldUrl, { waitUntil: 'domcontentloaded' })
          await expect(page.locator(worldStage)).toHaveAttribute('data-tile-size', /\d/, {
            timeout: 30_000,
          })
          return performance.now() - started
        }),
      )
    for (const layout of ['dispersed', 'hotspot'] as const) {
      const starts: WorldPosition[] = participants.map((_, i) => ({
        sectorId: layout === 'dispersed' ? WORLD_REGIONS[i]!.id : hotSector,
        x: layout === 'dispersed' ? 6 : i === 0 ? 12 : i + 1,
        y: 4,
      }))
      participants.forEach(({ id }, index) => {
        const { sectorId, x, y } = starts[index]!
        place(id, sectorId, x, y)
      })
      const loaded = await load(layout === 'hotspot')
      const observed = await Promise.all(participants.map(({ page }) => world(page)))
      expect(observed.map(({ position }) => position)).toEqual(starts)
      const destinations = starts.map((from, i) =>
        layout === 'hotspot' && i === 0
          ? { sectorId: 'atlas:59:28', x: 0, y: 4 }
          : { ...from, x: from.x + 1 },
      )
      const approvalStarted = performance.now()
      const commands = await Promise.all(
        participants.map(({ page, id }, i) =>
          measured<WorldView>(() =>
            page.request.post('/api/world', {
              headers: { 'x-world-response': 'movement' },
              data: {
                characterId: id,
                expectedVersion: observed[i]!.version,
                commandId: randomUUID(),
                intent: { kind: 'walk', destination: destinations[i] },
              },
            }),
          ),
        ),
      )
      expect(commands.map(({ status }) => status)).toEqual(Array(cohortSize).fill(200))
      const arrivals = await Promise.all(
        participants.map(async ({ page }, i) => {
          await expect
            .poll(
              async () => {
                const view = await world(page)
                return { position: view.position, pending: view.route.length }
              },
              { intervals: [100, 250, 500], timeout: 15_000 },
            )
            .toEqual({ position: destinations[i], pending: 0 })
          return performance.now() - approvalStarted
        }),
      )
      const snapshots = await Promise.all(
        participants.map(({ page }) => measured<WorldView>(() => page.request.get('/api/world'))),
      )
      expect(snapshots.map(({ status }) => status)).toEqual(Array(cohortSize).fill(200))
      const nearby = snapshots.map(
        ({ body }) => body.players.filter(({ characterId }) => ids.has(characterId)).length,
      )
      if (layout === 'hotspot') expect(Math.max(...nearby)).toBe(cohortSize - 1)
      else expect(Math.max(...nearby)).toBeLessThan(cohortSize - 1)
      result[layout] = {
        canvasReadyMs: percentiles(loaded),
        moveApproval: summarize(commands),
        arrivalObservedFromRequestMs: percentiles(arrivals),
        snapshot: summarize(snapshots),
        nearbyFixtureActors: nearby,
      }
    }

    const first = participants[0]!
    const canvas = first.page.locator(worldStage)
    await expect(canvas).toHaveAttribute('data-frame-p95', /\d/, { timeout: 30_000 })
    result.observerRendererCallbackP95Ms = Number(await canvas.getAttribute('data-frame-p95'))
    await first.page.screenshot({ path: info.outputPath('world-multiplayer-hotspot.png') })

    await expect.poll(() => browsersReceivingJoinReply.size, { timeout: 15_000 }).toBe(cohortSize)
    reconnecting = true
    result.reconnectCanvasReadyMs = percentiles(await load(true))
    await expect.poll(async () => (await world(first.page)).position.sectorId).toBe('atlas:59:28')
    await expect.poll(() => reconnected.size, { timeout: 15_000 }).toBe(cohortSize)
    const battles = await Promise.all(
      participants.slice(0, 2).map(({ page, id }) =>
        measured<{ battle: { battleSessionId: string } }>(() =>
          page.request.post('/api/battles', {
            data: {
              characterId: id,
              idempotencyKey: randomUUID(),
              battleHallRecordId: 'recruit-sparring',
            },
          }),
        ),
      ),
    )
    expect(battles.map(({ status }) => status)).toEqual([200, 200])
    expect(new Set(battles.map(({ body }) => body.battle.battleSessionId)).size).toBe(2)
    result.simultaneousBattleAdmission = summarize(battles)
  } catch (error) {
    failed = true
    throw error
  } finally {
    const close = await Promise.allSettled(contexts.map((context) => context.close()))
    const retired = []
    for (let i = 0; i < participants.length; i += 2) {
      retired.push(
        ...(await cleanupWorldPresenceFixtures(
          participants.slice(i, i + 2).map(({ id }) => id),
          [],
          sql,
        )),
      )
    }
    const path = info.outputPath('world-multiplayer-load.json')
    await writeFile(
      path,
      JSON.stringify(
        {
          ...result,
          realtime: {
            ...socket,
            browsersAttemptingJoin: browsersAttemptingJoin.size,
            browsersReceivingJoinReply: browsersReceivingJoinReply.size,
            browsersRejoiningAfterReload: reconnected.size,
          },
          cleanupErrors: retired,
        },
        null,
        2,
      ),
    )
    await info.attach('world-multiplayer-load', { path, contentType: 'application/json' })
    if (!failed) {
      expect(close.every(({ status }) => status === 'fulfilled')).toBe(true)
      expect(retired).toEqual([])
    }
  }
}
