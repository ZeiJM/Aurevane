import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ rpc: mocks.rpc }),
}))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadPublicCharacterProfileImageMap: async () => new Map(),
}))

import { getPvpBattleMetadata } from './pvp-lobby-service'

const payload = {
  lobby_id: 'lobby',
  mode: '1v1',
  battle_key: 'battle-key',
  local_character_id: 'character',
  participants: [],
}

describe('participant battle origin projection', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it.each(['world', 'battle-hall'] as const)('retains the authorized %s origin', async (origin) => {
    mocks.rpc.mockResolvedValue({ data: { ...payload, origin }, error: null })
    expect(await getPvpBattleMetadata('owner', 'battle')).toMatchObject({ origin })
  })

  it('does not invent an origin when an older reader omits it', async () => {
    mocks.rpc.mockResolvedValue({ data: payload, error: null })
    expect((await getPvpBattleMetadata('owner', 'battle'))?.origin).toBeUndefined()
  })

  it('rejects an invalid projected origin', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...payload, origin: 'elsewhere' }, error: null })
    await expect(getPvpBattleMetadata('owner', 'battle')).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('keeps a denied participant read empty', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    expect(await getPvpBattleMetadata('other', 'battle')).toBeNull()
  })
})
