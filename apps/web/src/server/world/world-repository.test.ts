import { beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
vi.mock('server-only', () => ({}))
const { rpc, sceneRpc, lastRead, profileImages, environmentSettings } = vi.hoisted(() => ({
  rpc: vi.fn(),
  sceneRpc: vi.fn(),
  lastRead: { value: null as { state: { version: number }; players: unknown[] } | null },
  environmentSettings: vi.fn(),
  profileImages: new Map<string, string>(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    rpc: async (name: string, args: unknown) => {
      if (name === 'read_world_scene_players_v1' || name === 'read_world_scene_players_v2')
        return sceneRpc(name, args)
      const result = await rpc(name, args)
      if (name === 'read_world_state_v1' && result.data?.state) lastRead.value = result.data
      return result
    },
  }),
}))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadPublicCharacterProfileImageMap: vi.fn(async () => new Map(profileImages)),
}))
vi.mock('./world-environment-store', () => ({ readWorldEnvironmentSettings: environmentSettings }))
import { DEFAULT_WORLD_ENVIRONMENT_SETTINGS } from '@/world/environment'
import { newWorldState, revealNearby } from '@/world/travel'
import type { WorldCommand, WorldPlayer, WorldState } from '@/world/types'
import {
  commitWorldCommand,
  readWorld,
  readWorldAttackAuthority,
  settleWorldAttackAuthority,
  resetWorldReadCaches,
} from './world-repository'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'
import { projectWorld } from './world-service'
import { localRoute, WorldMotion } from '@/components/world/world-motion'
import { mergeWorldMovement } from '@/world/movement-receipt'
import { WorldController } from '@/components/world/world-controller'

const characterId = '00000000-0000-4000-8000-000000000011'
const command: WorldCommand = {
  characterId,
  expectedVersion: 1,
  commandId: '00000000-0000-4000-8000-000000000099',
  intent: { kind: 'stop' },
}
const payload = () => ({
  state: newWorldState(),
  players: [],
  serverNow: 5000,
  blocked: null,
  trainingExpired: false,
  lastCommandId: null,
  lastCommandFingerprint: null,
})
beforeEach(() => {
  resetWorldReadCaches()
  rpc.mockReset()
  lastRead.value = null
  sceneRpc.mockReset().mockImplementation(async () => ({
    data: { version: lastRead.value!.state.version, players: lastRead.value!.players },
  }))
  profileImages.clear()
  environmentSettings.mockReset().mockResolvedValue(DEFAULT_WORLD_ENVIRONMENT_SETTINGS)
  vi.mocked(loadPublicCharacterProfileImageMap).mockClear()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

it('keeps a first-click route moving when a follow-up read is slower than its preview budget', async () => {
  const initial = payload()
  const view = { ...projectWorld(initial.state, [], initial.serverNow), characterId }
  const destination = { sectorId: 'verdant-expanse', x: 6, y: 0 }
  const preview = localRoute(view, view.position, destination)!
  expect(preview.length).toBeGreaterThan(3)
  const motion = new WorldMotion(view, 0)
  motion.plan(preview, view.sectors, 0)
  const boundary = deferred<'approval' | 'follow-up read'>()
  const slowRead = deferred<void>()
  let committed: WorldState | undefined
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'commit_world_state_v1') {
      committed = { ...args.p_next_state!, version: 2 }
      clock.mockReturnValue(1250)
      return { data: committed }
    }
    if (committed) {
      boundary.resolve('follow-up read')
      await slowRead.promise
      return { data: { ...initial, state: committed, serverNow: 5950 } }
    }
    return { data: initial }
  })
  const result = commitWorldCommand(
    'owner',
    characterId,
    {
      ...command,
      intent: { kind: 'walk', destination },
    },
    true,
  ).then((receipt) => {
    motion.reconcile(mergeWorldMovement(view, receipt), 250)
    boundary.resolve('approval')
    return receipt
  })
  try {
    expect(await boundary.promise).toBe('approval')
    for (const now of [600, 650, 800, 949]) {
      expect(motion.sample(now).moving, `walking at ${now}ms`).toBe(true)
      expect(motion.sample(now + 16).point).not.toEqual(motion.sample(now).point)
    }
    expect((await result).version).toBe(2)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
    ])
    expect(sceneRpc).not.toHaveBeenCalled()
    expect(environmentSettings).not.toHaveBeenCalled()
  } finally {
    slowRead.resolve()
    await result
    clock.mockRestore()
  }
})

