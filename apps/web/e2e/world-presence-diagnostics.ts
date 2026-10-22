import type { Page, Request, Response, TestInfo, WebSocket } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import type { WorldPosition, WorldView } from '../src/world/types'

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

export function matchesWorldWalk(body: unknown, destination: WorldPosition): boolean {
  const intent = object(object(body).intent)
  const point = object(intent.destination)
  return (
    intent.kind === 'walk' &&
    point.sectorId === destination.sectorId &&
    point.x === destination.x &&
    point.y === destination.y
  )
}

export function summarizeWorldSocketFrame(payload: string | Buffer) {
  try {
    const raw: unknown = JSON.parse(payload.toString())
    const frame = Array.isArray(raw)
      ? { topic: raw[2], event: raw[3], payload: raw[4] }
      : object(raw)
    const event = frame.event
    if (
      typeof frame.topic !== 'string' ||
      !frame.topic.startsWith('realtime:world-scene:') ||
      typeof event !== 'string' ||
      !['phx_join', 'phx_reply', 'phx_error', 'phx_close', 'broadcast', 'system'].includes(event)
    )
      return null
    const status = object(frame.payload).status
    return {
      event,
      status: status === 'ok' || status === 'error' ? status : 'none',
      ownerOrigin: frame.topic === 'realtime:world-scene:atlas:58:28',
      peerOrigin: frame.topic === 'realtime:world-scene:atlas:59:28',
    }
  } catch {
    return null
  }
}

type Observer = 'owner' | 'peer'

