import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const { rpc, images } = vi.hoisted(() => ({ rpc: vi.fn(), images: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('./world-repository', () => ({
  resolveWorldPlayerImages: images,
  worldRpcError: () => {
    throw new Error('Unavailable')
  },
}))
import { readLiveWorldPlayers } from './world-live-presence-repository'
import { newWorldState, revealNearby } from '@/world/travel'
const player = (sectorId: string, x: number, y: number) => ({
  characterId: 'peer',
  name: 'Peer',
  level: 2,
  portraitRef: 'portrait.starter.wayfarer-01',
  imageUrl: null,
  position: { sectorId, x, y },
  online: true,
  attackable: true,
})
beforeEach(() => {
  rpc.mockReset()
  images
    .mockReset()
    .mockImplementation(async (players) =>
      players.map((p: object) => ({ ...p, imageUrl: '/real-portrait' })),
    )
})
it('reads only service-registered scene peers and never serializes owned private state', async () => {
  const state = newWorldState()
  rpc.mockResolvedValue({
    data: {
      version: state.version,
      serverNow: 1200,
      state,
      sceneSectorIds: [state.position.sectorId],
      players: [player(state.position.sectorId, 6, 4), player('survey-01', 11, 1)],
      registered: true,
    },
  })
  const result = await readLiveWorldPlayers('owner', 'selected', 1)
  expect(rpc).toHaveBeenCalledWith('read_world_live_players_v1', {
    p_user_id: 'owner',
    p_character_id: 'selected',
    p_expected_version: 1,
  })
  expect(result.players).toHaveLength(1)
  expect(result.players[0]!.imageUrl).toBe('/real-portrait')
  expect(result).not.toHaveProperty('state')
  expect(result).not.toHaveProperty('discoveries')
})
it('filters unknown peers before looking up their portraits', async () => {
  const state = revealNearby({
    ...newWorldState(),
    position: { sectorId: 'survey-01', x: 6, y: 8 },
  })
  rpc.mockResolvedValue({
    data: {
      version: 1,
      serverNow: 1200,
      state,
      sceneSectorIds: ['survey-01'],
      players: [player('survey-01', 11, 1)],
      registered: true,
    },
  })
  expect((await readLiveWorldPlayers('owner', 'selected', 1)).players).toEqual([])
  expect(images).toHaveBeenCalledWith([])
})
it('does not enrich an expired registration or a different owned version', async () => {
  for (const registered of [false, true]) {
    rpc.mockResolvedValue({
      data: {
        version: 2,
        serverNow: 1200,
        state: { ...newWorldState(), version: 2 },
        sceneSectorIds: [],
        players: [],
        registered,
      },
    })
    expect((await readLiveWorldPlayers('owner', 'selected', 1)).registered).toBe(false)
  }
  expect(images).not.toHaveBeenCalled()
})
it('keeps old-reader compatibility without accepting any other persistence failure', async () => {
  rpc.mockResolvedValueOnce({ error: { code: 'PGRST202' } })
  expect((await readLiveWorldPlayers('owner', 'selected', 1)).registered).toBe(false)
  rpc.mockResolvedValueOnce({ error: { code: '42501' } })
  await expect(readLiveWorldPlayers('owner', 'selected', 1)).rejects.toThrow('Unavailable')
})
it.each([
  {
    version: 1,
    serverNow: 1200,
    state: newWorldState(),
    registered: true,
    sceneSectorIds: Array(26).fill('a'),
    players: [],
  },
  {
    version: 1,
    serverNow: 1200,
    state: newWorldState(),
    registered: true,
    sceneSectorIds: ['a'],
    players: Array(201).fill({}),
  },
  {
    version: 1,
    serverNow: NaN,
    state: newWorldState(),
    registered: true,
    sceneSectorIds: ['a'],
    players: [],
  },
])('rejects malformed or oversized registered receipts', async (data) => {
  rpc.mockResolvedValue({ data })
  await expect(readLiveWorldPlayers('owner', 'selected', 1)).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
