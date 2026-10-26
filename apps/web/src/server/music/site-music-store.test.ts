import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const database = vi.hoisted(() => ({
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from: () => database }),
}))
import { readSiteMusicConfig, saveSiteMusicConfig } from './site-music-store'
import {
  createDefaultSiteMusicConfig,
  resolveSiteMusicTrack,
  parseSiteMusicDraft,
} from '@/lib/site-music'
beforeEach(() => {
  vi.clearAllMocks()
  database.update.mockReturnValue(database)
  database.eq.mockReturnValue(database)
  database.select.mockReturnValue(database)
})
it('persists explicit global choices with CAS and actor attribution and reads them through the runtime resolver', async () => {
  const config = createDefaultSiteMusicConfig()
  config.routeOverrides = [
    {
      id: 'game',
      label: 'Legacy Game',
      pathPrefix: '/game',
      enabled: false,
      track: config.defaultTrack,
    },
    {
      id: 'world',
      label: 'World',
      pathPrefix: '/game/world',
      enabled: true,
      mode: 'global',
      track: { ...config.defaultTrack, url: '/old.mp3' },
    },
  ]
  config.songLibrary = parseSiteMusicDraft(config).songLibrary
  const row = {
    enabled: true,
    default_track: config.defaultTrack,
    route_overrides: config.routeOverrides,
    revision: 2,
    updated_at: '2026-10-23T00:00:00Z',
  }
  database.maybeSingle.mockResolvedValue({ data: row, error: null })
  const saved = await saveSiteMusicConfig({ actorUserId: 'owner', expectedRevision: 1, config })
  expect(database.update).toHaveBeenCalledWith(
    expect.objectContaining({
      route_overrides: config.routeOverrides,
      revision: 2,
      updated_by: 'owner',
      updated_at: expect.any(String),
    }),
  )
  expect(database.eq).toHaveBeenCalledWith('revision', 1)
  expect(saved.routeOverrides).toEqual(config.routeOverrides)
  expect(
    resolveSiteMusicTrack(await readSiteMusicConfig({ strict: true }), '/game/world')?.url,
  ).toBe(config.defaultTrack.url)
  expect(resolveSiteMusicTrack(saved, '/game/character')).toBeNull()
  database.maybeSingle.mockResolvedValue({ data: null, error: null })
  await expect(
    saveSiteMusicConfig({ actorUserId: 'owner', expectedRevision: 1, config }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
})

it('stores unassigned songs in the same CAS write and reads their names after reload', async () => {
  const config = createDefaultSiteMusicConfig()
  const spare = { ...config.defaultTrack, label: 'Evening', url: '/evening.webm' }
  const songLibrary = [config.defaultTrack, spare]
  database.maybeSingle.mockResolvedValue({
    data: {
      enabled: true,
      default_track: config.defaultTrack,
      route_overrides: [],
      song_library: songLibrary,
      revision: 2,
      updated_at: '2026-10-26T00:00:00Z',
    },
    error: null,
  })
  const saved = await saveSiteMusicConfig({
    actorUserId: 'owner',
    expectedRevision: 1,
    config: { ...config, songLibrary },
  })
  expect(database.update).toHaveBeenCalledWith(
    expect.objectContaining({ song_library: songLibrary, revision: 2 }),
  )
  expect(saved.songLibrary).toEqual(songLibrary)
  expect((await readSiteMusicConfig({ strict: true })).songLibrary).toEqual(songLibrary)
  await expect(
    saveSiteMusicConfig({
      actorUserId: 'owner',
      expectedRevision: 2,
      config: { ...saved, songLibrary: [spare] },
    }),
  ).rejects.toThrow(/still assigned/)
})

it('retains a stored unassigned song by rejecting writes without an explicit library', async () => {
  const config = createDefaultSiteMusicConfig()
  const unused = { ...config.defaultTrack, label: 'Unused saved song', url: '/unused.mp3' }
  database.maybeSingle.mockResolvedValue({
    data: {
      enabled: true,
      default_track: config.defaultTrack,
      route_overrides: [],
      song_library: [config.defaultTrack, unused],
      revision: 2,
      updated_at: '2026-10-26T00:00:00Z',
    },
    error: null,
  })
  await expect(
    saveSiteMusicConfig({ actorUserId: 'owner', expectedRevision: 2, config }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  expect(database.update).not.toHaveBeenCalled()
  expect((await readSiteMusicConfig({ strict: true })).songLibrary).toEqual([
    config.defaultTrack,
    unused,
  ])
})
