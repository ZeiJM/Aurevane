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
      if (name === 'read_world_scene_players_v1') return sceneRpc(name, args)
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
import type { WorldCommand, WorldPlayer } from '@/world/types'
import { commitWorldCommand, readWorld, resetWorldReadCaches } from './world-repository'

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
})

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
  expect(sceneRpc).toHaveBeenCalledWith('read_world_scene_players_v1', {
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
