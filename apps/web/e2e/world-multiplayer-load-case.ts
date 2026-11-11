import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import {
  expect,
  test,
  type APIResponse,
  type Browser,
  type Page,
  type Request,
  type Response,
  type Route,
  type TestInfo,
} from '@playwright/test'
import { WORLD_REGIONS } from '../src/world/catalog'
import type { WorldLivePlayers } from '../src/world/live-presence'
import { samePosition } from '../src/world/travel'
import type { WorldPosition, WorldView } from '../src/world/types'
import { cleanupWorldPresenceFixtures, inspectWorldSocketFrame } from './world-presence-diagnostics'

const cohortSize = 8
const hotSector = 'atlas:58:28'
const worldStage = 'canvas[data-world-stage]'

type Participant = { page: Page; id: string; worldUrl: string }

function percentiles(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b)
  const at = (fraction: number) =>
    Number((sorted[Math.ceil(sorted.length * fraction) - 1] ?? 0).toFixed(1))
  return { samples: values.length, p50: at(0.5), p95: at(0.95), p99: at(0.99) }
}

export async function captureNativeBrowserWork(browser: Browser, info: TestInfo) {
  const client = await browser.newBrowserCDPSession()
  type Event = {
    name: string
    cat: string
    ph: string
    ts: number
    dur?: number
    pid: number
    tid: number
    args?: Record<string, unknown>
  }
  const traceEvents: Event[] = []
  let droppedEvents = 0
  const categories = 'toplevel,devtools.timeline,cc,gpu,disabled-by-default-devtools.timeline'
  client.on('Tracing.dataCollected', ({ value }) => {
    // The protocol declares trace events as unstructured dictionaries.
    for (const event of value as unknown as Event[]) {
      if (!['X', 'B', 'E', 'M', 'i', 'I'].includes(event.ph)) continue
      if (traceEvents.length >= 100_000) {
        droppedEvents++
        continue
      }
      // Timing and thread labels suffice for attribution. Omit URLs, request
      // details, stacks and other event arguments from the saved evidence.
      const { name, cat, ph, ts, dur, pid, tid } = event
      traceEvents.push({
        name,
        cat,
        ph,
        ts,
        dur,
        pid,
        tid,
        ...(ph === 'M' && typeof event.args?.name === 'string'
          ? { args: { name: event.args.name } }
          : {}),
      })
    }
  })
  try {
    await client.send('Tracing.start', { categories, transferMode: 'ReportEvents' })
    const startedAt = performance.now()
    try {
      // A separate four-second window preserves the untraced cadence sample.
      await new Promise((resolve) => setTimeout(resolve, 4000))
    } finally {
      const complete = new Promise<void>((resolve) =>
        client.once('Tracing.tracingComplete', () => resolve()),
      )
      await client.send('Tracing.end')
      await complete
    }
    await writeFile(
      info.outputPath('world-multiplayer-native-trace.json'),
      JSON.stringify({
        traceEvents,
        droppedEvents,
        categories,
        elapsedMs: performance.now() - startedAt,
      }),
    )
  } finally {
    await client.detach()
  }
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

async function requireHotspotDelivery(
  mover: Participant,
  before: WorldView,
  observers: Participant[],
  setInvalidationObserver: (receive: (id: string, sectorId: string) => void) => void,
  evidence: Record<string, unknown>,
) {
  const destination = { ...before.position, x: before.position.x - 1 }
  expect(destination.sectorId).toBe(hotSector)
  const samples = observers.map(() => ({
    firstInvalidationMs: null as number | null,
    authorizedMovementMs: null as number | null,
    blockedFallbackReads: 0,
    presenceResponses: 0,
    presenceErrors: 0,
    sceneSectors: null as number | null,
    peerCount: null as number | null,
    scoped: null as boolean | null,
    responseBytes: null as number | null,
  }))
  const detach: (() => Promise<void>)[] = []
  let started: number | undefined
  const isGeneralWorld = (url: URL) => url.pathname === '/api/world'
  const elapsed = () => Number((performance.now() - started!).toFixed(1))
  try {
    for (const [index, { page, id }] of observers.entries()) {
      const sample = samples[index]!
      const fresh = new WeakSet<Request>()
      const captureRequest = (request: Request) => {
        if (
          started !== undefined &&
          sample.firstInvalidationMs !== null &&
          request.method() === 'GET' &&
          new URL(request.url()).pathname === '/api/world/presence'
        )
          fresh.add(request)
      }
      const captureResponse = async (response: Response) => {
        if (!fresh.has(response.request()) || sample.authorizedMovementMs !== null) return
        sample.presenceResponses++
        try {
          if (!response.ok()) {
            sample.presenceErrors++
            return
          }
          const bytes = await response.body()
          const receipt = JSON.parse(bytes.toString('utf8')) as WorldLivePlayers
          if (sample.authorizedMovementMs !== null) return
          if (!receipt.registered || receipt.characterId !== id) return
          const peer = receipt.players.find(({ characterId }) => characterId === mover.id)
          if (
            !peer?.movement ||
            peer.movement.version <= before.version ||
            !(
              samePosition(peer.position, destination) ||
              peer.movement.route.some(({ position }) => samePosition(position, destination))
            )
          )
            return
          const scene = new Set(receipt.sceneSectorIds)
          sample.sceneSectors = scene.size
          sample.peerCount = receipt.players.length
          sample.responseBytes = bytes.byteLength
          sample.scoped =
            scene.has(hotSector) &&
            scene.size === receipt.sceneSectorIds.length &&
            scene.size <= 25 &&
            receipt.players.length <= 200 &&
            !('sectors' in receipt) &&
            !('atlas' in receipt) &&
            receipt.players.every(
              ({ characterId, position, movement }) =>
                characterId !== id &&
                scene.has(position.sectorId) &&
                (movement?.route.every(({ position }) => scene.has(position.sectorId)) ?? true),
            )
          sample.authorizedMovementMs = elapsed()
        } catch {
          // Record the boundary, not a response body or an error with a raw URL.
          sample.presenceErrors++
        }
      }
      const block = async (route: Route) => {
        if (route.request().method() !== 'GET') return route.continue()
        sample.blockedFallbackReads++
        await route.abort()
      }
      page.on('request', captureRequest)
      page.on('response', captureResponse)
      detach.push(async () => {
        page.off('request', captureRequest)
        page.off('response', captureResponse)
        await page.unroute(isGeneralWorld, block)
      })
      await page.route(isGeneralWorld, block)
    }
    const observerById = new Map(observers.map(({ id }, index) => [id, samples[index]!]))
    setInvalidationObserver((id, sectorId) => {
      if (started === undefined || sectorId !== hotSector) return
      const sample = observerById.get(id)
      if (sample && sample.firstInvalidationMs === null) sample.firstInvalidationMs = elapsed()
    })
    started = performance.now()
    const walk = await measured<WorldView>(() =>
      mover.page.request.post('/api/world', {
        headers: { 'x-world-response': 'movement' },
        data: {
          characterId: mover.id,
          expectedVersion: before.version,
          commandId: randomUUID(),
          intent: { kind: 'walk', destination },
        },
      }),
    )
    evidence.moveApproval = summarize([walk])
    expect(walk.status).toBe(200)
    expect(walk.body.version).toBeGreaterThan(before.version)
    expect(walk.body.route.at(-1)?.position ?? walk.body.position).toEqual(destination)
    await expect
      .poll(
        () => samples.filter(({ authorizedMovementMs }) => authorizedMovementMs !== null).length,
        {
          message:
            'All seven observers need a fresh registered movement receipt after the private broadcast',
          timeout: 12_000,
        },
      )
      .toBe(observers.length)
    expect(samples.every(({ scoped }) => scoped)).toBe(true)
  } finally {
    setInvalidationObserver(() => {})
    evidence.observers = samples
    evidence.broadcastMs = percentiles(
      samples.flatMap(({ firstInvalidationMs }) =>
        firstInvalidationMs === null ? [] : [firstInvalidationMs],
      ),
    )
    evidence.authorizedMovementMs = percentiles(
      samples.flatMap(({ authorizedMovementMs }) =>
        authorizedMovementMs === null ? [] : [authorizedMovementMs],
      ),
    )
    await Promise.all(detach.map((remove) => remove()))
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
  const participants: Participant[] = []
  const socket = {
    joins: 0,
    textBroadcasts: 0,
    binaryBroadcasts: 0,
    errors: 0,
    sampledFrameBytes: 0,
    maxJoinedSceneTopics: 0,
  }
  const browsersAttemptingJoin = new Set<string>()
  const browsersReceivingJoinReply = new Set<string>()
  const joined = new Map<string, Set<string>>()
  const sceneJoinCounts: Record<string, number> = {}
  let socketGeneration = 0
  let onInvalidation: (id: string, sectorId: string) => void = () => {}
  const result: Record<string, unknown> = {
    mode: 'Authenticated browser sessions on a disposable Supabase Auth/Postgres/Realtime stack',
    browser: browser.version(),
    cohortSize,
    frameProfile: '393×851 CSS px, DPR 2.75, runner Chromium without simulated CPU throttle',
    browsersJoiningExpectedScene: sceneJoinCounts,
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
      let documentGeneration = -1
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) documentGeneration = socketGeneration
      })
      page.on('websocket', (connection) => {
        if (new URL(connection.url()).pathname !== '/realtime/v1/websocket') return
        const generation = socketGeneration
        if (documentGeneration !== generation) return
        const joinRefs = new Map<string, string>()
        const topics = new Set<string>()
        joined.set(id, topics)
        const active = () => generation === socketGeneration && joined.get(id) === topics
        connection.on('close', () => {
          if (joined.get(id) === topics) joined.delete(id)
        })
        connection.on('socketerror', () => socket.errors++)
        connection.on('framesent', ({ payload }) => {
          if (!active()) return
          const frame = inspectWorldSocketFrame(payload)
          if (frame?.event === 'phx_join') {
            socket.joins++
            browsersAttemptingJoin.add(id)
            if (frame.ref) joinRefs.set(frame.ref, frame.sectorId)
          } else if (frame?.event === 'phx_leave') topics.delete(frame.sectorId)
        })
        connection.on('framereceived', ({ payload }) => {
          if (!active()) return
          const frame = inspectWorldSocketFrame(payload)
          if (!frame) return
          if (frame.changed) {
            if (frame.encoding === 'binary') socket.binaryBroadcasts++
            else socket.textBroadcasts++
            if (topics.has(frame.sectorId)) onInvalidation(id, frame.sectorId)
          }
          if (
            frame.event === 'phx_reply' &&
            frame.ref &&
            joinRefs.get(frame.ref) === frame.sectorId
          ) {
            joinRefs.delete(frame.ref)
            if (frame.status === 'ok') {
              browsersReceivingJoinReply.add(id)
              topics.add(frame.sectorId)
              socket.maxJoinedSceneTopics = Math.max(socket.maxJoinedSceneTopics, topics.size)
            }
          }
          if (frame.event === 'phx_close' || frame.event === 'phx_error')
            topics.delete(frame.sectorId)
          if (frame.status === 'error' || frame.event === 'phx_error') socket.errors++
          socket.sampledFrameBytes += Buffer.byteLength(payload)
        })
      })
    }

    const ids = new Set(participants.map(({ id }) => id))
    const load = (reload: boolean) => {
      socketGeneration++
      joined.clear()
      return Promise.all(
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
    }
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
      await expect
        .poll(
          () => {
            const count = participants.filter(({ id }, i) =>
              joined.get(id)?.has(starts[i]!.sectorId),
            ).length
            sceneJoinCounts[layout] = count
            return count
          },
          { timeout: 15_000 },
        )
        .toBe(cohortSize)
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
      if (layout === 'hotspot') expect(nearby).toEqual(Array(cohortSize).fill(cohortSize - 1))
      else expect(Math.max(...nearby)).toBeLessThan(cohortSize - 1)
      for (const { body } of snapshots) {
        const scene = new Set(body.sectors.map(({ id }) => id))
        expect(scene.size).toBeLessThanOrEqual(25)
        expect(body.players.every(({ position }) => scene.has(position.sectorId))).toBe(true)
      }
      result[layout] = {
        canvasReadyMs: percentiles(loaded),
        moveApproval: summarize(commands),
        arrivalObservedFromRequestMs: percentiles(arrivals),
        snapshot: summarize(snapshots),
        nearbyFixtureActors: nearby,
        loadedSectors: snapshots.map(({ body }) => body.sectors.length),
      }
    }

    const first = participants[0]!
    const canvas = first.page.locator(worldStage)
    await expect(canvas).toHaveAttribute('data-frame-p95', /\d/, { timeout: 30_000 })
    result.observerRendererCallbackP95Ms = Number(await canvas.getAttribute('data-frame-p95'))
    // The rolling counter above can still contain arrival work. Collect a
    // fresh window with all eight sessions connected after the move receipts.
    const profiles = await Promise.all(
      participants.map(async ({ page }) => {
        const client = await page.context().newCDPSession(page)
        await client.send('Performance.enable')
        const before = await client.send('Performance.getMetrics')
        return { client, before }
      }),
    )
    const postArrival = await canvas.evaluate((element) => {
      const stage = element as HTMLCanvasElement
      const started = performance.now()
      const previous = stage.dataset.renderDiagnostics
      const draws: { at: number; work: number; ground: number }[] = []
      const frameIntervals: number[] = []
      let lastFrame: number | undefined
      let lastTiming: string | undefined
      let raf = 0
      stage.dataset.renderDiagnostics = 'timing'
      return new Promise<{ draws: typeof draws; frameIntervals: number[] }>((resolve) => {
        const sample = (at: number) => {
          if (lastFrame !== undefined) frameIntervals.push(at - lastFrame)
          lastFrame = at
          const raw = stage.dataset.renderTiming
          if (raw && raw !== lastTiming) {
            lastTiming = raw
            const { startedAt, completedAt, groundBuildMs, groundResampleMs } = JSON.parse(raw)
            if (startedAt >= started && completedAt >= startedAt)
              draws.push({
                at: startedAt,
                work: completedAt - startedAt,
                ground: groundBuildMs + groundResampleMs,
              })
          }
          raf = requestAnimationFrame(sample)
        }
        raf = requestAnimationFrame(sample)
        setTimeout(() => {
          cancelAnimationFrame(raf)
          if (previous === undefined) delete stage.dataset.renderDiagnostics
          else stage.dataset.renderDiagnostics = previous
          resolve({ draws, frameIntervals })
        }, 4000)
      })
    })
    result.observerPostArrival = {
      rendererCallbackMs: percentiles(postArrival.draws.map(({ work }) => work)),
      groundBuildAndResampleMs: percentiles(postArrival.draws.map(({ ground }) => ground)),
      drawIntervalMs: percentiles(
        postArrival.draws.slice(1).map(({ at }, i) => at - postArrival.draws[i]!.at),
      ),
      browserFrameIntervalMs: percentiles(postArrival.frameIntervals),
    }
    result.hotspotBrowserWork = await Promise.all(
      profiles.map(async ({ client, before }, session) => {
        try {
          const after = await client.send('Performance.getMetrics')
          const previous = new Map(before.metrics.map(({ name, value }) => [name, value]))
          const current = new Map(after.metrics.map(({ name, value }) => [name, value]))
          const elapsed = (name: string) => {
            expect(previous.has(name) && current.has(name)).toBe(true)
            return Number(((current.get(name)! - previous.get(name)!) * 1000).toFixed(1))
          }
          return {
            session,
            elapsedMs: elapsed('Timestamp'),
            mainThreadBusyMs: elapsed('TaskDuration'),
            scriptMs: elapsed('ScriptDuration'),
            layoutMs: elapsed('LayoutDuration'),
            styleMs: elapsed('RecalcStyleDuration'),
          }
        } finally {
          await client.detach()
        }
      }),
    )
    await first.page.screenshot({ path: info.outputPath('world-multiplayer-hotspot.png') })
    await captureNativeBrowserWork(browser, info)

    result.reconnectCanvasReadyMs = percentiles(await load(true))
    await expect.poll(async () => (await world(first.page)).position.sectorId).toBe('atlas:59:28')
    await expect
      .poll(
        () => {
          const count = participants.filter(({ id }) => joined.get(id)?.has(hotSector)).length
          sceneJoinCounts.reconnectHotspot = count
          return count
        },
        { timeout: 15_000 },
      )
      .toBe(cohortSize)
    const mover = participants[2]!
    const delivery: Record<string, unknown> = {}
    result.reconnectedHotspotDelivery = delivery
    await requireHotspotDelivery(
      mover,
      await world(mover.page),
      participants.filter((participant) => participant !== mover),
      (receive) => {
        onInvalidation = receive
      },
      delivery,
    )
    expect(socket.maxJoinedSceneTopics).toBeLessThanOrEqual(25)
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
    if (close.some(({ status }) => status === 'rejected')) retired.push('page-close')
    for (let i = 0; !retired.includes('page-close') && i < participants.length; i += 2) {
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
            broadcasts: socket.textBroadcasts + socket.binaryBroadcasts,
            browsersAttemptingJoin: browsersAttemptingJoin.size,
            browsersReceivingJoinReply: browsersReceivingJoinReply.size,
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
