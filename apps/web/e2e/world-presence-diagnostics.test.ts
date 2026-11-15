import { describe, expect, it, vi } from 'vitest'
import type { Page, TestInfo } from '@playwright/test'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
vi.mock('server-only', () => ({}))
import { projectWorld } from '../src/server/world/world-service'
import { newWorldState } from '../src/world/travel'
import {
  cleanupWorldPresenceFixtures,
  findWorldHeldAttackCorridor,
  inspectWorldSocketFrame,
  matchesWorldWalk,
  summarizeWorldSocketFrame,
  worldPresenceDiagnostics,
} from './world-presence-diagnostics'

const owner = '00000000-0000-4000-8000-000000000001'
const peer = '00000000-0000-4000-8000-000000000002'
const unrelated = '00000000-0000-4000-8000-000000000003'

describe('held-key attack fixture geometry', () => {
  it('finds canonical supplied open territory whose eastward held route stays in attack range', () => {
    const view = projectWorld(newWorldState(), [], 1000)
    const corridor = findWorldHeldAttackCorridor(view)
    expect(corridor).not.toBeNull()
    if (!corridor) return
    const sector = view.sectors.find((candidate) => candidate.id === corridor.target.sectorId)!
    expect(sector.charted).toBe(true)
    for (const position of [corridor.start, corridor.approach, corridor.target])
      expect(
        sector.cells.find((cell) => cell.x === position.x && cell.y === position.y),
      ).toMatchObject({
        walkable: true,
        safe: false,
      })
    // The held planner can land only on the target; it cannot plan past the wall.
    for (const position of [corridor.approach, corridor.target]) {
      expect(position.sectorId).toBe(corridor.target.sectorId)
      expect(
        Math.abs(position.x - corridor.target.x) + Math.abs(position.y - corridor.target.y),
      ).toBeLessThanOrEqual(1)
    }
    expect(
      sector.cells.find((cell) => cell.x === corridor.target.x + 1 && cell.y === corridor.target.y),
    ).toMatchObject({ walkable: false })
    expect(
      sector.exits.some(
        (exit) => exit.from.x === corridor.target.x && exit.from.y === corridor.target.y,
      ),
    ).toBe(false)
  })

  it.each(['private', 'safe', 'missing-wall', 'blocked-approach', 'exit'] as const)(
    'rejects a %s corridor instead of changing its authoritative terrain',
    (reason) => {
      const view = projectWorld(newWorldState(), [], 1000)
      const sector = view.sectors[0]!
      const position = (x: number) => ({ sectorId: sector.id, x, y: 4 })
      const cells = [2, 3, 4, 5].map((x) => ({
        x,
        y: 4,
        terrain: x === 5 ? '#' : '.',
        walkable: x !== 5,
        safe: false,
      }))
      if (reason === 'safe') cells[1]!.safe = true
      if (reason === 'missing-wall') cells.pop()
      if (reason === 'blocked-approach') cells[1]!.walkable = false
      const exits =
        reason === 'exit'
          ? [
              {
                from: position(4),
                to: { ...position(0), sectorId: 'elsewhere' },
                durationMs: 200,
                name: 'Exit',
              },
            ]
          : []
      expect(
        findWorldHeldAttackCorridor({
          sectors: [{ ...sector, charted: reason !== 'private', cells, exits }],
        }),
      ).toBeNull()
    },
  )
})