it('uses the normalized committed snapshot and database-anchored elapsed display time', async () => {
  const initial = payload()
  let committed: WorldState | undefined
  const mono = vi.spyOn(performance, 'now').mockReturnValue(2000)
  const wall = vi.spyOn(Date, 'now').mockReturnValue(999_999)
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'commit_world_state_v1') {
      committed = { ...args.p_next_state!, version: 2, nextStepAt: 5150 }
      mono.mockReturnValue(2090)
      return { data: committed }
    }
    return {
      data: {
        ...initial,
        state: committed ? { ...committed, version: 3 } : initial.state,
        serverNow: committed ? 6000 : 5000,
      },
    }
  })
  try {
    const receipt = await commitWorldCommand(
      'owner',
      characterId,
      {
        ...command,
        intent: { kind: 'walk', destination: { sectorId: 'verdant-expanse', x: 6, y: 4 } },
      },
      true,
    )
    expect(receipt.version).toBe(2)
    expect(receipt.nextStepAt).toBe(5150)
    expect(receipt.serverNow).toBe(5090)
    expect(receipt.currentSector).toEqual(
      projectWorld(committed!, [], 5090).sectors.find((s) => s.id === committed!.position.sectorId),
    )
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_next_state: { nextStepAt: 5200 } })
  } finally {
    mono.mockRestore()
    wall.mockRestore()
  }
})

it.each(['stop', 'partial receipt', 'advanced version', 'existing block'] as const)(
  'retains the fresh authority read for %s',
  async (caseName) => {
    const initial = payload()
    let committed: WorldState | undefined
    rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
      if (name === 'commit_world_state_v1') {
        committed = { ...args.p_next_state!, version: caseName === 'advanced version' ? 3 : 2 }
        return { data: caseName === 'partial receipt' ? { version: 2 } : committed }
      }
      return {
        data: {
          ...initial,
          state: committed ?? initial.state,
          serverNow: committed ? 6000 : 5000,
          blocked: caseName === 'existing block' ? 'WORLD_TRAINING_ACTIVE' : null,
        },
      }
    })
    const receipt = await commitWorldCommand(
      'owner',
      characterId,
      {
        ...command,
        intent: caseName === 'stop' ? { kind: 'stop' } : { kind: 'tick' },
      },
      true,
    )
    expect(receipt.serverNow).toBe(6000)
    expect(receipt.version).toBe(caseName === 'advanced version' ? 3 : 2)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
      'read_world_state_v1',
    ])
    if (caseName === 'existing block') expect(receipt.movementBlocked).not.toBeNull()
  },
)

it.each(['WORLD_TRAINING_ACTIVE', 'WORLD_SPECTATING', 'WORLD_ACTIVE_BATTLE'])(
  'accepts %s begun after commit through independent hydration',
  async (blocked) => {
    const initial = payload()
    const view = { ...projectWorld(initial.state, [], initial.serverNow), characterId }
    let committed: WorldState | undefined
    rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
      if (name === 'commit_world_state_v1') {
        committed = { ...args.p_next_state!, version: 2 }
        return { data: committed }
      }
      if (!committed) return { data: initial }
      const battle = blocked === 'WORLD_ACTIVE_BATTLE'
      return {
        data: {
          ...initial,
          state: battle ? { ...committed, version: 3, route: [], nextStepAt: null } : committed,
          blocked,
          battleSessionId: battle ? 'committed-world-battle' : null,
          serverNow: 5500,
        },
      }
    })
    const motion = new WorldMotion(view, 0)
    const accepts: boolean[] = []
    const controller = new WorldController(view, {
      command: async (intent, source) =>
        mergeWorldMovement(
          source,
          await commitWorldCommand(
            'owner',
            characterId,
            { ...command, expectedVersion: source.version, intent },
            true,
          ),
        ),
      refresh: async () => (await readWorld('owner', characterId)).view,
      accept: (next, reconcile) => {
        accepts.push(reconcile)
        motion.reconcile(next, 100)
      },
      presentation: () => {},
      error: (message) => {
        throw new Error(message)
      },
      busy: () => {},
    })
    await controller.send({
      kind: 'walk',
      destination: { sectorId: 'verdant-expanse', x: 6, y: 0 },
    })
    expect(controller.view.movementBlocked).toBeNull()
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
    ])
    await controller.hydrate()
    expect(controller.view.movementBlocked).not.toBeNull()
    expect(motion.sample(1000).moving).toBe(false)
    expect(accepts).toEqual([true, true])
    expect(controller.view.version).toBe(blocked === 'WORLD_ACTIVE_BATTLE' ? 3 : 2)
    expect(controller.view.battleSessionId).toBe(
      blocked === 'WORLD_ACTIVE_BATTLE' ? 'committed-world-battle' : null,
    )
    controller.dispose()
  },
)

