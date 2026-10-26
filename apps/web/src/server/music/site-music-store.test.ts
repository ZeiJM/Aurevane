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
  database.maybeSingle.mockReset()
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
    song_library: config.songLibrary,
    revision: 2,
    updated_at: '2026-10-23T00:00:00Z',
  }
  database.maybeSingle
    .mockResolvedValueOnce({
      data: {
        ...row,
        route_overrides: [],
        revision: 1,
      },
      error: null,
    })
    .mockResolvedValue({ data: row, error: null })
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
  expect(database.update).toHaveBeenCalledTimes(1)
  expect(database.maybeSingle.mock.invocationCallOrder[0]).toBeLessThan(
    database.update.mock.invocationCallOrder[0]!,
  )
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
  database.maybeSingle
    .mockResolvedValueOnce({
      data: {
        enabled: true,
        default_track: config.defaultTrack,
        route_overrides: [],
        song_library: [config.defaultTrack],
        revision: 1,
        updated_at: '2026-10-23T00:00:00Z',
      },
      error: null,
    })
    .mockResolvedValue({
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

it('returns the current revision and timestamp without writing an unchanged normalized complete config', async () => {
  const config = parseSiteMusicDraft({
    ...createDefaultSiteMusicConfig(),
    routeOverrides: [
      {
        id: 'world',
        label: 'World',
        pathPrefix: '/game/world',
        enabled: true,
        mode: 'global',
        track: createDefaultSiteMusicConfig().defaultTrack,
      },
    ],
  })
  const unused = { ...config.defaultTrack, label: 'Unused', url: '/unused.mp3' }
  config.songLibrary = [...(config.songLibrary ?? []), unused]
  const row = {
    enabled: config.enabled,
    default_track: config.defaultTrack,
    route_overrides: config.routeOverrides,
    song_library: config.songLibrary,
    revision: '7',
    updated_at: '2026-10-25T12:00:00Z',
  }
  database.maybeSingle.mockResolvedValue({ data: row, error: null })

  const saved = await saveSiteMusicConfig({
    actorUserId: 'another-owner',
    expectedRevision: 7,
    config: {
      ...config,
      defaultTrack: {
        loop: config.defaultTrack.loop,
        source: config.defaultTrack.source,
        url: config.defaultTrack.url,
        label: config.defaultTrack.label,
      },
      routeOverrides: config.routeOverrides.map((entry) => ({
        ...entry,
        pathPrefix: `${entry.pathPrefix}///`,
      })),
    },
  })

  expect(saved).toEqual({ ...config, revision: 7, updatedAt: row.updated_at })
  expect(database.update).not.toHaveBeenCalled()
  expect(database.maybeSingle).toHaveBeenCalledTimes(1)
})

it('rejects an unchanged config with a stale expected revision before deciding it is a no-op', async () => {
  const config = parseSiteMusicDraft(createDefaultSiteMusicConfig())
  database.maybeSingle.mockResolvedValue({
    data: {
      enabled: config.enabled,
      default_track: config.defaultTrack,
      route_overrides: config.routeOverrides,
      song_library: config.songLibrary,
      revision: 2,
      updated_at: '2026-10-26T00:00:00Z',
    },
    error: null,
  })

  await expect(
    saveSiteMusicConfig({ actorUserId: 'owner', expectedRevision: 1, config }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(database.update).not.toHaveBeenCalled()
})

it('retains compare-and-swap protection if a changed config races after the read', async () => {
  const config = parseSiteMusicDraft(createDefaultSiteMusicConfig())
  database.maybeSingle
    .mockResolvedValueOnce({
      data: {
        enabled: config.enabled,
        default_track: config.defaultTrack,
        route_overrides: config.routeOverrides,
        song_library: config.songLibrary,
        revision: 1,
        updated_at: '2026-10-26T00:00:00Z',
      },
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: null })

  await expect(
    saveSiteMusicConfig({
      actorUserId: 'owner',
      expectedRevision: 1,
      config: { ...config, enabled: false },
    }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  expect(database.update).toHaveBeenCalledWith(
    expect.objectContaining({
      enabled: false,
      revision: 2,
      updated_by: 'owner',
    }),
  )
  expect(database.eq).toHaveBeenCalledWith('revision', 1)
})

it.each(['database error', 'rejected read', 'invalid stored row'])(
  'does not write or fall back to defaults when the authoritative read fails: %s',
  async (failure) => {
    const config = parseSiteMusicDraft(createDefaultSiteMusicConfig())
    if (failure === 'rejected read') {
      database.maybeSingle.mockRejectedValue(new Error('connection failed'))
    } else {
      database.maybeSingle.mockResolvedValue({
        data: failure === 'invalid stored row' ? { revision: 1 } : null,
        error: failure === 'database error' ? new Error('read failed') : null,
      })
    }

    await expect(
      saveSiteMusicConfig({ actorUserId: 'owner', expectedRevision: 1, config }),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
    expect(database.update).not.toHaveBeenCalled()
  },
)
