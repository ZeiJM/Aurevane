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
import { commitWorldCommand, readWorld, resetWorldReadCaches } from './world-repository'
import { loadPublicCharacterProfileImageMap } from '@/server/character/character-profile-display-service'

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

it('discards a concurrently changed scene and retains the matching authoritative read', async () => {
  const state = newWorldState(),
    stable = scenePlayer('stable', state.position.sectorId, state.position.x, state.position.y)
  rpc.mockResolvedValue({ data: { ...payload(), state, players: [stable] } })
  sceneRpc.mockResolvedValue({
    data: { version: state.version + 1, players: [scenePlayer('future', 'atlas:59:28')] },
  })
  expect((await readWorld('owner', characterId)).view.players.map((p) => p.characterId)).toEqual([
    'stable',
  ])
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