it.each(['scene', 'environment'] as const)(
  'commits before a deferred %s presentation read, then returns the fully enriched committed receipt',
  async (delayedRead) => {
    const firstBoundary = deferred<'commit' | 'presentation'>()
    const presentation = deferred<void>()
    const initial = payload()
    const confirmed = { ...initial, state: { ...initial.state, version: 2 }, serverNow: 6000 }
    rpc.mockImplementation(async (name: string) => {
      if (name === 'commit_world_state_v1') {
        firstBoundary.resolve('commit')
        return { data: {} }
      }
      return {
        data: rpc.mock.calls.some(([name]) => name === 'commit_world_state_v1')
          ? confirmed
          : initial,
      }
    })
    const waitForPresentation = async () => {
      firstBoundary.resolve('presentation')
      await presentation.promise
    }
    if (delayedRead === 'scene')
      sceneRpc.mockImplementation(async () => {
        await waitForPresentation()
        return { data: { version: confirmed.state.version, players: [] } }
      })
    else
      environmentSettings.mockImplementation(async () => {
        await waitForPresentation()
        return DEFAULT_WORLD_ENVIRONMENT_SETTINGS
      })

    let settled = false
    const result = commitWorldCommand('owner', characterId, command).finally(() => {
      settled = true
    })
    try {
      expect(await firstBoundary.promise).toBe('commit')
      expect(settled).toBe(false)
      expect(loadPublicCharacterProfileImageMap).not.toHaveBeenCalled()
    } finally {
      presentation.resolve()
      await result
    }
    expect(await result).toMatchObject({
      characterId,
      version: 2,
      serverNow: 6000,
      environment: { settingsVersion: 0 },
      movementBlocked: null,
    })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
      'read_world_state_v1',
    ])
    expect(sceneRpc).toHaveBeenCalledTimes(1)
    expect(environmentSettings).toHaveBeenCalledTimes(1)
    expect(loadPublicCharacterProfileImageMap).toHaveBeenCalledTimes(1)
  },
)

it('resolves only steps due on the authoritative read clock, regardless of the application clock', async () => {
  const state: WorldState = {
    ...newWorldState(),
    route: [6, 7].map((x) => ({
      position: { sectorId: 'verdant-expanse', x, y: 4 },
      durationMs: 200,
    })),
    nextStepAt: 5000,
  }
  let persisted = state
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'commit_world_state_v1') {
      persisted = { ...args.p_next_state!, version: 2 }
      return { data: persisted }
    }
    return { data: { ...payload(), state: persisted, serverNow: 5100 } }
  })
  const applicationClock = vi.spyOn(Date, 'now').mockReturnValue(999_999)
  try {
    const view = await commitWorldCommand('owner', characterId, {
      ...command,
      intent: { kind: 'tick' },
    })
    expect(view.position).toEqual({ sectorId: 'verdant-expanse', x: 6, y: 4 })
    expect(view.route).toEqual([state.route[1]])
    expect(view.nextStepAt).toBe(5200)
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_user_id: 'owner',
      p_character_id: characterId,
      p_initial_state: { ...newWorldState(), safe: true },
    })
  } finally {
    applicationClock.mockRestore()
  }
})

it('keeps live event objectives in authoritative auto-path resolution', async () => {
  const events = [
    {
      runId: 'live-event',
      objectiveId: 'navigate',
      title: 'Live objective',
      phaseName: 'Live phase',
      navigation: { sectorId: 'verdant-expanse', x: 6, y: 4, autoPath: true, guidance: 'exact' },
    },
  ]
  const objectiveId = `event-${createHash('sha256').update('live-event:navigate').digest('hex').slice(0, 32)}`
  let persisted = newWorldState()
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'commit_world_state_v1') {
      persisted = { ...args.p_next_state!, version: 2 }
      return { data: persisted }
    }
    return { data: { ...payload(), state: persisted, eventObjectives: events } }
  })
  const view = await commitWorldCommand('owner', characterId, {
    ...command,
    intent: { kind: 'autopath', objectiveId },
  })
  expect(persisted.routeObjectiveId).toBe(objectiveId)
  expect(persisted.route).toEqual([
    { position: { sectorId: 'verdant-expanse', x: 6, y: 4 }, durationMs: 200 },
  ])
  expect(view.nextStepAt).toBe(5200)
  expect(view.objectives).toContainEqual(
    expect.objectContaining({ id: objectiveId, name: 'Live objective' }),
  )
})

it('materializes expired training before resolving and committing a command', async () => {
  rpc
    .mockResolvedValueOnce({
      data: { ...payload(), trainingExpired: true, blocked: 'WORLD_TRAINING_ACTIVE' },
    })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: { ...payload(), serverNow: 5500 } })
    .mockResolvedValueOnce({ data: {} })
    .mockResolvedValueOnce({ data: { ...payload(), state: { ...newWorldState(), version: 2 } } })
  expect((await commitWorldCommand('owner', characterId, command)).version).toBe(2)
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_state_v1',
    'materialize_training_report_v2',
    'read_world_state_v1',
    'commit_world_state_v1',
    'read_world_state_v1',
  ])
  expect(sceneRpc).toHaveBeenCalledTimes(1)
})

