import { EventEmitter } from 'node:events'
import type { CDPSession } from '@playwright/test'
import { expect, it } from 'vitest'
import { traceWorldBrowserTasks } from './world-browser-task-trace'

it.each([false, true])(
  'retains native task timings and excludes sensitive arguments on failure=%s',
  async (fails) => {
    const session = new EventEmitter()
    let active = false
    let detached = false
    Object.assign(session, {
      async send(method: string) {
        if (method === 'Tracing.start') active = true
        if (method === 'Tracing.end') {
          session.emit('Tracing.dataCollected', {
            value: [
              {
                name: 'Paint',
                cat: 'devtools.timeline',
                ph: 'X',
                pid: 3,
                tid: 4,
                ts: 100,
                dur: 80,
                args: { token: 'private-secret', url: 'private-url' },
              },
            ],
          })
          session.emit('Tracing.tracingComplete', {})
        }
        return {}
      },
      async detach() {
        detached = true
      },
    })
    let saved: unknown
    const original = new Error('native assertion failed')
    const run = traceWorldBrowserTasks(
      session as unknown as CDPSession,
      async (trace) => {
        saved = trace
      },
      async () => {
        expect(active).toBe(true)
        if (fails) throw original
      },
    )
    if (fails) await expect(run).rejects.toBe(original)
    else await run
    expect(saved).toEqual({
      traceEvents: [
        { name: 'Paint', cat: 'devtools.timeline', ph: 'X', pid: 3, tid: 4, ts: 100, dur: 80 },
      ],
      droppedEvents: 0,
      excludedEvents: 0,
    })
    expect(JSON.stringify(saved)).not.toContain('private')
    expect(detached).toBe(true)
    expect(session.listenerCount('Tracing.dataCollected')).toBe(0)
  },
)

it('fails closed when native tracing cannot start and detaches without moving', async () => {
  const session = new EventEmitter()
  const failure = new Error('native tracing unavailable')
  let detached = false
  let moved = false
  Object.assign(session, {
    async send() {
      throw failure
    },
    async detach() {
      detached = true
    },
  })
  await expect(
    traceWorldBrowserTasks(
      session as unknown as CDPSession,
      async () => {},
      async () => {
        moved = true
      },
    ),
  ).rejects.toBe(failure)
  expect(moved).toBe(false)
  expect(detached).toBe(true)
  expect(session.listenerCount('Tracing.dataCollected')).toBe(0)
})

it('preserves a native assertion when diagnostic saving or detachment also fails', async () => {
  const session = new EventEmitter()
  const native = new Error('native threshold failed')
  Object.assign(session, {
    async send(method: string) {
      if (method === 'Tracing.end') session.emit('Tracing.tracingComplete', {})
      return {}
    },
    async detach() {
      throw new Error('session closed')
    },
  })
  await expect(
    traceWorldBrowserTasks(
      session as unknown as CDPSession,
      async () => {
        throw new Error('artifact failed')
      },
      async () => {
        throw native
      },
    ),
  ).rejects.toBe(native)
})

it('retains every relevant rendering event when unrelated scheduler noise exceeds the capture budget', async () => {
  const session = new EventEmitter()
  const resource = {
    name: 'Canvas2DResourceProviderSharedImage::ProduceCanvasResource',
    cat: 'blink',
    ph: 'X',
    pid: 1,
    tid: 1,
    ts: 100,
    dur: 80,
  }
  Object.assign(session, {
    async send(method: string) {
      if (method === 'Tracing.end') {
        session.emit('Tracing.dataCollected', {
          value: [
            ...Array.from({ length: 100_001 }, () => ({
              name: 'ThreadControllerImpl::RunTask',
              cat: 'toplevel',
              ph: 'X',
              ts: 1,
              dur: 1,
            })),
            resource,
            { name: 'FireAnimationFrame', cat: 'devtools.timeline', ph: 'X', ts: 180, dur: 7 },
          ],
        })
        session.emit('Tracing.tracingComplete', {})
      }
      return {}
    },
    async detach() {},
  })
  let saved: unknown
  await traceWorldBrowserTasks(
    session as unknown as CDPSession,
    async (trace) => {
      saved = trace
    },
    async () => {},
  )
  expect(saved).toEqual({
    traceEvents: [
      resource,
      { name: 'FireAnimationFrame', cat: 'devtools.timeline', ph: 'X', ts: 180, dur: 7 },
    ],
    droppedEvents: 0,
    excludedEvents: 100_001,
  })
})

it('still fails visibly if relevant rendering evidence itself exceeds the bounded capture', async () => {
  const session = new EventEmitter()
  Object.assign(session, {
    async send(method: string) {
      if (method === 'Tracing.end') {
        session.emit('Tracing.dataCollected', {
          value: Array.from({ length: 100_001 }, () => ({ name: 'Paint', ph: 'X', ts: 1, dur: 1 })),
        })
        session.emit('Tracing.tracingComplete', {})
      }
      return {}
    },
    async detach() {},
  })
  let saved: { droppedEvents: number; traceEvents: unknown[] } | undefined
  await expect(
    traceWorldBrowserTasks(
      session as unknown as CDPSession,
      async (trace) => {
        saved = trace as typeof saved
      },
      async () => {},
    ),
  ).rejects.toThrow('exceeded its bounded event capture')
  expect(saved?.droppedEvents).toBe(1)
  expect(saved?.traceEvents).toHaveLength(100_000)
})
