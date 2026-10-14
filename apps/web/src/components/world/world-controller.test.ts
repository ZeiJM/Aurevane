import { describe, expect, it, vi } from 'vitest'
import type { WorldView } from '@/world/types'
import { WorldConflict, WorldController } from './world-controller'
const view = { version: 1 } as WorldView
const deferred = () => {
  let resolve!: (value: WorldView) => void
  const promise = new Promise<WorldView>((r) => (resolve = r))
  return { promise, resolve }
}
it('settles approved walking before refreshing its presentation on tab return', async () => {
  const start = {
    ...view,
    characterId: 'owner',
    position: { sectorId: 'a', x: 1, y: 4 },
    route: [{ position: { sectorId: 'a', x: 2, y: 4 }, durationMs: 200 }],
    sectors: [],
    players: [],
  } as WorldView
  const landed = { ...start, version: 2, position: start.route[0]!.position, route: [] }
  let settled = false
  const controller = new WorldController(start, {
    command: async () => {
      settled = true
      return landed
    },
    refresh: async () => (settled ? landed : start),
    accept: vi.fn(),
    presentation: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  await controller.refresh(true)
  expect(controller.view.position).toEqual({ sectorId: 'a', x: 2, y: 4 })
  expect(controller.view.version).toBe(2)
  expect(controller.view.route).toEqual([])
  controller.dispose()
})
it('ignores a pre-return idle read after due movement resumes through the command queue', async () => {
  const start = {
    ...view,
    characterId: 'owner',
    position: { sectorId: 'a', x: 1, y: 4 },
    route: [{ position: { sectorId: 'a', x: 2, y: 4 }, durationMs: 200 }],
  } as WorldView
  const stale = deferred(),
    tick = deferred()
  let signal: AbortSignal | undefined
  const controller = new WorldController(start, {
    command: () => tick.promise,
    refresh: (received) => {
      signal = received
      return stale.promise
    },
    accept: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  const previousRead = controller.refresh()
  const returning = controller.refresh(true)
  expect(signal?.aborted).toBe(true)
  stale.resolve({ ...start, version: 999 })
  await previousRead
  expect(controller.pending).toBe(true)
  tick.resolve({ ...start, version: 2, position: start.route[0]!.position, route: [] })
  await returning
  expect(controller.view.position).toEqual({ sectorId: 'a', x: 2, y: 4 })
  expect(controller.view.version).toBe(2)
  expect(controller.pending).toBe(false)
  controller.dispose()
})
it('refreshes a blocked tab return without advancing its saved route', async () => {
  const start = {
    ...view,
    characterId: 'owner',
    position: { sectorId: 'a', x: 1, y: 4 },
    route: [{ position: { sectorId: 'a', x: 2, y: 4 }, durationMs: 200 }],
    movementBlocked: 'Stop Passive Training to travel.',
  } as WorldView
  const controller = new WorldController(start, {
    command: async () => ({ ...start, position: start.route[0]!.position, version: 3 }),
    refresh: async () => ({ ...start, version: 2 }),
    accept: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  await controller.refresh(true)
  expect(controller.view.position).toEqual(start.position)
  expect(controller.view.version).toBe(2)
  expect(controller.view.movementBlocked).toBe('Stop Passive Training to travel.')
  controller.dispose()
})
it('updates peers during a pending command without resetting owned movement or invoking reconciliation', async () => {
  const current = {
    ...view,
    characterId: 'owner',
    serverNow: 1000,
    nextStepAt: 1200,
    sectors: [],
    players: [],
    route: [{ position: { sectorId: 'a', x: 2, y: 2 }, durationMs: 200 }],
  } as WorldView
  const held = deferred(),
    accept = vi.fn()
  const controller = new WorldController(current, {
    command: () => held.promise,
    refresh: vi.fn(),
    accept,
    error: vi.fn(),
    busy: vi.fn(),
  })
  const pending = controller.send({ kind: 'tick' })
  const players = [{ characterId: 'peer' }] as WorldView['players']
  expect(controller.acceptPlayers(current, players)).toBe(true)
  expect(controller.view).toEqual({ ...current, players })
  expect(controller.pending).toBe(true)
  expect(accept).not.toHaveBeenCalled()
  expect(controller.acceptPlayers({ ...current, version: 2 }, [])).toBe(false)
  expect(controller.acceptPlayers({ ...current, characterId: 'other' }, [])).toBe(false)
  expect(controller.acceptPlayers({ ...current, sectors: [...current.sectors] }, [])).toBe(false)
  held.resolve({ ...current, version: 2 })
  await pending
  expect(controller.acceptPlayers(current, players)).toBe(true)
  controller.dispose()
})
describe('world command ordering', () => {
  it.each(['walk', 'attack'] as const)(
    'dispatches %s immediately ahead of an idle read and ignores its late receipt',
    async (kind) => {
      const read = deferred(),
        result = deferred(),
        accept = vi.fn(),
        error = vi.fn()
      let signal: AbortSignal | undefined
      const command = vi.fn().mockReturnValue(result.promise)
      const controller = new WorldController(view, {
        command,
        refresh: (receivedSignal) => {
          signal = receivedSignal
          return read.promise
        },
        accept,
        error,
        busy: vi.fn(),
      })
      const refreshing = controller.refresh()
      const intent =
        kind === 'walk'
          ? { kind, destination: { sectorId: 'a', x: 2, y: 2 } }
          : { kind, targetId: 'one' }
      const submitted = controller.send(intent)
      expect(command).toHaveBeenCalledWith(intent, view)
      expect(signal?.aborted).toBe(true)
      read.resolve({ ...view, version: 999 })
      await refreshing
      expect(accept).not.toHaveBeenCalled()
      expect(controller.pending).toBe(true)
      expect(error).not.toHaveBeenCalled()
      result.resolve({ ...view, version: 2 })
      expect(await submitted).toMatchObject({ applied: true })
      expect(controller.view.version).toBe(2)
      expect(accept).toHaveBeenCalledOnce()
      controller.dispose()
    },
  )
  it('gives a queued Stop priority over an automatic route continuation', async () => {
    const tick = deferred()
    const destination = { sectorId: 'far', x: 6, y: 4 }
    const segment = {
      ...view,
      version: 2,
      route: Array(128).fill({ position: destination, durationMs: 200 }),
      routeDestination: destination,
    } as WorldView
    const command = vi
      .fn()
      .mockReturnValueOnce(tick.promise)
      .mockResolvedValue({ ...segment, version: 3, route: [], routeDestination: null })
    const controller = new WorldController(view, {
      command,
      refresh: vi.fn(),
      accept: vi.fn(),
      busy: vi.fn(),
      error: vi.fn(),
    })
    const pending = controller.send({ kind: 'tick' })
    const stopped = controller.send({ kind: 'stop' })
    tick.resolve(segment)
    await pending
    await stopped
    expect(command.mock.calls.map(([intent]) => intent.kind)).toEqual(['tick', 'stop'])
    expect(controller.view.route).toEqual([])
    controller.dispose()
  })
  it('replenishes a long journey before the saved segment runs out', async () => {
    const destination = { sectorId: 'far', x: 6, y: 4 }
    const segment = {
      ...view,
      version: 2,
      route: Array(128).fill({ position: destination, durationMs: 200 }),
      routeDestination: destination,
      routeObjectiveId: 'last-survey',
      movementBlocked: null,
      battleSessionId: null,
    } as WorldView
    const command = vi
      .fn()
      .mockResolvedValue({ ...segment, version: 3, route: Array(256).fill(segment.route[0]) })
    const controller = new WorldController(view, {
      command,
      refresh: async () => segment,
      accept: vi.fn(),
      busy: vi.fn(),
      error: vi.fn(),
    })
    await controller.refresh()
    await vi.waitFor(() =>
      expect(command).toHaveBeenCalledWith(
        { kind: 'autopath', objectiveId: 'last-survey' },
        segment,
      ),
    )
    expect(controller.view.route.length).toBe(256)
    controller.dispose()
  })
  it('never resumes an interrupted, blocked or stopped journey from old destination metadata', async () => {
    for (const patch of [
      { route: [] },
      { movementBlocked: 'Stop Passive Training to travel.' },
      { battleSessionId: 'battle' },
    ]) {
      const command = vi.fn()
      const segment = {
        ...view,
        route: [{ position: { sectorId: 'a', x: 1, y: 1 }, durationMs: 200 }],
        routeDestination: { sectorId: 'far', x: 6, y: 4 },
        ...patch,
      } as WorldView
      const controller = new WorldController(view, {
        command,
        refresh: async () => segment,
        accept: vi.fn(),
        busy: vi.fn(),
        error: vi.fn(),
      })
      await controller.refresh()
      expect(command).not.toHaveBeenCalled()
      controller.dispose()
    }
  })
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
    expect(accept.mock.calls.map((call) => call[1])).toEqual([true])
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

it('merges delayed authorized peers into newer owned authority and clears old-position attackability', () => {
  const source = {
    characterId: 'owner',
    version: 1,
    position: { sectorId: 'a', x: 1, y: 1 },
    sectors: [{ id: 'a' }],
    atlas: [],
    players: [],
    serverNow: 1000,
    route: [],
    nextStepAt: null,
  } as unknown as WorldView
  const owned = {
    ...source,
    version: 3,
    position: { ...source.position, x: 3 },
    serverNow: 1400,
    nextStepAt: 1600,
    route: [{ position: { ...source.position, x: 4 }, durationMs: 200 }],
  }
  const accept = vi.fn()
  const controller = new WorldController(owned, {
    command: vi.fn(),
    refresh: vi.fn(),
    accept,
    error: vi.fn(),
    busy: vi.fn(),
  })
  const players = [
    { characterId: 'peer', attackable: true, attackEligible: true },
    { characterId: 'ineligible', attackable: false },
  ] as unknown as WorldView['players']
  expect(controller.acceptPlayers(source, players)).toBe(true)
  expect(controller.view).toMatchObject({
    ...owned,
    players: [{ ...players[0], attackable: false }, players[1]],
  })
  expect(controller.view.route).toBe(owned.route)
  expect(controller.view.position).toBe(owned.position)
  expect(accept).not.toHaveBeenCalled()
  expect(controller.acceptPlayers({ ...source, atlas: [] }, players)).toBe(false)
  expect(
    controller.acceptPlayers(
      { ...source, sectors: [{ id: 'a' }] as WorldView['sectors'] },
      players,
    ),
  ).toBe(false)
  controller.dispose()
  expect(controller.acceptPlayers(source, players)).toBe(false)
})

it('hydrates presentation during a command without replacing newer owned movement', async () => {
  const initial = {
    ...view,
    characterId: 'owner',
    position: { sectorId: 'a', x: 1, y: 1 },
    sectors: [
      {
        id: 'a',
        cells: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
      },
    ],
    atlas: [],
    players: [],
    route: [],
  } as unknown as WorldView
  const held = deferred(),
    scene = deferred(),
    presentation = vi.fn()
  const controller = new WorldController(initial, {
    command: () => held.promise,
    refresh: () => scene.promise,
    accept: vi.fn(),
    presentation,
    error: vi.fn(),
    busy: vi.fn(),
  })
  const hydrating = controller.hydrate()
  const moving = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 2, y: 1 } })
  held.resolve({ ...initial, version: 2, position: { sectorId: 'a', x: 2, y: 1 }, serverNow: 200 })
  await moving
  scene.resolve({
    ...initial,
    players: [{ characterId: 'peer', attackable: true }] as WorldView['players'],
  })
  await hydrating
  expect(controller.view.version).toBe(2)
  expect(controller.view.position.x).toBe(2)
  expect(controller.view.serverNow).toBe(200)
  expect(controller.view.players[0]?.attackable).toBe(false)
  expect(presentation).toHaveBeenCalledOnce()
  controller.dispose()
})
it('does not reconcile a hydration over a newer pending movement plan', async () => {
  const initial = {
    ...view,
    characterId: 'owner',
    position: { sectorId: 'a', x: 1, y: 1 },
    sectors: [],
    atlas: [],
    players: [],
    route: [],
  } as WorldView
  const scene = deferred(),
    command = deferred(),
    accept = vi.fn()
  const controller = new WorldController(initial, {
    command: () => command.promise,
    refresh: () => scene.promise,
    accept,
    presentation: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  const hydrating = controller.hydrate()
  const moving = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 2, y: 1 } })
  scene.resolve({ ...initial, version: 2 })
  await hydrating
  expect(accept).toHaveBeenCalledWith(expect.objectContaining({ version: 2 }), false)
  command.resolve({ ...initial, version: 3 })
  await moving
  controller.dispose()
})
it('does not roll peer movement or action eligibility back when a slow scene arrives', async () => {
  const position = { sectorId: 'a', x: 1, y: 1 }
  const newer = {
    characterId: 'peer',
    name: 'Peer',
    level: 1,
    portraitRef: '',
    imageUrl: null,
    position,
    attackable: false,
    attackEligible: false,
    movement: { version: 5, serverNow: 1500, nextStepAt: null, route: [] },
  }
  const initial = {
    ...view,
    characterId: 'owner',
    position,
    sectors: [{ id: 'a', cells: [{ x: 1, y: 1 }] }],
    atlas: [],
    players: [newer],
    route: [],
  } as unknown as WorldView
  const older = {
    ...newer,
    attackable: true,
    attackEligible: true,
    movement: { ...newer.movement, version: 4, serverNow: 1000 },
  }
  const controller = new WorldController(initial, {
    command: vi.fn(),
    refresh: async () => ({ ...initial, players: [older] }),
    accept: vi.fn(),
    presentation: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  await controller.hydrate()
  expect(controller.view.players[0]).toBe(newer)
  controller.dispose()
})
it('accepts newer same-version blocking authority but ignores an older unblock', async () => {
  const position = { sectorId: 'a', x: 1, y: 1 }
  const initial = {
    ...view,
    characterId: 'owner',
    serverNow: 1000,
    position,
    sectors: [{ id: 'a', cells: [{ x: 1, y: 1 }] }],
    atlas: [],
    players: [],
    route: [],
    movementBlocked: null,
    battleSessionId: null,
  } as unknown as WorldView
  const accept = vi.fn(),
    refresh = vi
      .fn()
      .mockResolvedValueOnce({
        ...initial,
        serverNow: 1500,
        movementBlocked: 'Stop Passive Training to travel.',
      })
      .mockResolvedValueOnce({ ...initial, serverNow: 1200 })
  const controller = new WorldController(initial, {
    command: vi.fn(),
    refresh,
    accept,
    presentation: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  await controller.hydrate()
  expect(controller.view.movementBlocked).toBe('Stop Passive Training to travel.')
  expect(accept).toHaveBeenCalledWith(
    expect.objectContaining({ movementBlocked: 'Stop Passive Training to travel.' }),
    true,
  )
  await controller.hydrate()
  expect(controller.view.movementBlocked).toBe('Stop Passive Training to travel.')
  controller.dispose()
})
it('does not withdraw loaded approved route terrain when an older scene reply arrives', async () => {
  const position = { sectorId: 'a', x: 12, y: 4 },
    next = { sectorId: 'b', x: 0, y: 4 }
  const a = {
      id: 'a',
      cells: [{ x: 12, y: 4, walkable: true }],
      exits: [{ from: position, to: next, durationMs: 200 }],
    },
    b = { id: 'b', cells: [{ x: 0, y: 4, walkable: true }], exits: [] }
  const current = {
    ...view,
    version: 2,
    characterId: 'owner',
    serverNow: 1000,
    position,
    sectors: [a, b],
    atlas: [],
    players: [],
    route: [{ position: next, durationMs: 200 }],
  } as unknown as WorldView
  const presentation = vi.fn(),
    controller = new WorldController(current, {
      command: vi.fn(),
      refresh: async () => ({ ...current, version: 1, sectors: [a] as WorldView['sectors'] }),
      accept: vi.fn(),
      presentation,
      error: vi.fn(),
      busy: vi.fn(),
    })
  await controller.hydrate()
  expect(controller.view.sectors).toBe(current.sectors)
  expect(presentation).not.toHaveBeenCalled()
  controller.dispose()
})
it('redirects a committed narrow attack receipt after hydration advances the owned version', async () => {
  let finish!: (value: { characterId: string; battleSessionId: string }) => void
  const result = new Promise<{ characterId: string; battleSessionId: string }>((resolve) => {
    finish = resolve
  })
  const initial = {
    ...view,
    version: 2,
    characterId: 'owner',
    players: [],
    route: [],
    position: { sectorId: 'a', x: 1, y: 1 },
    sectors: [],
    atlas: [],
  } as unknown as WorldView
  const accept = vi.fn(),
    controller = new WorldController(initial, {
      command: () => result,
      refresh: async () => ({ ...initial, version: 3 }),
      accept,
      presentation: vi.fn(),
      error: vi.fn(),
      busy: vi.fn(),
    })
  const pending = controller.send({ kind: 'attack', targetId: 'peer' })
  await controller.hydrate()
  finish({ characterId: 'owner', battleSessionId: 'committed-battle' })
  expect(await pending).toMatchObject({ applied: true })
  expect(controller.view.version).toBe(3)
  expect(controller.view.battleSessionId).toBe('committed-battle')
  expect(accept).toHaveBeenLastCalledWith(
    expect.objectContaining({ version: 3, battleSessionId: 'committed-battle' }),
    true,
  )
  controller.dispose()
})
it('dispatches an attack before unsent walking while preserving an in-flight authority write', async () => {
  const held = deferred(),
    initial = { ...view, characterId: 'owner', route: [], players: [] } as WorldView
  const command = vi
    .fn()
    .mockImplementation((intent) =>
      command.mock.calls.length === 1
        ? held.promise
        : Promise.resolve(
            intent.kind === 'attack'
              ? { characterId: 'owner', battleSessionId: 'battle' }
              : { ...initial, version: 3 },
          ),
    )
  const controller = new WorldController(initial, {
    command,
    refresh: vi.fn(),
    accept: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  const first = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 1, y: 1 } })
  const queued = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 2, y: 1 } })
  const attack = controller.send({ kind: 'attack', targetId: 'peer' })
  expect(command).toHaveBeenCalledOnce()
  held.resolve({ ...initial, version: 2 })
  await first
  await attack
  expect(await queued).toEqual({ applied: false })
  expect(command.mock.calls.map(([intent]) => intent.kind)).toEqual(['walk', 'attack'])
  expect(controller.view.battleSessionId).toBe('battle')
  controller.dispose()
})
it('preserves an explicit queued Stop before an attack', async () => {
  const held = deferred(),
    initial = { ...view, characterId: 'owner', route: [], players: [] } as WorldView
  const command = vi
    .fn()
    .mockImplementation((intent) =>
      command.mock.calls.length === 1
        ? held.promise
        : Promise.resolve(
            intent.kind === 'attack'
              ? { characterId: 'owner', battleSessionId: 'battle' }
              : { ...initial, version: 3 },
          ),
    )
  const controller = new WorldController(initial, {
    command,
    refresh: vi.fn(),
    accept: vi.fn(),
    error: vi.fn(),
    busy: vi.fn(),
  })
  const first = controller.send({ kind: 'walk', destination: { sectorId: 'a', x: 1, y: 1 } })
  const stopped = controller.send({ kind: 'stop' }),
    attack = controller.send({ kind: 'attack', targetId: 'peer' })
  held.resolve({ ...initial, version: 2 })
  await first
  expect(await stopped).toMatchObject({ applied: true })
  await attack
  expect(command.mock.calls.map(([intent]) => intent.kind)).toEqual(['walk', 'stop', 'attack'])
  controller.dispose()
})
it('keeps receipt clocks without restarting a held preview while an attack waits for an in-flight tick', async () => {
  const held = deferred(),
    initial = { ...view, characterId: 'owner', route: [], players: [] } as WorldView,
    accept = vi.fn()
  const command = vi
    .fn()
    .mockReturnValueOnce(held.promise)
    .mockResolvedValue({ characterId: 'owner', battleSessionId: 'battle' })
  const controller = new WorldController(initial, {
    command,
    refresh: vi.fn(),
    accept,
    error: vi.fn(),
    busy: vi.fn(),
  })
  const tick = controller.send({ kind: 'tick' }),
    attack = controller.send({ kind: 'attack', targetId: 'peer' })
  expect(controller.attackPending).toBe(true)
  held.resolve({ ...initial, version: 2 })
  await tick
  await attack
  expect(accept.mock.calls[0]).toEqual([{ ...initial, version: 2 }, false])
  expect(accept).toHaveBeenLastCalledWith(
    expect.objectContaining({ battleSessionId: 'battle' }),
    true,
  )
  controller.dispose()
})