it.each(['WORLD_TRAINING_ACTIVE', 'WORLD_ACTIVE_BATTLE', 'WORLD_SPECTATING'])(
  'preserves authoritative %s rejection without presentation work',
  async (blocked) => {
    rpc
      .mockResolvedValueOnce({ data: { ...payload(), blocked } })
      .mockResolvedValueOnce({ error: { message: blocked } })
    await expect(
      commitWorldCommand('owner', characterId, { ...command, intent: { kind: 'tick' } }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
    ])
    expect(sceneRpc).not.toHaveBeenCalled()
    expect(environmentSettings).not.toHaveBeenCalled()
  },
)

it.each(['WORLD_TRAINING_ACTIVE', 'WORLD_ACTIVE_BATTLE', 'WORLD_SPECTATING'])(
  'still allows the authority to stop travel while %s',
  async (blocked) => {
    const state = {
      ...newWorldState(),
      route: [{ position: { sectorId: 'verdant-expanse', x: 6, y: 4 }, durationMs: 200 }],
      nextStepAt: 5000,
    }
    rpc
      .mockResolvedValueOnce({ data: { ...payload(), state, blocked } })
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({
        data: {
          ...payload(),
          state: { ...state, version: 2, route: [], nextStepAt: null },
          blocked,
        },
      })
    const view = await commitWorldCommand('owner', characterId, command)
    expect(view.position).toEqual(state.position)
    expect(view.route).toEqual([])
    expect(view.movementBlocked).not.toBeNull()
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({
      p_kind: 'stop',
      p_next_state: { position: state.position, route: [], nextStepAt: null },
    })
  },
)

const scenePlayer = (characterId: string, sectorId: string, x = 0, y = 4): WorldPlayer => ({
  characterId,
  name: characterId,
  level: 2,
  portraitRef: 'portrait.starter.wayfarer-07',
  imageUrl: null,
  online: true,
  attackable: true,
  position: { sectorId, x, y },
})

it('reads only the server-projected scene and includes known neighbouring players without widening PvP', async () => {
  const state = { ...newWorldState(), position: { sectorId: 'atlas:58:28', x: 12, y: 4 } }
  rpc.mockResolvedValue({ data: { ...payload(), state } })
  sceneRpc.mockResolvedValue({
    data: {
      version: state.version,
      players: [scenePlayer('neighbour', 'atlas:59:28'), scenePlayer('remote', 'atlas:0:0')],
    },
  })
  const { view } = await readWorld('owner', characterId)
  expect(sceneRpc).toHaveBeenCalledWith('read_world_scene_players_v2', {
    p_user_id: 'owner',
    p_character_id: characterId,
    p_expected_version: state.version,
    p_scene_sector_ids: view.sectors.map((sector) => sector.id),
    p_initial_position: newWorldState().position,
  })
  expect(view.sectors.length).toBeLessThanOrEqual(25)
  expect(view.players).toEqual([
    expect.objectContaining({
      characterId: 'neighbour',
      attackable: false,
      imageUrl: '/api/media/starter-portrait/portrait.starter.wayfarer-07',
    }),
  ])
})

it('enables push only after the owned scene registration succeeds', async () => {
  rpc.mockResolvedValue({ data: payload() })
  expect((await readWorld('owner', characterId)).view.livePresence).toBe(true)
})

it.each(['42883', 'PGRST202'])(
  'keeps polling compatibility before the new migration is installed (%s)',
  async (code) => {
    rpc.mockResolvedValue({ data: payload() })
    sceneRpc
      .mockResolvedValueOnce({ error: { code, message: 'missing function' } })
      .mockResolvedValueOnce({ data: { version: 1, players: [] } })
    expect((await readWorld('owner', characterId)).view.livePresence).toBe(false)
    expect(sceneRpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_scene_players_v2',
      'read_world_scene_players_v1',
    ])
  },
)

it('never hides a permission error by falling back to the old reader', async () => {
  rpc.mockResolvedValue({ data: payload() })
  sceneRpc.mockResolvedValueOnce({ error: { code: '42501', message: 'denied' } })
  await expect(readWorld('owner', characterId)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  expect(sceneRpc).toHaveBeenCalledTimes(1)
})

it('keeps unsurveyed players private even when returned by the scene read', async () => {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'survey-01', x: 6, y: 8 },
  })
  rpc.mockResolvedValue({ data: { ...payload(), state } })
  sceneRpc.mockResolvedValue({
    data: { version: state.version, players: [scenePlayer('hidden', 'survey-01', 11, 1)] },
  })
  expect((await readWorld('owner', characterId)).view.players).toEqual([])
})

