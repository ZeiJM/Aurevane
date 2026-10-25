import { describe, expect, it, vi } from 'vitest'
import type { Page, TestInfo } from '@playwright/test'
import { EventEmitter } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  cleanupWorldPresenceFixtures,
  matchesWorldWalk,
  summarizeWorldSocketFrame,
  worldPresenceDiagnostics,
} from './world-presence-diagnostics'

const owner = '00000000-0000-4000-8000-000000000001'
const peer = '00000000-0000-4000-8000-000000000002'
const unrelated = '00000000-0000-4000-8000-000000000003'

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