describe('World failure boundary diagnostics', () => {
  const destination = { sectorId: 'atlas:59:28', x: 4, y: 4 }
  it('matches only a walk to the requested destination', () => {
    expect(matchesWorldWalk({ intent: { kind: 'walk', destination } }, destination)).toBe(true)
    for (const body of [
      null,
      {},
      { intent: { kind: 'tick', destination } },
      { intent: { kind: 'walk', destination: { ...destination, x: 7 } } },
    ])
      expect(matchesWorldWalk(body, destination)).toBe(false)
  })

  it.each(['object', 'array'])(
    'records a %s private join reply without tokens, topic IDs or payloads',
    (format) => {
      const topic = 'realtime:world-scene:atlas:59:28'
      const payload = { status: 'ok', response: { access_token: 'secret', private: 'do not log' } }
      const frame =
        format === 'object'
          ? { topic, event: 'phx_reply', payload }
          : ['1', '2', topic, 'phx_reply', payload]
      expect(summarizeWorldSocketFrame(JSON.stringify(frame))).toEqual({
        event: 'phx_reply',
        status: 'ok',
        ownerOrigin: false,
        peerOrigin: true,
      })
    },
  )

  it('records denial without copying the backend reason or unrelated messages', () => {
    expect(
      summarizeWorldSocketFrame(
        JSON.stringify({
          topic: 'realtime:world-scene:atlas:58:28',
          event: 'phx_reply',
          payload: { status: 'error', response: { reason: 'secret-token' } },
        }),
      ),
    ).toEqual({ event: 'phx_reply', status: 'error', ownerOrigin: true, peerOrigin: false })
    expect(summarizeWorldSocketFrame('{not JSON')).toBeNull()
    expect(
      summarizeWorldSocketFrame(
        JSON.stringify({ topic: 'other', event: 'phx_reply', payload: { status: 'ok' } }),
      ),
    ).toBeNull()
  })

  it('counts a V2 binary World invalidation without decoding metadata or user payload', () => {
    const topic = Buffer.from('realtime:world-scene:atlas:58:28')
    const userEvent = Buffer.from('changed')
    const metadata = Buffer.from('{"private":"never copy"}')
    const frame = Buffer.concat([
      Buffer.from([4, topic.length, userEvent.length, metadata.length, 1]),
      topic,
      userEvent,
      metadata,
      Buffer.from('{}'),
    ])
    expect(summarizeWorldSocketFrame(frame)).toEqual({
      event: 'broadcast',
      status: 'none',
      ownerOrigin: true,
      peerOrigin: false,
    })
    expect(summarizeWorldSocketFrame(frame.subarray(0, 12))).toBeNull()
    expect(summarizeWorldSocketFrame(Buffer.from([3, ...frame.subarray(1)]))).toBeNull()
    expect(summarizeWorldSocketFrame(Buffer.from([4, 1, 1, 0, 0, 97, 98]))).toBeNull()
  })

  it('distinguishes the World changed event from unrelated text broadcasts and join replies', () => {
    const topic = 'realtime:world-scene:atlas:58:28'
    const inspect = (event: string, payload: unknown) =>
      inspectWorldSocketFrame(JSON.stringify(['1', '19', topic, event, payload]))
    expect(inspect('broadcast', { event: 'changed' })).toMatchObject({
      sectorId: 'atlas:58:28',
      changed: true,
      encoding: 'text',
    })
    expect(inspect('broadcast', { event: 'chat' })?.changed).toBe(false)
    expect(inspect('phx_reply', { status: 'ok', event: 'changed' })).toMatchObject({
      sectorId: 'atlas:58:28',
      ref: '19',
      changed: false,
      status: 'ok',
    })
  })

  it.each(['no-request', 'rejected-request', 'presence-failure'])(
    'saves early %s evidence and cleanup without secrets or raw payloads',
    async (boundary) => {
      const directory = await mkdtemp(join(tmpdir(), 'world-boundaries-'))
      try {
        const emitter = new EventEmitter()
        const page = Object.assign(emitter, {
          locator: () => ({ evaluate: async () => Promise.reject(new Error('missing canvas')) }),
        }) as unknown as Page
        const attach = vi.fn(async () => {})
        const info = {
          outputPath: (name: string) => join(directory, name),
          attach,
        } as unknown as TestInfo
        const diagnostics = worldPresenceDiagnostics()
        diagnostics.observe(page, 'owner')
        diagnostics.fixture('owner', owner)
        diagnostics.fixture('peer', peer)
        diagnostics.walk('owner', destination)
        if (boundary !== 'no-request') {
          const url = `http://localhost/api/world${boundary === 'presence-failure' ? '/presence' : ''}?token=secret-token`
          emitter.emit('request', {
            url: () => url,
            method: () => (boundary === 'presence-failure' ? 'GET' : 'POST'),
            postDataJSON: () => ({ intent: { kind: 'walk', destination }, token: 'secret-token' }),
          })
          emitter.emit('response', {
            url: () => url,
            status: () => (boundary === 'presence-failure' ? 503 : 403),
            json: async () => ({ characterId: owner, error: 'secret-backend-detail' }),
          })
        }
        diagnostics.record({ phase: 'case-failed' })
        await diagnostics.captureMotion()
        diagnostics.record({ phase: 'cleanup', retired: false, failureCount: 1 })
        await diagnostics.save(info)
        const raw = await readFile(join(directory, 'world-presence-boundaries.json'), 'utf8')
        const result = JSON.parse(raw) as { events: { phase: string; status?: number }[] }
        expect(result.events.map((event) => event.phase)).toEqual(
          expect.arrayContaining(['walk-start', 'case-failed', 'motion-unavailable', 'cleanup']),
        )
        expect(result.events.some((event) => event.phase === 'request')).toBe(
          boundary !== 'no-request',
        )
        if (boundary !== 'no-request')
          expect(result.events).toContainEqual(
            expect.objectContaining({
              phase: 'response',
              status: boundary === 'presence-failure' ? 503 : 403,
            }),
          )
        for (const forbidden of ['secret-token', 'secret-backend-detail', owner, peer, 'http://'])
          expect(raw).not.toContain(forbidden)
        expect(attach).toHaveBeenCalledWith('world-presence-boundaries', {
          path: join(directory, 'world-presence-boundaries.json'),
          contentType: 'application/json',
        })
        expect(emitter.listenerCount('response')).toBe(0)
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    },
  )

  it('stops duplicating response-body parsing before native motion timing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'world-boundaries-'))
    try {
      const emitter = new EventEmitter()
      const page = Object.assign(emitter, {
        locator: () => ({ evaluate: async () => Promise.reject(new Error('missing canvas')) }),
      }) as unknown as Page
      const diagnostics = worldPresenceDiagnostics()
      diagnostics.observe(page, 'owner')
      const firstBody = vi.fn(async () => ({ characterId: owner, players: [] }))
      emitter.emit('response', {
        url: () => 'http://localhost/api/world',
        status: () => 200,
        json: firstBody,
      })
      await diagnostics.suspendResponseBodyInspection()
      expect(firstBody).toHaveBeenCalledOnce()

      const timedBody = vi.fn(async () => ({ characterId: owner, players: [] }))
      emitter.emit('response', {
        url: () => 'http://localhost/api/world',
        status: () => 200,
        json: timedBody,
      })
      await diagnostics.save({
        outputPath: (name: string) => join(directory, name),
        attach: async () => {},
      } as unknown as TestInfo)
      expect(timedBody).not.toHaveBeenCalled()
      const result = JSON.parse(
        await readFile(join(directory, 'world-presence-boundaries.json'), 'utf8'),
      ) as { events: { phase: string; status?: number }[] }
      expect(result.events).toContainEqual(
        expect.objectContaining({ phase: 'response', status: 200 }),
      )
      expect(result.events).toContainEqual(
        expect.objectContaining({ phase: 'response-body-inspection-suspended' }),
      )
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe('World presence fixture retirement', () => {
  it('retires only this case after both pages stop, including after a failed walk', async () => {
    const order: string[] = []
    // A failed repeat left a peer on x4. Closing its page alone must not count
    // as retirement: the real authority retains offline open-ground peers for 10m.
    const sql = vi.fn((query: string) => {
      expect(order).toEqual(['owner-stopped', 'peer-stopped'])
      expect(query).toContain("'safe', false")
      expect(query).toContain("last_seen_at = now() - interval '11 minutes'")
      expect(query).toContain(`where character_id = any(array['${owner}','${peer}']::uuid[])`)
      expect(query).not.toContain(unrelated)
      expect(query).toContain("'route', '[]'::jsonb")
      expect(query).toContain("'nextStepAt', null")
      return '2'
    })
    const original = new Error('strict movement failure')
    let captured: unknown
    try {
      throw original
    } catch (error) {
      captured = error
    } finally {
      expect(
        await cleanupWorldPresenceFixtures(
          [owner, peer],
          [
            async () => {
              order.push('owner-stopped')
            },
            async () => {
              order.push('peer-stopped')
            },
          ],
          sql,
        ),
      ).toEqual([])
    }
    expect(captured).toBe(original)
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it('does not mutate while a page may still be running and still stops the other page', async () => {
    const second = vi.fn(async () => {})
    const sql = vi.fn(() => '2')
    expect(
      await cleanupWorldPresenceFixtures(
        [owner, peer],
        [
          async () => {
            throw new Error('close')
          },
          second,
        ],
        sql,
      ),
    ).toEqual(['page-close'])
    expect(second).toHaveBeenCalledOnce()
    expect(sql).not.toHaveBeenCalled()
  })

  it.each([['bad-id'], [owner, peer, unrelated]])(
    'rejects an unbounded or invalid fixture set %j',
    async (...ids) => {
      const sql = vi.fn(() => '2')
      expect(await cleanupWorldPresenceFixtures(ids, [], sql)).toEqual(['fixture-identity'])
      expect(sql).not.toHaveBeenCalled()
    },
  )

  it('reports a failed retirement without replacing the original test error', async () => {
    const sql = () => {
      throw new Error('database detail must not leak')
    }
    expect(await cleanupWorldPresenceFixtures([owner], [], sql)).toEqual(['fixture-retirement'])
  })

  it('requires all tracked fixture rows to be retired', async () => {
    expect(await cleanupWorldPresenceFixtures([owner, peer], [], () => '1')).toEqual([
      'fixture-retirement',
    ])
  })
})