it('retries a raced scene registration instead of publishing its partial legacy peer list', async () => {
  const state = {
      ...newWorldState(),
      version: 5,
      position: { sectorId: 'atlas:58:28', x: 12, y: 4 },
    },
    next = { ...state, version: 6, position: { sectorId: 'atlas:59:28', x: 0, y: 4 } },
    neighbour = scenePlayer('neighbour', 'atlas:58:28', 12, 4)
  rpc
    .mockResolvedValueOnce({ data: { ...payload(), state, players: [] } })
    .mockResolvedValueOnce({ data: { ...payload(), state: next, players: [] } })
  sceneRpc
    .mockResolvedValueOnce({ data: { version: next.version, players: [] } })
    .mockResolvedValueOnce({ data: { version: next.version, players: [neighbour] } })
  const { view } = await readWorld('owner', characterId, { width: 2560, height: 1440 })
  expect(view.version).toBe(next.version)
  expect(view.position).toEqual(next.position)
  expect(view.livePresence).toBe(true)
  expect(view.players.map((player) => player.characterId)).toEqual(['neighbour'])
  expect(view.scenery!.length).toBeGreaterThan(view.sectors.length)
  expect(sceneRpc.mock.calls.map(([, args]) => args.p_expected_version)).toEqual([5, 6])
})

it('bounds scene registration retries and never publishes a mismatched peer snapshot', async () => {
  const state = newWorldState()
  rpc.mockResolvedValue({ data: { ...payload(), state } })
  sceneRpc.mockResolvedValue({ data: { version: state.version + 1, players: [] } })
  await expect(readWorld('owner', characterId)).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(sceneRpc).toHaveBeenCalledTimes(2)
  expect(loadPublicCharacterProfileImageMap).not.toHaveBeenCalled()
})

it.each([false, true])(
  'retries presentation without repeating a committed command (replay=%s)',
  async (replay) => {
    const initial = payload(),
      committed = { ...initial.state, version: 2 },
      latest = { ...committed, version: 3 },
      fingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            characterId,
            expectedVersion: command.expectedVersion,
            intent: command.intent,
          }),
        )
        .digest('hex')
    let wrote = replay
    rpc.mockImplementation(async (name: string) => {
      if (name === 'commit_world_state_v1') {
        wrote = true
        return { data: { version: committed.version } }
      }
      return {
        data: {
          ...initial,
          state: !wrote ? initial.state : sceneRpc.mock.calls.length ? latest : committed,
          lastCommandId: replay ? command.commandId : null,
          lastCommandFingerprint: replay ? fingerprint : null,
        },
      }
    })
    sceneRpc.mockResolvedValue({ data: { version: latest.version, players: [] } })
    expect((await commitWorldCommand('owner', characterId, command)).version).toBe(latest.version)
    expect(rpc.mock.calls.filter(([name]) => name === 'commit_world_state_v1')).toHaveLength(
      replay ? 0 : 1,
    )
    expect(sceneRpc).toHaveBeenCalledTimes(2)
  },
)

it('removes genuinely absent peers from a matching authorized scene without retrying', async () => {
  const state = newWorldState(),
    previous = scenePlayer('previous', state.position.sectorId, state.position.x, state.position.y)
  rpc.mockResolvedValue({ data: { ...payload(), state, players: [previous] } })
  sceneRpc.mockResolvedValue({ data: { version: state.version, players: [] } })
  const { view } = await readWorld('owner', characterId)
  expect(view.players).toEqual([])
  expect(view.livePresence).toBe(true)
  expect(sceneRpc).toHaveBeenCalledTimes(1)
})

