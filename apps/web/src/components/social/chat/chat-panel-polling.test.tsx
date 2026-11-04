import { type EffectCallback } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { effects } = vi.hoisted(() => ({ effects: [] as EffectCallback[] }))
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useEffect: (effect: EffectCallback) => effects.push(effect),
}))

import type { ChannelId, ChatMessage } from './chat-api'
import { ChatPanel } from './chat-panel'

const cleanups: (() => void)[] = []
let visibility: 'visible' | 'hidden'
let visibilityListeners: Set<() => void>
const request = vi.fn<typeof fetch>()
const message: ChatMessage = {
  id: 10,
  channelKey: 'world',
  kind: 'chat',
  body: 'Hello',
  createdAt: '2026-11-04T12:00:00Z',
  senderCharacterId: 'other',
  senderName: 'Other',
  senderLevel: 1,
  replyTo: null,
}

const calls = (path: string) =>
  request.mock.calls.filter(([url]) => String(url).split('?')[0] === path)

async function mount(lockedChannel?: ChannelId) {
  renderToStaticMarkup(<ChatPanel selfName="Nick" lockedChannel={lockedChannel} />)
  for (const effect of effects.splice(0)) {
    const cleanup = effect()
    if (cleanup) cleanups.push(cleanup)
  }
  await vi.advanceTimersByTimeAsync(0)
}