/** Test-only boundary evidence. Never serialize URLs, bodies, tokens or identities. */
export function worldPresenceDiagnostics() {
  const started = Date.now()
  const events: Record<string, string | number | boolean>[] = []
  const pending = new Set<Promise<void>>()
  const detach: (() => void)[] = []
  const ids = new Map<Observer, string>()
  const pages = new Map<Observer, Page>()
  const destinations = new Map<Observer, WorldPosition>()
  const motion: Record<string, unknown> = {}
  const record = (fields: Record<string, string | number | boolean>) => {
    if (events.length < 1500) events.push({ elapsedMs: Date.now() - started, ...fields })
  }
  const endpoint = (url: string) => {
    const pathname = new URL(url).pathname
    return pathname === '/api/world'
      ? 'world'
      : pathname === '/api/world/presence'
        ? 'presence'
        : null
  }
  return {
    record,
    fixture: (observer: Observer, id: string) => {
      ids.set(observer, id)
    },
    walk: (observer: Observer, destination: WorldPosition) => {
      destinations.set(observer, destination)
      record({ observer, phase: 'walk-start' })
    },
    observe(page: Page, observer: Observer) {
      pages.set(observer, page)
      const request = (request: Request) => {
        const route = endpoint(request.url())
        if (!route) return
        const method = request.method()
        const destination = destinations.get(observer)
        record({
          observer,
          phase: 'request',
          endpoint: route,
          method,
          matchingWalk:
            method === 'POST' &&
            Boolean(destination && matchesWorldWalk(request.postDataJSON(), destination)),
        })
      }
      const failed = (request: Request) => {
        const route = endpoint(request.url())
        if (route)
          record({
            observer,
            phase: 'request-failed',
            endpoint: route,
            aborted: request.failure()?.errorText === 'net::ERR_ABORTED',
          })
      }
      const response = (response: Response) => {
        const route = endpoint(response.url())
        if (!route) return
        const task = (async () => {
          record({ observer, phase: 'response', endpoint: route, status: response.status() })
          const body = object(await response.json())
          const players = Array.isArray(body.players) ? (body.players as WorldView['players']) : []
          const peer = players.find(
            (player) => player.characterId === ids.get(observer === 'owner' ? 'peer' : 'owner'),
          )
          const destination = destinations.get(observer)
          record({
            observer,
            phase: 'receipt',
            endpoint: route,
            registered: body.registered === true,
            actorMatches: body.characterId === ids.get(observer),
            version:
              typeof body.version === 'number' && Number.isFinite(body.version) ? body.version : -1,
            routeLength: Array.isArray(body.route) ? body.route.length : 0,
            peerPresent: Boolean(peer),
            peerVersion: peer?.movement?.version ?? -1,
            peerRouteLength: peer?.movement?.route.length ?? 0,
            playerCount: players.length,
            foreignAtDestination: destination
              ? players.filter(
                  (player) =>
                    ![...ids.values()].includes(player.characterId) &&
                    player.position.sectorId === destination.sectorId &&
                    player.position.x === destination.x &&
                    player.position.y === destination.y,
                ).length
              : 0,
          })
        })().catch(() => {
          record({ observer, phase: 'response-body-unavailable', endpoint: route })
        })
        pending.add(task)
        void task.finally(() => pending.delete(task))
      }
      const socket = (socket: WebSocket) => {
        if (new URL(socket.url()).pathname !== '/realtime/v1/websocket') return
        record({ observer, phase: 'socket-open' })
        const frame = (direction: string, payload: string | Buffer) => {
          const summary = summarizeWorldSocketFrame(payload)
          if (summary) record({ observer, phase: direction, ...summary })
        }
        socket.on('framesent', ({ payload }) => frame('framesent', payload))
        socket.on('framereceived', ({ payload }) => frame('framereceived', payload))
        socket.on('close', () => record({ observer, phase: 'socket-close' }))
        socket.on('socketerror', () => record({ observer, phase: 'socket-error' }))
      }
      const pageerror = () => record({ observer, phase: 'page-error' })
      page.on('request', request)
      page.on('requestfailed', failed)
      page.on('response', response)
      page.on('websocket', socket)
      page.on('pageerror', pageerror)
      detach.push(() => {
        page.off('request', request)
        page.off('requestfailed', failed)
        page.off('response', response)
        page.off('websocket', socket)
        page.off('pageerror', pageerror)
      })
    },
    async captureMotion() {
      for (const [observer, page] of pages) {
        try {
          motion[observer] = await page.locator('canvas[data-world-stage]').evaluate(
            (el) => ({
              remote: JSON.parse(el.getAttribute('data-test-remote-draws') ?? '[]'),
              moving: JSON.parse(el.getAttribute('data-test-moving-observer-draws') ?? '[]'),
              renderTimings: JSON.parse(el.getAttribute('data-test-render-timings') ?? '[]'),
              longTasks: JSON.parse(
                el.getAttribute('data-test-moving-observer-long-tasks') ?? '[]',
              ),
            }),
            undefined,
            { timeout: 1000 },
          )
        } catch {
          record({ observer, phase: 'motion-unavailable' })
        }
      }
    },
    async save(info: TestInfo) {
      for (const remove of detach) remove()
      await Promise.allSettled([...pending])
      const path = info.outputPath('world-presence-boundaries.json')
      await writeFile(path, JSON.stringify({ events, truncated: events.length === 1500, motion }))
      await info.attach('world-presence-boundaries', { path, contentType: 'application/json' })
    },
  }
}

export async function cleanupWorldPresenceFixtures(
  characterIds: readonly string[],
  stop: readonly (() => Promise<unknown>)[],
  sql: (query: string) => string,
): Promise<string[]> {
  const results = await Promise.allSettled(stop.map((close) => Promise.resolve().then(close)))
  if (results.some((result) => result.status === 'rejected')) return ['page-close']
  const ids = [...new Set(characterIds)]
  if (ids.length > 2 || ids.some((id) => !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)))
    return ['fixture-identity']
  if (!ids.length) return []
  try {
    // Deleting World rows would expose the character at the reader's fallback
    // origin. Retire only these local fixtures through the existing idle filter.
    const count = sql(`with retired as (
      update app_private.character_world_state
      set state = state || jsonb_build_object('safe', false, 'route', '[]'::jsonb, 'nextStepAt', null),
          last_seen_at = now() - interval '11 minutes'
      where character_id = any(array[${ids.map((id) => `'${id}'`).join(',')}]::uuid[])
      returning character_id
    ) select count(*) from retired`).trim()
    return count === String(ids.length) ? [] : ['fixture-retirement']
  } catch {
    return ['fixture-retirement']
  }
}
