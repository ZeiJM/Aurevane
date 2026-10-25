import { installWorldRenderTiming } from './world-render-diagnostics'
import { openMapSettings, closeMapSettings } from './world-map-settings-helpers'
import {
  measurePeerMotionStep,
  observeWorldMovement,
  type PeerMotionSample,
} from './world-timing-metrics'
import {
  cleanupWorldPresenceFixtures,
  matchesWorldWalk,
  worldPresenceDiagnostics,
} from './world-presence-diagnostics'
import {
  expect,
  test,
  type Browser,
  type Frame,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { GRID_HEIGHT, GRID_WIDTH } from '../src/world/catalog'
import type { WorldView } from '../src/world/types'

const privateJoinErrorCategory = (value: unknown) => {
  const reason =
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : value && typeof value === 'object' && 'reason' in value
          ? String(value.reason)
          : ''
  for (const [category, pattern] of [
    ['permission', /unauthori[sz]ed|permission|access denied/i],
    ['invalid-token', /invalid.*(?:jwt|token)|(?:jwt|token).*expired/i],
    ['join-limit', /too_many_(?:channels|connections|joins)|tenant_events/i],
    ['database-pool', /pool|queue|dbconnection/i],
    ['timeout', /timed?[_ -]?out|timeout/i],
    ['transport', /network|websocket|transport|connect/i],
  ] as const)
    if (pattern.test(reason)) return category
  return reason ? 'other-error' : 'none'
}

async function verifyPrivateSceneAuthorization(
  page: Page,
  allowedSector: string,
  expectedOwnerId: string,
  info: TestInfo,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  expect(['127.0.0.1', 'localhost']).toContain(new URL(url).hostname)
  const cookies = await page.context().cookies()
  const sessionReader = createServerClient(url, key, {
    cookies: {
      getAll: () => cookies.map(({ name, value }) => ({ name, value })),
      setAll: () => {},
    },
  })
  const { data, error } = await sessionReader.auth.getSession()
  if (error || !data.session) throw new Error('The disposable browser account has no session.')
  const token = data.session.access_token
  const started = Date.now()
  const joinTimeoutsMs = { allowed: 5000, denied: 8000 }
  const allowedTopic = `world-scene:${allowedSector}`
  const deniedTopic = `world-scene:unregistered-${randomUUID()}`
  const events: Record<string, string | number | boolean>[] = []
  const record = (fields: Record<string, string | number | boolean>) => {
    if (events.length < 100)
      events.push({ at: new Date().toISOString(), elapsedMs: Date.now() - started, ...fields })
  }
  let claims: Record<string, unknown> = {}
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'),
    )
    if (decoded && typeof decoded === 'object' && !Array.isArray(decoded))
      claims = decoded as Record<string, unknown>
  } catch {
    // Report booleans below; never serialize the JWT or its decoded claims.
  }
  const identity = {
    sessionActorMatchesFixture: data.session.user.id === expectedOwnerId,
    jwtActorMatchesFixture: claims.sub === expectedOwnerId,
    jwtRoleAuthenticated: claims.role === 'authenticated',
    jwtExpiryValid:
      typeof claims.exp === 'number' &&
      Number.isFinite(claims.exp) &&
      claims.exp > Date.now() / 1000,
  }
  record({ phase: 'auth-identity', ...identity })
  const client = createClient(url, key, {
    accessToken: async () => token,
    realtime: {
      logger: (kind, message) => {
        // SDK log data and message text may contain credentials or socket payloads.
        // Record only allowlisted categories, never either raw value.
        const phase = message.includes(allowedTopic)
          ? 'allowed'
          : message.includes(deniedTopic)
            ? 'denied'
            : 'socket'
        const category = /phx_join/.test(message)
          ? 'join'
          : /phx_reply/.test(message)
            ? 'reply'
            : privateJoinErrorCategory(message)
        if (['transport', 'channel', 'push', 'receive', 'error'].includes(kind))
          record({ phase, kind, category })
      },
    },
  })
  await client.realtime.setAuth(data.session.access_token)
  record({ phase: 'auth', tokenReady: Boolean(client.realtime.accessTokenValue) })
  const allowed = client
    .channel(allowedTopic, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, () => {})
  const denied = client
    .channel(deniedTopic, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, () => {})
  const join = (channel: typeof allowed, shouldJoin: boolean) =>
    new Promise<void>((resolve, reject) => {
      const phase = shouldJoin ? 'allowed' : 'denied'
      // Realtime v2.124.4 delays rejected joins by 5s before phx_reply.
      // Allow transport margin for that explicit rejection; timeouts still fail.
      const timeoutMs = joinTimeoutsMs[phase]
      record({ phase, status: 'join-start', timeoutMs })
      channel.subscribe((status, channelError) => {
        const channelState = ['closed', 'joining', 'joined', 'leaving', 'errored'].includes(
          channel.state,
        )
          ? channel.state
          : 'other'
        const socketState = client.realtime.connectionState()
        record({
          phase,
          status,
          channelState,
          socketState: ['closed', 'connecting', 'open', 'closing'].includes(socketState)
            ? socketState
            : 'other',
          errorCategory: privateJoinErrorCategory(channelError),
          causeCategory: privateJoinErrorCategory(channelError?.cause),
        })
        if (status === 'SUBSCRIBED') {
          if (shouldJoin) resolve()
          else reject(new Error('The denied unregistered private scene was accepted.'))
        } else if (status === 'CHANNEL_ERROR') {
          if (
            !shouldJoin &&
            /unauthori[sz]ed|permission|access denied/i.test(channelError?.message ?? '')
          )
            resolve()
          else
            reject(
              new Error(
                `The ${phase} private scene join failed: ${privateJoinErrorCategory(channelError)} (${status}).`,
              ),
            )
        } else if (status === 'TIMED_OUT')
          reject(new Error(`The ${phase} private scene join timed out (${channelState}).`))
      }, timeoutMs)
    })
  try {
    for (const [check, passed] of Object.entries(identity)) expect(passed, check).toBe(true)
    await join(allowed, true)
    await join(denied, false)
  } finally {
    try {
      await client.removeAllChannels()
      record({ phase: 'cleanup', status: 'closed' })
    } finally {
      const path = info.outputPath('world-private-scene-join-diagnostics.json')
      await writeFile(path, JSON.stringify({ joinTimeoutsMs, events }, null, 2))
      await info.attach('world-private-scene-join-diagnostics', {
        path,
        contentType: 'application/json',
      })
    }
  }
}