async function setVisibility(next: 'visible' | 'hidden') {
  visibility = next
  visibilityListeners.forEach((listener) => listener())
  await vi.advanceTimersByTimeAsync(0)
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  visibilityListeners = new Set()
  vi.stubGlobal('window', { setInterval, clearInterval, setTimeout, clearTimeout })
  vi.stubGlobal('document', {
    get visibilityState() {
      return visibility
    },
    addEventListener: (event: string, listener: () => void) => {
      if (event === 'visibilitychange') visibilityListeners.add(listener)
    },
    removeEventListener: (_event: string, listener: () => void) =>
      visibilityListeners.delete(listener),
  })
  request.mockReset().mockImplementation(async (url) => {
    if (String(url).startsWith('/api/chat/messages')) return Response.json({ messages: [] })
    if (url === '/api/chat/settings')
      return Response.json({ settings: { defaultChannel: 'world' } })
    return Response.json({ typers: [] })
  })
  vi.stubGlobal('fetch', request)
})

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  effects.splice(0)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('chat background request budget', () => {
  it('makes no recurring requests while initially hidden and catches up when visible', async () => {
    visibility = 'hidden'
    await mount()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls('/api/chat/messages')).toHaveLength(0)
    expect(calls('/api/chat/inbox')).toHaveLength(0)
    await setVisibility('visible')
    expect(calls('/api/chat/messages')).toHaveLength(1)
    expect(calls('/api/chat/inbox')).toHaveLength(1)
  })

  it('pauses messages and private typing reads while hidden', async () => {
    await mount('whisper:other')
    expect(calls('/api/chat/messages')).toHaveLength(1)
    expect(calls('/api/chat/typing')).toHaveLength(1)
    await setVisibility('hidden')
    const before = request.mock.calls.length
    await vi.advanceTimersByTimeAsync(120_000)
    expect(request).toHaveBeenCalledTimes(before)
    expect(vi.getTimerCount()).toBe(0)
    await setVisibility('visible')
    expect(calls('/api/chat/messages')).toHaveLength(2)
    expect(calls('/api/chat/typing')).toHaveLength(2)
  })

  it('does not overlap slow channel reads or fork a second read on tab return', async () => {
    let finish!: (response: Response) => void
    request.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/chat/messages'))
        return new Promise((resolve) => {
          finish = resolve
        })
      return Response.json({ settings: { defaultChannel: 'world' } })
    })
    await mount('world')
    await vi.advanceTimersByTimeAsync(10_000)
    await setVisibility('hidden')
    await setVisibility('visible')
    expect(calls('/api/chat/messages')).toHaveLength(1)
    finish(Response.json({ messages: [] }))
    await vi.advanceTimersByTimeAsync(2500)
    expect(calls('/api/chat/messages')).toHaveLength(2)
  })

  it('marks a message read once, retaining periodic reaction refreshes', async () => {
    request.mockImplementation(async (url) =>
      String(url).startsWith('/api/chat/messages')
        ? Response.json({ messages: [message] })
        : Response.json({ settings: { defaultChannel: 'world' } }),
    )
    await mount('world')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(calls('/api/chat/read')).toHaveLength(1)
    expect(String(calls('/api/chat/messages')[3]?.[0])).toContain('after=0')
  })

  it('retries a failed read receipt even if the next message batch is empty', async () => {
    let first = true
    let failRead = true
    request.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/chat/messages')) {
        const messages = first ? [message] : []
        first = false
        return Response.json({ messages })
      }
      if (url === '/api/chat/read' && failRead) {
        failRead = false
        return Response.json({}, { status: 503 })
      }
      return Response.json({ settings: { defaultChannel: 'world' } })
    })
    await mount('world')
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls('/api/chat/read')).toHaveLength(2)
  })

  it('removes recurring timers and visibility listeners on unmount', async () => {
    await mount()
    cleanups.splice(0).forEach((cleanup) => cleanup())
    expect(vi.getTimerCount()).toBe(0)
    expect(visibilityListeners.size).toBe(0)
    const before = request.mock.calls.length
    await vi.advanceTimersByTimeAsync(30_000)
    expect(request).toHaveBeenCalledTimes(before)
  })

  it('backs off unavailable message reads instead of hammering the server', async () => {
    request.mockImplementation(async (url) =>
      String(url).startsWith('/api/chat/messages')
        ? Response.json({}, { status: 503 })
        : Response.json({ settings: { defaultChannel: 'world' } }),
    )
    await mount('world')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls('/api/chat/messages').length).toBeLessThanOrEqual(5)
    await setVisibility('hidden')
    await setVisibility('visible')
    expect(calls('/api/chat/messages').length).toBeLessThanOrEqual(5)
  })

  it('does not acknowledge messages received after the tab is hidden', async () => {
    let finish!: (response: Response) => void
    request.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/chat/messages'))
        return new Promise((resolve) => {
          finish = resolve
        })
      return Response.json({ settings: { defaultChannel: 'world' } })
    })
    await mount('world')
    await setVisibility('hidden')
    finish(Response.json({ messages: [message] }))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls('/api/chat/read')).toHaveLength(0)
    expect(calls('/api/chat/messages')).toHaveLength(1)
    await setVisibility('visible')
    finish(Response.json({ messages: [message] }))
    await vi.advanceTimersByTimeAsync(0)
    expect(calls('/api/chat/read')).toHaveLength(1)
  })

  it('backs off failed private typing reads and restores their cadence after recovery', async () => {
    let unavailable = true
    request.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/chat/typing'))
        return Response.json({ typers: [] }, { status: unavailable ? 503 : 200 })
      if (String(url).startsWith('/api/chat/messages')) return Response.json({ messages: [] })
      return Response.json({ settings: { defaultChannel: 'world' } })
    })
    await mount('whisper:other')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls('/api/chat/typing').length).toBeLessThanOrEqual(5)
    unavailable = false
    await vi.advanceTimersByTimeAsync(15_000)
    const recovered = calls('/api/chat/typing').length
    await vi.advanceTimersByTimeAsync(2500)
    expect(calls('/api/chat/typing')).toHaveLength(recovered + 1)
  })

  it('does not acknowledge or restart an in-flight channel request after unmount', async () => {
    let finish!: (response: Response) => void
    request.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/chat/messages'))
        return new Promise((resolve) => {
          finish = resolve
        })
      return Response.json({ settings: { defaultChannel: 'world' } })
    })
    await mount('world')
    cleanups.splice(0).forEach((cleanup) => cleanup())
    finish(Response.json({ messages: [message] }))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls('/api/chat/read')).toHaveLength(0)
    expect(calls('/api/chat/messages')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    expect(visibilityListeners.size).toBe(0)
  })
})
