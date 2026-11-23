import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/server/master/selected-character-rpc', () => ({
  createSelectedCharacterRpc: (rpc: unknown) => rpc,
}))
const database = vi.hoisted(() => ({
  rpc: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from: () => database, rpc: database.rpc }),
}))
import { readSiteMusicConfig, saveSiteMusicConfig } from './site-music-store'
import {
  createDefaultSiteMusicConfig,
  parseSiteMusicDraft,
  resolveSiteMusicTrack,
} from '@/lib/site-music'
beforeEach(() => {
  vi.clearAllMocks()
  database.select.mockReturnValue(database)
  database.eq.mockReturnValue(database)
})
const config = () => parseSiteMusicDraft(createDefaultSiteMusicConfig())
const row = () => ({
  enabled: true,
  default_track: config().defaultTrack,
  route_overrides: [],
  song_library: config().songLibrary,
  revision: 2,
  updated_at: '2026-10-27T00:00:00Z',
})
it('uses one authoritative selected-character RPC for music writes and reads the saved runtime config', async () => {
  database.rpc.mockResolvedValue({ data: row(), error: null })
  const saved = await saveSiteMusicConfig({
    actorUserId: 'staff',
    expectedRevision: 1,
    config: config(),
  })
  expect(database.rpc).toHaveBeenCalledWith('save_site_music_configuration_v1', {
    p_actor_user_id: 'staff',
    p_expected_revision: 1,
    p_config: config(),
  })
  expect(saved.revision).toBe(2)
  database.maybeSingle.mockResolvedValue({ data: row(), error: null })
  expect(
    resolveSiteMusicTrack(await readSiteMusicConfig({ strict: true }), '/game/world')?.url,
  ).toBe(saved.defaultTrack.url)
})
it('preserves authoritative no-op revision and timestamp returned by SQL', async () => {
  database.rpc.mockResolvedValue({ data: { ...row(), revision: '7' }, error: null })
  expect(
    await saveSiteMusicConfig({ actorUserId: 'staff', expectedRevision: 7, config: config() }),
  ).toMatchObject({ revision: 7, updatedAt: '2026-10-27T00:00:00Z' })
})
it.each([
  ['PT409', 'STALE_VERSION'],
  ['40001', 'STALE_VERSION'],
  ['42501', 'FORBIDDEN'],
  ['22023', 'INVALID_REQUEST'],
  ['XX000', 'PERSISTENCE_UNAVAILABLE'],
])('maps %s without leaking private SQL', async (code, expected) => {
  database.rpc.mockResolvedValue({ data: null, error: { code, message: 'private SQL' } })
  await expect(
    saveSiteMusicConfig({ actorUserId: 'staff', expectedRevision: 1, config: config() }),
  ).rejects.toMatchObject({ code: expected })
})
it('rejects incomplete libraries and unsupported providers before issuing a write', async () => {
  await expect(
    saveSiteMusicConfig({
      actorUserId: 'staff',
      expectedRevision: 1,
      config: createDefaultSiteMusicConfig(),
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  await expect(
    saveSiteMusicConfig({
      actorUserId: 'staff',
      expectedRevision: 1,
      config: {
        ...config(),
        defaultTrack: { ...config().defaultTrack, url: 'https://www.youtube.com/watch?v=test' },
      },
    }),
  ).rejects.toThrow(/YouTube/)
  expect(database.rpc).not.toHaveBeenCalled()
})
it('fails closed on invalid stored or RPC records', async () => {
  database.rpc.mockResolvedValue({ data: { revision: 1 }, error: null })
  await expect(
    saveSiteMusicConfig({ actorUserId: 'staff', expectedRevision: 1, config: config() }),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  database.maybeSingle.mockResolvedValue({ data: null, error: { code: 'XX000' } })
  await expect(readSiteMusicConfig({ strict: true })).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