export async function verifyWorldScenePresence(
  page: Page,
  browser: Browser,
  info: TestInfo,
  {
    enter,
    world,
    place,
    sql,
    capture,
    stageWalk,
  }: {
    enter: (page: Page) => Promise<string>
    world: (page: Page) => Promise<WorldView>
    place: (id: string, sector: string, x: number, y: number, safe?: boolean) => void
    sql: (query: string) => string
    capture: (page: Page, info: TestInfo, name: string) => Promise<void>
    stageWalk: (page: Page, position: WorldView['position']) => Promise<void>
  },
) {
  test.skip(info.project.name !== 'desktop-chromium', 'Exercise two-account presence once.')
  test.setTimeout(120000)
  const diagnostics = worldPresenceDiagnostics()
  diagnostics.observe(page, 'owner')
  const fixtureIds: string[] = []
  let failed = false
  const context = await browser.newContext({ baseURL: info.project.use.baseURL })
  try {
    await enter(page)
    const other = await context.newPage()
    diagnostics.observe(other, 'peer')
    await enter(other)
    const owner = await world(page),
      target = await world(other),
      id = target.characterId
    fixtureIds.push(owner.characterId, id)
    diagnostics.fixture('owner', owner.characterId)
    diagnostics.fixture('peer', id)
    const checkedWalk = (actor: Page, destination: WorldView['position']) => {
      const observer = actor === page ? 'owner' : 'peer'
      diagnostics.walk(observer, destination)
      const approval = actor
        .waitForResponse(
          (response) => {
            if (
              response.request().method() !== 'POST' ||
              new URL(response.url()).pathname !== '/api/world' ||
              !matchesWorldWalk(response.request().postDataJSON(), destination)
            )
              return false
            // Observe the controller's existing stale-version recovery within
            // this same deadline. The test never retries or repeats the click.
            if (response.status() === 409) {
              diagnostics.record({ observer, phase: 'walk-conflict', status: 409 })
              return false
            }
            return true
          },
          { timeout: 5000 },
        )
        .then(async (response) => {
          diagnostics.record({ observer, phase: 'walk-response', status: response.status() })
          expect(response.ok(), `${observer} matching walk must be accepted`).toBe(true)
          const receipt = (await response.json()) as WorldView & { kind?: string }
          expect(receipt.kind).toBe('movement')
          expect(receipt.characterId).toBe(actor === page ? owner.characterId : id)
          expect(receipt.version).toBeGreaterThan(response.request().postDataJSON().expectedVersion)
          expect(receipt.route.at(-1)?.position ?? receipt.position).toEqual(destination)
          diagnostics.record({ observer, phase: 'walk-approved' })
        })
      // Callers observe both immediately, while keeping arrival deadlines tied
      // to click completion rather than adding approval latency to the budget.
      return { click: stageWalk(actor, destination), approval }
    }
    // Stop the target's heartbeat before testing deliberately aged presence.
    await other.goto('about:blank')
    for (const uuid of [owner.characterId, id]) expect(uuid).toMatch(/^[0-9a-f-]{36}$/)
    place(owner.characterId, 'atlas:58:28', 12, 4)
    place(id, 'atlas:59:28', 0, 4)
    await page.reload()
    const canvas = page.locator('canvas[data-world-stage]'),
      player = page.locator(`[data-world-player="${id}"]`)
    await expect(player).toBeVisible({ timeout: 15000 })
    await expect(player.locator('img')).toHaveAttribute('src', /starter-portrait/)
    // This explicit second-account fixture makes density coverage non-vacuous.
    const density = await player.evaluate((row) => {
      const portrait = row.querySelector('img')!.getBoundingClientRect()
      const bounds = row.getBoundingClientRect()
      const action = row.querySelector('button')!.getBoundingClientRect()
      return {
        width: portrait.width,
        height: portrait.height,
        rowHeight: bounds.height,
        actionHeight: action.height,
      }
    })
    expect(density.width).toBe(36)
    expect(density.height).toBe(36)
    expect(density.rowHeight).toBeLessThanOrEqual(65)
    expect(density.actionHeight).toBeGreaterThanOrEqual(29)
    const targetName = (await world(page)).players.find((peer) => peer.characterId === id)!.name
    await expect(player.locator('strong')).toHaveText(targetName)
    await expect(player.locator('strong')).toHaveAttribute('title', targetName)
    await info.attach('nearby-row-density', {
      body: JSON.stringify(density),
      contentType: 'application/json',
    })

    await expect(player.getByRole('button', { name: 'Attack', exact: true })).toHaveCount(0)
    const scene = await world(page)
    expect(scene.players.some((p) => p.characterId === owner.characterId)).toBe(false)
    expect(scene.players.find((p) => p.characterId === id)).toMatchObject({
      position: { sectorId: 'atlas:59:28', x: 0, y: 4 },
      online: true,
      attackable: false,
    })
    expect(scene.sectors.length).toBeLessThanOrEqual(25)
    expect(scene.livePresence).toBe(true)
    const ownerUserId = sql(
      `select user_id::text from public.characters where id='${owner.characterId}'::uuid`,
    ).trim()
    await verifyPrivateSceneAuthorization(page, scene.position.sectorId, ownerUserId, info)
    await capture(page, info, 'nearby-across-sector-boundary')

    // Let globe mode schedule its slower idle timer, then return. Local
    // observation must restart promptly instead of retaining a ten-second wait.
    const globePresence = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).searchParams.has('presenceVersion'),
    )
    await page.getByRole('button', { name: /Open world atlas/ }).click()
    await globePresence
    const localPresence = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).searchParams.has('presenceVersion'),
      { timeout: 5000 },
    )
    await page.getByRole('button', { name: /Return to local map/ }).click()
    expect((await (await localPresence).json()).kind).toBe('presence')

    // Rejoin a real authenticated private channel before disabling fallback polling.
    let mainDocumentReady = false
    const joinedRequests = new WeakSet<Request>()
    const joinedNavigation = (frame: Frame) => {
      if (frame === page.mainFrame()) mainDocumentReady = true
    }
    const joinedRequest = (request: Request) => {
      if (
        mainDocumentReady &&
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/world/presence'
      )
        joinedRequests.add(request)
    }
    page.on('framenavigated', joinedNavigation)
    page.on('request', joinedRequest)
    try {
      const joinedPresence = page.waitForResponse(
        async (response) => {
          const request = response.request()
          // Reload can evict a preceding document's response body from CDP.
          // Reject its request before asking the browser to read that body.
          if (
            !joinedRequests.has(request) ||
            request.method() !== 'GET' ||
            new URL(response.url()).pathname !== '/api/world/presence' ||
            !response.ok()
          )
            return false
          const finishedError = await response.finished()
          if (request.failure()?.errorText === 'net::ERR_ABORTED') return false
          if (finishedError) throw finishedError
          const receipt = await response.json()
          return receipt.characterId === owner.characterId && receipt.registered === true
        },
        { timeout: 15000 },
      )
      await Promise.all([page.reload(), joinedPresence])
    } finally {
      page.off('framenavigated', joinedNavigation)
      page.off('request', joinedRequest)
    }

    // An idle observer must see a real second account walking, including with
    // ambient effects disabled. Probe the actual canvas nameplate, not React state.
    await openMapSettings(page)
    await page.getByRole('checkbox', { name: 'Ambient animation', exact: true }).uncheck()
    await closeMapSettings(page)
    await canvas.evaluate(
      (el, name) => {
        const ctx = document
            .querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!
            .getContext('2d')!,
          original = ctx.fillText.bind(ctx)
        const samples: { at: number; x: number; y: number }[] = []
        ctx.fillText = (text, x, y, maxWidth) => {
          if (text === name) {
            samples.push({ at: performance.now(), x, y })
            if (samples.length > 300) samples.shift()
            el.dataset.testRemoteDraws = JSON.stringify(samples)
          }
          if (maxWidth === undefined) original(text, x, y)
          else original(text, x, y, maxWidth)
        }
      },
      scene.players.find((p) => p.characterId === id)!.name,
    )
    await other.goto('/game/world')
    let blockedFallbackReads = 0
    const blockedRead = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        new URL(request.url()).pathname === '/api/world' &&
        new URL(request.url()).searchParams.has('presenceVersion'),
      { timeout: 5000 },
    )
    const fallbackRoute = async (route: import('@playwright/test').Route) => {
      if (route.request().method() === 'GET') {
        blockedFallbackReads++
        await route.abort()
      } else await route.continue()
    }
    await page.route('**/api/world?*', fallbackRoute)
    await blockedRead
    const startedAt = Date.now()
    const movedPresence = page.waitForResponse(
      async (response) => {
        if (
          response.request().method() !== 'GET' ||
          new URL(response.url()).pathname !== '/api/world/presence' ||
          !response.ok()
        )
          return false
        const receipt = await response.json()
        return (
          receipt.registered === true &&
          receipt.players.some(
            (p: WorldView['players'][number]) =>
              p.characterId === id &&
              (p.movement?.version ?? 0) >
                (scene.players.find((p) => p.characterId === id)?.movement?.version ?? 0) &&
              (p.movement?.route.length ?? 0) > 0,
          )
        )
      },
      { timeout: 12000 },
    )
    const destination = { sectorId: 'atlas:59:28', x: 4, y: 4 }
    let observed: { players: WorldView['players'] }
    const walking = checkedWalk(other, destination)
    const delivery = movedPresence.then(async (response) => ({
      observed: (await response.json()) as { players: WorldView['players'] },
      elapsedMs: Date.now() - startedAt,
    }))
    await observeWorldMovement([walking], async () => {
      try {
        const receipt = await delivery
        observed = receipt.observed
        const { elapsedMs } = receipt
        const deliveryPath = info.outputPath('world-live-peer-delivery.json')
        await writeFile(
          deliveryPath,
          JSON.stringify({
            elapsedMs,
            blockedFallbackReads,
            movement: observed.players.find((p) => p.characterId === id)?.movement,
          }),
        )
        await info.attach('world-live-peer-delivery', {
          path: deliveryPath,
          contentType: 'application/json',
        })
        expect(elapsedMs).toBeLessThan(2500)
        expect(blockedFallbackReads).toBeGreaterThan(0)
        await walking.click
      } finally {
        await page.unroute('**/api/world?*', fallbackRoute)
        await Promise.allSettled([delivery, walking.click])
      }
      expect(observed).not.toHaveProperty('sectors')
      expect(observed).not.toHaveProperty('atlas')
      await expect
        .poll(
          async () => {
            const samples = JSON.parse(
              (await canvas.getAttribute('data-test-remote-draws')) ?? '[]',
            ) as { x: number; y: number }[]
            return new Set(samples.map((sample) => `${sample.x}:${sample.y}`)).size
          },
          { timeout: 4000 },
        )
        .toBeGreaterThan(8)
      await expect
        .poll(async () => (await world(other)).position, { timeout: 12000 })
        .toEqual(destination)
      await expect
        .poll(async () => (await world(page)).players.find((p) => p.characterId === id)?.position, {
          timeout: 5000,
        })
        .toEqual(destination)
      expect((await world(page)).position).toEqual({ sectorId: 'atlas:58:28', x: 12, y: 4 })
      const remoteSamples = JSON.parse(
        (await canvas.getAttribute('data-test-remote-draws')) ?? '[]',
      ) as { at: number; x: number; y: number }[]
      const remoteDeltas = remoteSamples.slice(1).map((sample, index) => ({
        ms: sample.at - remoteSamples[index]!.at,
        x: sample.x - remoteSamples[index]!.x,
        y: sample.y - remoteSamples[index]!.y,
      }))
      const tile = Number(await canvas.getAttribute('data-tile-size'))
      expect(remoteDeltas.length).toBeGreaterThan(8)
      for (const delta of remoteDeltas) {
        expect(delta.x).toBeGreaterThanOrEqual(0)
        expect(delta.y).toBeGreaterThanOrEqual(0)
        expect(delta.x).toBeLessThan(tile * 0.85)
        expect(delta.y).toBeLessThan(tile * 0.44)
      }
      const motionPath = info.outputPath('world-live-peer-interpolation.json')
      await writeFile(motionPath, JSON.stringify({ remoteSamples, remoteDeltas, tile }))
      await info.attach('world-live-peer-interpolation', {
        path: motionPath,
        contentType: 'application/json',
      })
    })
    await capture(page, info, 'idle-observer-smooth-remote-arrival')

    // Both observers now move across the scene boundary. Compensate each
    // nameplate for its own moving camera so camera motion cannot masquerade
    // as a smoothly moving peer.
    const movingObservers = [
      { page, peerId: id, distance: 3 },
      { page: other, peerId: owner.characterId, distance: 4 },
    ]
    for (const observer of movingObservers) {
      await observer.page.locator('canvas[data-world-stage]').evaluate(installWorldRenderTiming)
      const peerName = (await world(observer.page)).players.find(
        (peer) => peer.characterId === observer.peerId,
      )!.name
      await observer.page.locator('canvas[data-world-stage]').evaluate((el, name) => {
        const identity = document.querySelector<HTMLCanvasElement>('canvas[data-world-identity]')!,
          ctx = identity.getContext('2d')!,
          original = ctx.fillText.bind(ctx)
        const longTasks: { at: number; durationMs: number }[] = []
        const tasks = new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries())
            longTasks.push({ at: entry.startTime, durationMs: entry.duration })
          if (longTasks.length > 100) longTasks.splice(0, longTasks.length - 100)
          el.dataset.testMovingObserverLongTasks = JSON.stringify(longTasks)
        })
        tasks.observe({ type: 'longtask' })
        const samples: {
          at: number
          frameAt: number
          paintingMs: number
          tileSize: number
          identityRatio: number
          x: number
          y: number
        }[] = []
        ctx.fillText = (text, x, y, maxWidth) => {
          if (text === name) {
            const tile = Number(el.dataset.tileSize),
              east = (x - identity.clientWidth / 2) / (tile * 0.85),
              north = (y - identity.clientHeight / 2) / (tile * 0.44)
            // The fixed label offset cancels when comparing consecutive draws.
            samples.push({
              at: performance.now(),
              frameAt: Number(el.dataset.frameNow),
              paintingMs: performance.now() - Number(el.dataset.frameStarted),
              tileSize: tile,
              identityRatio: identity.width / identity.clientWidth,
              x: Number(el.dataset.cameraX) + (east + north) / 2,
              y: Number(el.dataset.cameraY) + (north - east) / 2,
            })
            if (samples.length > 1500) samples.shift()
            el.dataset.testMovingObserverDraws = JSON.stringify(samples)
          }
          if (maxWidth === undefined) original(text, x, y)
          else original(text, x, y, maxWidth)
        }
      }, peerName)
    }
    const ownerDestination = { sectorId: 'atlas:59:28', x: 3, y: 4 },
      peerDestination = { sectorId: 'atlas:59:28', x: 7, y: 4 }
    const walks = [checkedWalk(page, ownerDestination), checkedWalk(other, peerDestination)]
    await observeWorldMovement(walks, async () => {
      await Promise.all(walks.map((walk) => walk.click))
      await Promise.all([
        expect.poll(async () => (await world(page)).position).toEqual(ownerDestination),
        expect.poll(async () => (await world(other)).position).toEqual(peerDestination),
      ])
      for (const [index, observer] of movingObservers.entries()) {
        await expect
          .poll(
            async () => {
              const draws = JSON.parse(
                (await observer.page
                  .locator('canvas[data-world-stage]')
                  .getAttribute('data-test-moving-observer-draws')) ?? '[]',
              ) as { x: number }[]
              return draws.length ? draws.at(-1)!.x - draws[0]!.x : 0
            },
            { timeout: 5000 },
          )
          .toBeGreaterThan(observer.distance - 0.6)
        const samples = JSON.parse(
          (await observer.page
            .locator('canvas[data-world-stage]')
            .getAttribute('data-test-moving-observer-draws')) ?? '[]',
        ) as PeerMotionSample[]
        const motionSteps = samples
          .slice(1)
          .map((sample, i) => measurePeerMotionStep(samples[i]!, sample))
        const deltas = motionSteps.map((step) => step.deltaX)
        const path = info.outputPath(`world-both-moving-peer-${index}.json`)
        const { longTasks, renderTimings } = await observer.page
          .locator('canvas[data-world-stage]')
          .evaluate((el) => ({
            longTasks: JSON.parse(
              el.getAttribute('data-test-moving-observer-long-tasks') ?? '[]',
            ) as {
              at: number
              durationMs: number
            }[],
            renderTimings: JSON.parse(
              el.getAttribute('data-test-render-timings') ?? '[]',
            ) as Record<string, number>[],
          }))
        await writeFile(
          path,
          JSON.stringify({
            samples,
            deltas,
            motionSteps,
            longTasks,
            renderTimings,
            distance: observer.distance,
          }),
        )
        await info.attach(`world-both-moving-peer-${index}`, {
          path,
          contentType: 'application/json',
        })
        expect(deltas.filter((delta) => delta > 0.002).length).toBeGreaterThan(8)
        expect(samples.at(-1)!.x - samples[0]!.x).toBeGreaterThan(observer.distance - 0.6)
        expect(samples.at(-1)!.x - samples[0]!.x).toBeLessThan(observer.distance + 0.6)
        for (const [stepIndex, step] of motionSteps.entries()) {
          expect(
            step.elapsedMs,
            `peer ${index}, step ${stepIndex}: increasing sample time`,
          ).toBeGreaterThan(0)
          expect(
            step.deltaX,
            `peer ${index}, step ${stepIndex}: no backwards jump`,
          ).toBeGreaterThan(-0.1)
          expect(
            step.deltaX,
            `peer ${index}, step ${stepIndex}: ${step.elapsedMs.toFixed(1)}ms animation / ${step.paintElapsedMs.toFixed(1)}ms paint gap; ${longTasks.length} observed long tasks`,
          ).toBeLessThan(step.maximumDeltaX)
          expect(
            Math.abs(step.deltaY),
            `peer ${index}, step ${stepIndex}: eastward approved route stays on its row`,
          ).toBeLessThanOrEqual(step.projectionError)
        }
      }
    })
    await capture(page, info, 'both-walking-smooth-remote-arrival')
    await other.goto('about:blank')
    // Restore the initial neighbouring placement before the viewport/privacy cases.
    place(owner.characterId, 'atlas:58:28', 12, 4)
    place(id, 'atlas:59:28', 0, 4)
    await page.reload()

    // Choose a real loaded land tile outside this viewport, but inside the wider
    // view at 60% zoom. No intercepted presence responses or fabricated players.
    const box = (await canvas.boundingBox())!,
      metrics = await canvas.evaluate((el) => ({
        x: Number(el.dataset.cameraX),
        y: Number(el.dataset.cameraY),
        tile: Number(el.dataset.tileSize),
      }))
    const outside = scene.sectors.flatMap((sector) =>
      sector.cells
        .filter((cell) => cell.walkable)
        .flatMap((cell) => {
          const dx = (sector.atlasColumn ?? 0) * GRID_WIDTH + cell.x + 0.5 - metrics.x,
            dy = (sector.atlasRow ?? 0) * GRID_HEIGHT + cell.y + 0.5 - metrics.y,
            sx = (dx - dy) * metrics.tile * 0.85,
            sy = (dx + dy) * metrics.tile * 0.44,
            offscreen = Math.abs(sx) > box.width / 2 + 35 || Math.abs(sy) > box.height / 2 + 55,
            zoomedInside =
              Math.abs(sx * 0.6) < box.width / 2 - 40 && Math.abs(sy * 0.6) < box.height / 2 - 60
          return offscreen && zoomedInside ? [{ sector, cell }] : []
        }),
    )[0]
    expect(outside).toBeDefined()
    place(id, outside!.sector.id, outside!.cell.x, outside!.cell.y)
    await page.reload()
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(true)
    await expect(player).toHaveCount(0)
    await openMapSettings(page)
    const zoom = page.getByRole('slider', { name: 'Zoom level', exact: true })
    await zoom.focus()
    await zoom.press('Home')
    for (let i = 0; i < 25; i++) await zoom.press('ArrowRight')
    await expect(zoom).toHaveValue('60')
    await closeMapSettings(page)
    await expect(player).toBeVisible({ timeout: 10000 })
    await capture(page, info, 'nearby-follows-zoom-viewport')

    // The same authenticated API must suppress undiscovered and remote positions.
    place(owner.characterId, 'survey-01', 6, 8)
    place(id, 'survey-01', 11, 1)
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)
    place(owner.characterId, 'atlas:58:28', 12, 4)
    place(id, 'atlas:0:0', 0, 4)
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)

    // Idle visibility retains the original authority's ten-minute open-ground
    // expiry and safe-town offline presence. No combat eligibility is broadened.
    place(id, 'atlas:59:28', 0, 4)
    sql(
      `update app_private.character_world_state set last_seen_at=now()-interval '11 minutes' where character_id='${id}'`,
    )
    expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)
    place(id, 'atlas:59:28', 0, 4, true)
    const offline = (await world(page)).players.find((p) => p.characterId === id)
    expect(offline).toMatchObject({ online: false, attackable: false })
    place(id, 'atlas:59:28', 0, 4)
    sql(
      `update app_private.character_world_state set last_seen_at=now()-interval '2 minutes' where character_id='${id}'`,
    )
    expect((await world(page)).players.find((p) => p.characterId === id)).toMatchObject({
      online: false,
      attackable: false,
    })
    sql(
      `insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) select id,user_id,now(),now()+interval '24 hours' from public.characters where id='${id}'`,
    )
    try {
      expect((await world(page)).players.some((p) => p.characterId === id)).toBe(false)
    } finally {
      sql(`delete from app_private.character_deletion_requests where character_id='${id}'`)
    }

    const signature = 'public.read_world_scene_players_v1(uuid,uuid,bigint,text[],jsonb)'
    expect(
      sql(
        `select has_function_privilege('anon','${signature}','EXECUTE'),has_function_privilege('authenticated','${signature}','EXECUTE'),has_function_privilege('service_role','${signature}','EXECUTE')`,
      ),
    ).toBe('f|f|t')
    const args = `c.user_id,c.id,(w.state->>'version')::bigint,array['atlas:58:28','atlas:59:28'],w.state->'position'`,
      from = `from public.characters c join app_private.character_world_state w on w.character_id=c.id where c.id='${owner.characterId}'`
    expect(
      sql(
        `select public.read_world_scene_players_v1(c.user_id,c.id,(w.state->>'version')::bigint+1,array['atlas:58:28'],w.state->'position')->'players' ${from}`,
      ),
    ).toBe('[]')
    expect(
      sql(
        `select jsonb_array_length(public.read_world_scene_players_v1(${args})->'players')<=200 ${from}`,
      ),
    ).toBe('t')
    sql(
      `do $$ declare c record; begin select ch.user_id,ch.id,w.state into c from public.characters ch join app_private.character_world_state w on w.character_id=ch.id where ch.id='${owner.characterId}'; begin perform public.read_world_scene_players_v1(c.user_id,c.id,1,array_fill('atlas:58:28'::text,array[26]),c.state->'position'); raise exception 'Invalid scene was accepted'; exception when invalid_parameter_value then null; end; begin perform public.read_world_scene_players_v1('00000000-0000-4000-8000-000000000099',c.id,1,array['atlas:58:28'],c.state->'position'); raise exception 'Wrong owner was accepted'; exception when insufficient_privilege then null; end; end $$`,
    )
  } catch (error) {
    failed = true
    diagnostics.record({ phase: 'case-failed' })
    throw error
  } finally {
    const cleanupErrors: string[] = []
    try {
      await diagnostics.captureMotion()
    } catch {
      cleanupErrors.push('motion-capture')
    }
    cleanupErrors.push(
      ...(await cleanupWorldPresenceFixtures(
        fixtureIds,
        [() => page.close(), () => context.close()],
        sql,
      )),
    )
    diagnostics.record({
      phase: 'cleanup',
      retired: cleanupErrors.length === 0,
      failureCount: cleanupErrors.length,
    })
    try {
      await diagnostics.save(info)
      const path = info.outputPath('world-presence-cleanup.json')
      await writeFile(
        path,
        JSON.stringify({ fixtureCount: fixtureIds.length, errors: cleanupErrors }),
      )
      await info.attach('world-presence-cleanup', { path, contentType: 'application/json' })
    } catch {
      cleanupErrors.push('diagnostic-save')
    }
    if (cleanupErrors.length) {
      info.annotations.push({
        type: 'world-presence-cleanup',
        description: cleanupErrors.join(', '),
      })
      // Preserve the assertion that failed first; cleanup remains separately visible.
      if (!failed) throw new Error(`World fixture cleanup failed: ${cleanupErrors.join(', ')}`)
    }
  }
}