it.each([
  { data: { version: 1, players: null } },
  {
    data: {
      version: 1,
      players: Array.from({ length: 201 }, () => scenePlayer('a', 'atlas:58:28')),
    },
  },
  { data: null, error: { message: 'database unavailable' } },
])('fails closed for an invalid or unavailable scene read', async (response) => {
  rpc.mockResolvedValue({ data: payload() })
  sceneRpc.mockResolvedValue(response)
  await expect(readWorld('owner', characterId)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

it('attaches the server-owned environment, honouring Master settings', async () => {
  rpc.mockResolvedValue({ data: payload() })
  expect((await readWorld('owner', characterId)).view.environment).toMatchObject({
    weatherSource: 'live',
    frozen: false,
    settingsVersion: 0,
  })
  environmentSettings.mockResolvedValue({
    ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
    version: 3,
    frozenMinuteOfDay: 1080,
    weatherOverride: 'fog',
  })
  resetWorldReadCaches() // Master settings are cached for a few seconds
  expect((await readWorld('owner', characterId)).view.environment).toMatchObject({
    minuteOfDay: 1080,
    frozen: true,
    weather: 'fog',
    weatherSource: 'master',
    settingsVersion: 3,
  })
  environmentSettings.mockResolvedValue({
    ...DEFAULT_WORLD_ENVIRONMENT_SETTINGS,
    dayLengthMinutes: 120,
    weatherOverride: 'storm',
    weatherOverrideUntil: 5000,
  })
  resetWorldReadCaches()
  expect((await readWorld('owner', characterId)).view.environment).toMatchObject({
    dayLengthMs: 7200000,
    minuteOfDay: 1,
    weatherSource: 'live',
  })
})

it('materializes expired training once using the existing authority, without claiming rewards', async () => {
  rpc
    .mockResolvedValueOnce({
      data: { ...payload(), blocked: 'WORLD_TRAINING_ACTIVE', trainingExpired: true },
    })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({ data: payload() })
  const result = await readWorld('owner', characterId)
  expect(result.view.movementBlocked).toBeNull()
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_state_v1',
    'materialize_training_report_v2',
    'read_world_state_v1',
  ])
  expect(rpc.mock.calls[1]?.[1]).toEqual({ p_user_id: 'owner', p_character_id: characterId })
})
it('does not materialize an active plan or loop if a concurrent plan remains blocked', async () => {
  rpc.mockResolvedValue({ data: { ...payload(), blocked: 'WORLD_TRAINING_ACTIVE' } })
  expect((await readWorld('owner', characterId)).view.movementBlocked).toContain('Training')
  expect(rpc).toHaveBeenCalledTimes(1)
})
it('returns authoritative state for a successful retry without another mutation', async () => {
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        characterId,
        expectedVersion: 1,
        intent: command.intent,
      }),
    )
    .digest('hex')
  rpc.mockResolvedValue({
    data: {
      ...payload(),
      state: { ...newWorldState(), version: 2 },
      lastCommandId: command.commandId,
      lastCommandFingerprint: fingerprint,
    },
  })
  const view = await commitWorldCommand('owner', characterId, command)
  expect(view.version).toBe(2)
  expect(view).not.toHaveProperty('lastCommandFingerprint')
  expect(rpc).toHaveBeenCalledTimes(1)
  await expect(
    commitWorldCommand('owner', characterId, {
      ...command,
      intent: { kind: 'cross' },
    }),
  ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' })
  await expect(
    commitWorldCommand('owner', characterId, {
      ...command,
      commandId: '00000000-0000-4000-8000-000000000098',
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(sceneRpc).toHaveBeenCalledTimes(1)
  expect(rpc.mock.calls.every(([name]) => name === 'read_world_state_v1')).toBe(true)
})

it('records successful early ticks so a retry cannot advance a later due step', async () => {
  rpc
    .mockResolvedValueOnce({ data: payload() })
    .mockResolvedValueOnce({ data: {} })
    .mockResolvedValueOnce({ data: { ...payload(), state: { ...newWorldState(), version: 2 } } })
  expect(
    (await commitWorldCommand('owner', characterId, { ...command, intent: { kind: 'tick' } }))
      .version,
  ).toBe(2)
  expect(rpc.mock.calls[1]?.[0]).toBe('commit_world_state_v1')
  expect(rpc.mock.calls[1]?.[1]).toMatchObject({
    p_kind: 'tick',
    p_request_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
  })
})

it('projects custom avatars and selected starter portraits for nearby players', async () => {
  const state = newWorldState()
  const customId = '00000000-0000-4000-8000-000000000021'
  const starterId = '00000000-0000-4000-8000-000000000022'
  profileImages.set(customId, 'https://images.example.test/custom-profile.webp')
  rpc.mockResolvedValue({
    data: {
      ...payload(),
      state,
      players: [
        {
          characterId: customId,
          name: 'Custom',
          level: 9,
          portraitRef: 'portrait.starter.wayfarer-01',
          imageUrl: null,
          position: state.position,
          attackable: false,
        },
        {
          characterId: starterId,
          name: 'Starter',
          level: 3,
          portraitRef: 'portrait.starter.wayfarer-07',
          imageUrl: null,
          position: state.position,
          attackable: false,
        },
      ],
    },
  })

  const view = (await readWorld('owner', characterId)).view
  expect(view.players.find((player) => player.characterId === customId)?.imageUrl).toBe(
    'https://images.example.test/custom-profile.webp',
  )
  expect(view.players.find((player) => player.characterId === starterId)).toMatchObject({
    portraitRef: 'portrait.starter.wayfarer-07',
    imageUrl: '/api/media/starter-portrait/portrait.starter.wayfarer-07',
  })
})

it('reads only known local attack authority without any scene or cosmetic presentation', async () => {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'survey-01', x: 6, y: 8 },
  })
  const local = scenePlayer('target', 'survey-01', 6, 7)
  rpc.mockResolvedValue({
    data: {
      ...payload(),
      state,
      players: [
        local,
        scenePlayer('hidden', 'survey-01', 11, 1),
        scenePlayer('remote', 'atlas:0:0'),
      ],
    },
  })
  expect(await readWorldAttackAuthority('owner', characterId)).toEqual({
    state,
    players: [{ ...local, attackEligible: true }],
    serverNow: 5000,
  })
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(['read_world_state_v1'])
  expect(sceneRpc).not.toHaveBeenCalled()
  expect(environmentSettings).not.toHaveBeenCalled()
  expect(loadPublicCharacterProfileImageMap).not.toHaveBeenCalled()
})
it.each(['WORLD_TRAINING_ACTIVE', 'WORLD_ACTIVE_BATTLE', 'WORLD_SPECTATING'])(
  'rejects blocked attacker %s before presentation or private pair reads',
  async (blocked) => {
    rpc.mockResolvedValue({ data: { ...payload(), blocked } })
    await expect(readWorldAttackAuthority('owner', characterId)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    expect(sceneRpc).not.toHaveBeenCalled()
    expect(environmentSettings).not.toHaveBeenCalled()
  },
)
it('materializes expired training before returning lean attack authority from the new snapshot', async () => {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'survey-01', x: 6, y: 8 },
    version: 3,
  })
  rpc
    .mockResolvedValueOnce({
      data: { ...payload(), trainingExpired: true, blocked: 'WORLD_TRAINING_ACTIVE' },
    })
    .mockResolvedValueOnce({ data: [] })
    .mockResolvedValueOnce({
      data: { ...payload(), state, players: [scenePlayer('target', 'survey-01', 6, 7)] },
    })
  expect((await readWorldAttackAuthority('owner', characterId)).state).toEqual(state)
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_state_v1',
    'materialize_training_report_v2',
    'read_world_state_v1',
  ])
  expect(sceneRpc).not.toHaveBeenCalled()
})
it.each(['safe', 'out-of-range', 'stale-target', 'unsurveyed'] as const)(
  'never grants attack authority to %s targets',
  async (reason) => {
    let state =
      reason === 'safe'
        ? newWorldState()
        : revealNearby({ ...newWorldState(), position: { sectorId: 'survey-01', x: 6, y: 8 } })
    let target = scenePlayer(
      'target',
      state.position.sectorId,
      state.position.x,
      state.position.y - 1,
    )
    if (reason === 'out-of-range')
      target = { ...target, position: { ...target.position, x: target.position.x + 3 } }
    if (reason === 'stale-target') target = { ...target, online: false, attackable: false }
    if (reason === 'unsurveyed')
      state = { ...state, discoveries: { ...state.discoveries, 'survey-01': [] } }
    rpc.mockResolvedValue({ data: { ...payload(), state, players: [target] } })
    expect(
      (await readWorldAttackAuthority('owner', characterId)).players.some(
        (player) => player.characterId === 'target' && player.attackable,
      ),
    ).toBe(false)
    expect(sceneRpc).not.toHaveBeenCalled()
  },
)

