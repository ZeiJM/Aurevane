import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WorldLivePresence } from './world-live-presence'
import type { WorldView } from '@/world/types'

const initial = {
  characterId: 'owner',
  version: 4,
  livePresence: true,
  sectors: [{ id: 'scene-a' }],
  players: [],
  serverNow: 1000,
} as unknown as WorldView
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function fixture() {
  let current = initial
  const events = new Map<string, () => void>()
  const removed: string[] = []
  const accept = vi.fn()
  const read = vi.fn(async (view: WorldView, signal: AbortSignal) => {
    signal.throwIfAborted()
    return {
      characterId: view.characterId,
      version: view.version,
      serverNow: 1200,
      sceneSectorIds: view.sectors.map((s) => s.id),
      players: [],
      registered: true,
    }
  })
  const live = new WorldLivePresence({
    getView: () => current,
    read,
    accept,
    subscribe: (topic, changed) => {
      events.set(topic, changed)
      return () => {
        removed.push(topic)
        events.delete(topic)
      }
    },
  })
  return {
    live,
    events,
    removed,
    accept,
    read,
    setView: (v: WorldView) => {
      current = v
      live.update(v)
    },
  }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
it('coalesces 100 scene invalidations into one independent read', async () => {
  const f = fixture()
  f.live.update(initial)
  expect([...f.events.keys()]).toEqual(['world-scene:scene-a'])
  for (let i = 0; i < 100; i++) f.events.get('world-scene:scene-a')!()
  expect(f.read).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(100)
  expect(f.read).toHaveBeenCalledTimes(1)
  expect(f.accept).toHaveBeenCalledTimes(1)
  f.live.dispose()
})
it('aborts an old scene/version read and never accepts it after the owner moves', async () => {
  const f = fixture(),
    held = deferred<Awaited<ReturnType<typeof f.read>>>()
  f.read.mockImplementationOnce(async () => held.promise)
  f.live.update(initial)
  f.events.get('world-scene:scene-a')!()
  await vi.advanceTimersByTimeAsync(100)
  const signal = f.read.mock.calls[0]![1]
  f.setView({ ...initial, version: 5, sectors: [{ id: 'scene-b' }] as WorldView['sectors'] })
  expect(signal.aborted).toBe(true)
  expect(f.removed).toContain('world-scene:scene-a')
  held.resolve({
    characterId: 'owner',
    version: 4,
    serverNow: 1200,
    sceneSectorIds: ['scene-a'],
    players: [],
    registered: true,
  })
  await vi.advanceTimersByTimeAsync(100)
  expect(f.accept).not.toHaveBeenCalled()
  f.live.dispose()
})
it('allows one in-flight read and retains one follow-up for newer changes', async () => {
  const f = fixture(),
    held = deferred<Awaited<ReturnType<typeof f.read>>>()
  f.read.mockImplementationOnce(async () => held.promise)
  f.live.update(initial)
  f.events.get('world-scene:scene-a')!()
  await vi.advanceTimersByTimeAsync(100)
  for (let i = 0; i < 100; i++) f.events.get('world-scene:scene-a')!()
  await vi.advanceTimersByTimeAsync(500)
  expect(f.read).toHaveBeenCalledTimes(1)
  held.resolve({
    characterId: 'owner',
    version: 4,
    serverNow: 1200,
    sceneSectorIds: ['scene-a'],
    players: [],
    registered: true,
  })
  await vi.advanceTimersByTimeAsync(100)
  expect(f.read).toHaveBeenCalledTimes(2)
  f.live.dispose()
})
it('retries a pending peer invalidation when owned authority advances within the same scene', async () => {
  const f = fixture(),
    held = deferred<Awaited<ReturnType<typeof f.read>>>()
  f.read.mockImplementationOnce(async () => held.promise)
  f.live.update(initial)
  f.events.get('world-scene:scene-a')!()
  await vi.advanceTimersByTimeAsync(100)
  f.setView({ ...initial, version: 5 })
  await vi.advanceTimersByTimeAsync(100)
  expect(f.read).toHaveBeenCalledTimes(2)
  expect(f.accept).toHaveBeenCalledTimes(1)
  expect(f.accept.mock.calls[0]![1].version).toBe(5)
  held.resolve({
    characterId: 'owner',
    version: 4,
    serverNow: 1200,
    sceneSectorIds: ['scene-a'],
    players: [],
    registered: true,
  })
  await vi.advanceTimersByTimeAsync(100)
  expect(f.accept).toHaveBeenCalledTimes(1)
  f.live.dispose()
})
it.each(['character', 'version', 'scene', 'unregistered'] as const)(
  'rejects mismatched %s receipts',
  async (kind) => {
    const f = fixture()
    f.read.mockResolvedValueOnce({
      characterId: kind === 'character' ? 'other' : 'owner',
      version: kind === 'version' ? 3 : 4,
      serverNow: 1200,
      sceneSectorIds: kind === 'scene' ? ['hidden'] : ['scene-a'],
      players: [],
      registered: kind !== 'unregistered',
    })
    f.live.update(initial)
    f.events.get('world-scene:scene-a')!()
    await vi.advanceTimersByTimeAsync(100)
    expect(f.accept).not.toHaveBeenCalled()
    f.live.dispose()
  },
)
it('does not subscribe without capability, on inactive views or after disposal', async () => {
  const f = fixture()
  f.live.update({ ...initial, livePresence: false })
  expect(f.events.size).toBe(0)
  f.live.update(initial)
  f.live.update(initial, false)
  expect(f.events.size).toBe(0)
  f.live.update(initial)
  f.events.get('world-scene:scene-a')!()
  f.live.dispose()
  await vi.advanceTimersByTimeAsync(40000)
  expect(f.events.size).toBe(0)
  expect(f.read).not.toHaveBeenCalled()
})
it('renews the authorized subscription through a bounded background read', async () => {
  const f = fixture()
  f.live.update(initial)
  await vi.advanceTimersByTimeAsync(35000)
  expect(f.read).toHaveBeenCalledTimes(1)
  f.live.dispose()
})