/** Disposable real accounts: slow scene presentation must not delay arrival controls. */
export async function verifyWorldInstantActions(
  page: Page,
  browser: Browser,
  info: TestInfo,
  helpers: Parameters<typeof verifyWorldScenePresence>[3],
) {
  test.skip(info.project.name !== 'desktop-chromium', 'Exercise canonical arrival actions once.')
  test.setTimeout(120000)
  await helpers.enter(page)
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin })
  try {
    const other = await context.newPage()
    await helpers.enter(other)
    const owner = await helpers.world(page),
      target = await helpers.world(other)
    await other.goto('about:blank')
    helpers.place(owner.characterId, 'verdant-expanse', 5, 4)
    helpers.place(target.characterId, 'verdant-expanse', 2, 4, true)
    await page.reload()
    const row = page.locator(`[data-world-player="${target.characterId}"]`),
      primary = row.locator('[data-world-primary-action]')
    await expect(primary).toHaveText('Approach')
    await expect(page.locator('[data-world-zone]')).toHaveText('Safe Zone')
    const before = (await primary.boundingBox())!
    let compact = 0
    const movementReceipts: Promise<void>[] = []
    page.on('response', (response) => {
      if (
        new URL(response.url()).pathname === '/api/world' &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON()?.intent?.kind === 'walk'
      ) {
        const check = response.json().then((body) => {
          expect(body.kind).toBe('movement')
          expect(body).not.toHaveProperty('sectors')
          compact++
        })
        movementReceipts.push(check)
        void check.catch(() => {})
      }
    })
    const delayedScenes: Promise<void>[] = []
    let delayEnabled = true
    const delayScene = (route: Route) => {
      if (delayEnabled && route.request().method() === 'GET') {
        const held = (async () => {
          const response = await route.fetch()
          expect(response.ok()).toBe(true)
          await page.waitForTimeout(900)
          await route.fulfill({ response })
        })()
        delayedScenes.push(held)
        void held.catch(() => {}) // Observe now; cleanup still propagates every failed response.
        return held
      }
      return route.continue()
    }
    await page.route('**/api/world*', delayScene)
    try {
      await primary.click()
      await expect(primary).toHaveText('Attack')
      await expect(primary).toBeDisabled()
      await expect(page.locator('[data-world-zone]')).toHaveText('Safe Zone')
      await expect(primary).toHaveCSS('background-color', 'rgb(24, 48, 56)')
      const themedArrow = /url\(".*\/cursors\/stone-arrow\.png"\) 6 3, auto$/
      await expect(primary).toHaveCSS('cursor', themedArrow)
      await expect(row.getByRole('button', { name: 'Talk', exact: true })).toHaveCSS(
        'cursor',
        themedArrow,
      )
      await expect
        .poll(async () => (await helpers.world(page)).position, { timeout: 12000 })
        .toEqual({ sectorId: 'verdant-expanse', x: 3, y: 4 })
      const after = (await primary.boundingBox())!
      expect(after.width).toBe(before.width)
      expect(after.height).toBe(before.height)
      await expect(row.getByRole('button', { name: 'Talk', exact: true })).toBeDisabled()
      expect(
        (await row.getByRole('button', { name: 'Talk', exact: true }).boundingBox())!.x,
      ).toBeLessThan(after.x)
      await expect.poll(() => compact).toBeGreaterThan(0)
      await helpers.capture(page, info, 'instant-approach-protected-attack')
    } finally {
      // Removing a handler releases its in-flight routes. Fulfill held reads first,
      // while subsequent GETs pass through, and retain failures instead of hiding them.
      delayEnabled = false
      const responses = await Promise.allSettled(delayedScenes)
      await page.unroute('**/api/world*', delayScene)
      const failure = responses.find((response) => response.status === 'rejected')
      if (failure?.status === 'rejected') throw failure.reason
    }
    // Move the fixture away; a completed approach must be available again.
    helpers.place(owner.characterId, 'verdant-expanse', 10, 4)
    helpers.place(target.characterId, 'verdant-expanse', 12, 4)
    const legal = await helpers.world(page)
    const cells = legal.sectors.find((sector) => sector.id === 'verdant-expanse')!.cells
    for (const x of [10, 11, 12])
      expect(cells.find((cell) => cell.x === x && cell.y === 4)?.safe).toBe(false)
    await page.reload()
    await expect(primary).toHaveText('Approach')
    await primary.click()
    await expect(primary).toHaveText('Attack')
    await expect(primary).toBeEnabled({ timeout: 12000 })
    await expect(page.locator('[data-world-zone]')).toHaveText('PvP Zone')
    await page.mouse.move(0, 0)
    await expect(primary).toHaveCSS('background-color', 'rgb(116, 35, 40)')
    // Keep held movement active when the legal primary action gains focus.
    // It must supersede queued walking without a release retarget ahead of it.
    const canvas = page.locator('canvas[data-world-stage]')
    const commands: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/world' && request.method() === 'POST')
        commands.push(request.postDataJSON()?.intent?.kind)
    })
    const walkStarted = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === '/api/world' &&
        request.method() === 'POST' &&
        request.postDataJSON()?.intent?.kind === 'walk',
    )
    await canvas.focus()
    await page.keyboard.down('d')
    await walkStarted
    await primary.click()
    await page.keyboard.up('d')
    await expect(page).toHaveURL(/\/game\/battle\//, { timeout: 20000 })
    expect(commands).toContain('attack')
    expect(commands.at(-1)).toBe('attack')
    await Promise.all(movementReceipts)
    await helpers.capture(page, info, 'instant-approach-legal-encounter')
  } finally {
    await context.close()
  }
}