it('returns canonical compact movement before deferred terrain, environment or portraits', async () => {
  const initial = payload()
  const confirmed = { ...initial, state: { ...initial.state, version: 2 }, serverNow: 6000 }
  rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'commit_world_state_v1'
        ? confirmed.state
        : rpc.mock.calls.some(([n]) => n === 'commit_world_state_v1')
          ? confirmed
          : initial,
  }))
  sceneRpc.mockImplementation(() => new Promise(() => {}))
  environmentSettings.mockImplementation(() => new Promise(() => {}))
  const result = await commitWorldCommand('owner', characterId, command, true)
  expect(result).toMatchObject({
    kind: 'movement',
    version: 2,
    serverNow: 6000,
    position: confirmed.state.position,
  })
  expect(result).not.toHaveProperty('sectors')
  expect(sceneRpc).not.toHaveBeenCalled()
  expect(environmentSettings).not.toHaveBeenCalled()
  expect(loadPublicCharacterProfileImageMap).not.toHaveBeenCalled()
})

function attackTravelState(nextStepAt = 5000): WorldState {
  return revealNearby({
    ...newWorldState(),
    position: { sectorId: 'survey-01', x: 6, y: 8 },
    route: [7, 6].map((y) => ({ position: { sectorId: 'survey-01', x: 6, y }, durationMs: 200 })),
    nextStepAt,
  })
}
it('settles only approved owned steps due on the database read clock before projecting attack reach', async () => {
  const state = attackTravelState()
  const target = scenePlayer('target', 'survey-01', 6, 6)
  let committed: WorldState | undefined
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'commit_world_state_v1') {
      committed = { ...args.p_next_state!, version: 2 }
      return { data: committed }
    }
    return { data: { ...payload(), state: committed ?? state, players: [target] } }
  })
  const clock = vi.spyOn(Date, 'now').mockReturnValue(999999)
  try {
    const authority = await settleWorldAttackAuthority('owner', characterId, 1)
    expect(authority.state).toEqual(committed)
    expect(authority.players[0]).toMatchObject({ characterId: 'target', attackable: true })
    expect(committed).toMatchObject({
      position: { sectorId: 'survey-01', x: 6, y: 7 },
      route: [state.route[1]],
      nextStepAt: 5200,
    })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
      'read_world_state_v1',
    ])
    expect(rpc.mock.calls[1]![1]).toMatchObject({
      p_user_id: 'owner',
      p_character_id: characterId,
      p_expected_version: 1,
      p_kind: 'tick',
      p_request_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      p_command_id: expect.stringMatching(/^[a-f0-9-]{36}$/u),
    })
    expect(sceneRpc).not.toHaveBeenCalled()
    expect(environmentSettings).not.toHaveBeenCalled()
    expect(loadPublicCharacterProfileImageMap).not.toHaveBeenCalled()
  } finally {
    clock.mockRestore()
  }
})
it.each(['future-step', 'idle'] as const)(
  'does not commit travel for %s attack preparation',
  async (reason) => {
    const state =
      reason === 'future-step'
        ? attackTravelState(5001)
        : { ...attackTravelState(), route: [], nextStepAt: null }
    rpc.mockResolvedValue({
      data: { ...payload(), state, players: [scenePlayer('target', 'survey-01', 6, 6)] },
    })
    const authority = await settleWorldAttackAuthority('owner', characterId, 1)
    expect(authority.state).toEqual(state)
    expect(authority.players.some((player) => player.attackable)).toBe(false)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['read_world_state_v1'])
  },
)
it('rejects stale attack versions before settling a due owned route', async () => {
  rpc.mockResolvedValue({ data: { ...payload(), state: { ...attackTravelState(), version: 3 } } })
  await expect(settleWorldAttackAuthority('owner', characterId, 1)).rejects.toMatchObject({
    code: 'STALE_VERSION',
  })
  expect(rpc.mock.calls.map(([name]) => name)).toEqual(['read_world_state_v1'])
})
it.each(['WORLD_STALE_VERSION', 'WORLD_STEP_NOT_DUE', 'WORLD_TRAINING_ACTIVE'])(
  'keeps failed due-step commit %s from becoming attack authority',
  async (message) => {
    rpc
      .mockResolvedValueOnce({ data: { ...payload(), state: attackTravelState() } })
      .mockResolvedValueOnce({
        error: { code: message === 'WORLD_STALE_VERSION' ? 'PT409' : '22023', message },
      })
    await expect(settleWorldAttackAuthority('owner', characterId, 1)).rejects.toMatchObject({
      code: message === 'WORLD_STALE_VERSION' ? 'STALE_VERSION' : 'INVALID_REQUEST',
    })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'read_world_state_v1',
      'commit_world_state_v1',
    ])
  },
)
it('rejects another command advancing authority between owned-step commit and its fresh target read', async () => {
  rpc
    .mockResolvedValueOnce({ data: { ...payload(), state: attackTravelState() } })
    .mockResolvedValueOnce({ data: { ...attackTravelState(), version: 2 } })
    .mockResolvedValueOnce({
      data: { ...payload(), state: { ...attackTravelState(), version: 3 } },
    })
  await expect(settleWorldAttackAuthority('owner', characterId, 1)).rejects.toMatchObject({
    code: 'STALE_VERSION',
  })
})
it('rejects a successful-looking commit with no authoritative resulting version', async () => {
  rpc
    .mockResolvedValueOnce({ data: { ...payload(), state: attackTravelState() } })
    .mockResolvedValueOnce({ data: {} })
  await expect(settleWorldAttackAuthority('owner', characterId, 1)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_state_v1',
    'commit_world_state_v1',
  ])
})
it.each(['WORLD_TRAINING_ACTIVE', 'WORLD_ACTIVE_BATTLE', 'WORLD_SPECTATING'])(
  'never settles owned attack travel while blocked by %s',
  async (blocked) => {
    rpc.mockResolvedValueOnce({ data: { ...payload(), state: attackTravelState(), blocked } })
    await expect(settleWorldAttackAuthority('owner', characterId, 1)).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(['read_world_state_v1'])
  },
)

