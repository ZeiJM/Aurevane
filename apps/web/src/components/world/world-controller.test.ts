import { describe, expect, it, vi } from 'vitest'
import type { WorldView } from '@/world/types'
import { WorldConflict, WorldController } from './world-controller'
const view = { version: 1 } as WorldView
const deferred = () => {
  let resolve!: (value: WorldView) => void
  const promise = new Promise<WorldView>((r) => (resolve = r))
  return { promise, resolve }
}
describe('world command ordering', () => {
  it('does not rewind a new preview when an earlier idle refresh finishes', async () => {
    const read = deferred(),
      accept = vi.fn(),
      controller = new WorldController(view, {
        refresh: () => read.promise,
        command: async () => ({ ...view, version: 3 }),
        accept,
        busy: vi.fn(),
        error: vi.fn(),
      })
    const refreshing = controller.refresh(),
      walking = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 2, y: 2 } })
    read.resolve({ ...view, version: 2 })
    await refreshing
    await walking
    expect(accept.mock.calls.map((call) => call[1])).toEqual([false, true])
  })
  it('coalesces an attack that is already in flight', async () => {
    const result = deferred(),
      command = vi.fn().mockReturnValue(result.promise)
    const controller = new WorldController(view, {
      command,
      refresh: vi.fn(),
      accept: vi.fn(),
      busy: vi.fn(),
      error: vi.fn(),
    })
    const a = controller.send({ kind: 'attack', targetId: 'one' }),
      b = controller.send({ kind: 'attack', targetId: 'one' })
    expect(a).toBe(b)
    result.resolve({ ...view, version: 2 })
    await a
    expect(command).toHaveBeenCalledTimes(1)
  })
  it('acknowledges a queued attack immediately and coalesces repeated clicks on that target', async () => {
    const tick = deferred(),
      busy = vi.fn(),
      command = vi
        .fn()
        .mockReturnValueOnce(tick.promise)
        .mockResolvedValue({ ...view, version: 3, battleSessionId: 'battle' })
    const controller = new WorldController(view, {
      command,
      busy,
      refresh: vi.fn(),
      accept: vi.fn(),
      error: vi.fn(),
    })
    const pendingTick = controller.send({ kind: 'tick' })
    const a = controller.send({ kind: 'attack', targetId: 'one' })
    const b = controller.send({ kind: 'attack', targetId: 'one' })
    const movement = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 2, y: 2 } })
    expect(busy.mock.calls[1]![0]).toEqual({ kind: 'attack', targetId: 'one' })
    tick.resolve({ ...view, version: 2 })
    await pendingTick
    await a
    await b
    expect(await movement).toEqual({ applied: false })
    expect(command).toHaveBeenCalledTimes(2)
  })
  it('keeps the latest click, suppresses stale motion and resolves superseded receipts', async () => {
    const first = deferred(),
      accept = vi.fn(),
      command = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue({ ...view, version: 3 })
    const controller = new WorldController(view, {
      command,
      accept,
      refresh: vi.fn(),
      error: vi.fn(),
      busy: vi.fn(),
    })
    const a = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 1, y: 1 } })
    const b = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 2, y: 1 } })
    const c = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 3, y: 1 } })
    expect(await b).toEqual({ applied: false })
    expect(await controller.send({ kind: 'tick' })).toEqual({ applied: false })
    first.resolve({ ...view, version: 2 })
    await a
    await c
    expect(command).toHaveBeenCalledTimes(2)
    expect(command.mock.calls[1]![1].version).toBe(2)
    expect(accept.mock.calls.map((call) => call[1])).toEqual([false, true])
  })
  it('refreshes a conflict once and retries against the returned version', async () => {
    const command = vi
        .fn()
        .mockRejectedValueOnce(new WorldConflict())
        .mockResolvedValue({ ...view, version: 5 }),
      refresh = vi.fn().mockResolvedValue({ ...view, version: 4 })
    const controller = new WorldController(view, {
      command,
      refresh,
      accept: vi.fn(),
      error: vi.fn(),
      busy: vi.fn(),
    })
    expect((await controller.send({ kind: 'stop' })).applied).toBe(true)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(command.mock.calls[1]![1].version).toBe(4)
  })
  it('does not overwrite or discard an encounter with a newer movement request', async () => {
    const first = deferred(),
      command = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue({ ...view, version: 3 })
    const controller = new WorldController(view, {
      command,
      refresh: vi.fn(),
      accept: vi.fn(),
      error: vi.fn(),
      busy: vi.fn(),
    })
    const attack = controller.send({ kind: 'attack', targetId: 'target-a' }),
      walk = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 3, y: 1 } })
    first.resolve({ ...view, version: 2 })
    await attack
    await walk
    expect(command.mock.calls[0]![0]).toEqual({ kind: 'attack', targetId: 'target-a' })
  })
})