it('preserves the existing old-route lag allowance when settling attack arrival', async () => {
  const state = attackTravelState()
  let committed: WorldState | undefined
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'commit_world_state_v1') {
      committed = { ...args.p_next_state!, version: 2 }
      return { data: committed }
    }
    return { data: { ...payload(), serverNow: 14000, state: committed ?? state } }
  })
  expect((await settleWorldAttackAuthority('owner', characterId, 1)).state).toMatchObject({
    position: state.route[0]!.position,
    route: [state.route[1]],
    nextStepAt: 14200,
  })
})
it('materializes expired training before settling due owned steps for an attack', async () => {
  const state = attackTravelState()
  let expired = true
  let committed: WorldState | undefined
  rpc.mockImplementation(async (name: string, args: { p_next_state?: WorldState }) => {
    if (name === 'materialize_training_report_v2') {
      expired = false
      return { data: [] }
    }
    if (name === 'commit_world_state_v1') {
      committed = { ...args.p_next_state!, version: 2 }
      return { data: committed }
    }
    return {
      data: {
        ...payload(),
        state: committed ?? state,
        trainingExpired: expired,
        blocked: expired ? 'WORLD_TRAINING_ACTIVE' : null,
      },
    }
  })
  expect((await settleWorldAttackAuthority('owner', characterId, 1)).state.version).toBe(2)
  expect(rpc.mock.calls.map(([name]) => name)).toEqual([
    'read_world_state_v1',
    'materialize_training_report_v2',
    'read_world_state_v1',
    'commit_world_state_v1',
    'read_world_state_v1',
  ])
  expect(sceneRpc).not.toHaveBeenCalled()
})
