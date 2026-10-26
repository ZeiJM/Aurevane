import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
vi.mock('server-only', () => ({}))
const api = vi.hoisted(() => ({
  access: vi.fn(),
  save: vi.fn(),
  signed: vi.fn(),
  storage: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: api.access }),
}))
vi.mock('@/server/music/site-music-store', () => ({ saveSiteMusicConfig: api.save }))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ storage: { from: api.storage } }),
}))
import { POST } from './route'
import { createDefaultSiteMusicConfig } from '@/lib/site-music'
const request = (body: unknown) =>
  POST(
    new Request('https://example.test/api/master/site-music', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
beforeEach(() => {
  vi.clearAllMocks()
  api.access.mockResolvedValue(undefined)
  api.storage.mockReturnValue({
    createSignedUploadUrl: api.signed,
    getPublicUrl: (path: string) => ({
      data: { publicUrl: `https://storage.example.test/${path}` },
    }),
  })
})
it('requires existing management capability before save or upload', async () => {
  api.access.mockRejectedValue(new AurevaneError('FORBIDDEN', 'Owner only'))
  for (const operation of ['save', 'create-upload'])
    expect((await request({ operation })).status).toBe(403)
  expect(api.save).not.toHaveBeenCalled()
  expect(api.storage).not.toHaveBeenCalled()
})
it('saves the explicit mode unchanged with internal CAS and creates validated durable upload tickets', async () => {
  const config = createDefaultSiteMusicConfig()
  config.songLibrary = [config.defaultTrack]
  config.routeOverrides = [
    {
      id: 'world',
      label: 'World',
      pathPrefix: '/game/world',
      enabled: true,
      mode: 'global',
      track: config.defaultTrack,
    },
  ]
  api.save.mockResolvedValue(config)
  expect((await request({ operation: 'save', expectedRevision: 3, config })).status).toBe(200)
  expect(api.save).toHaveBeenCalledWith({
    actorUserId: 'owner',
    expectedRevision: 3,
    config: {
      enabled: true,
      defaultTrack: config.defaultTrack,
      routeOverrides: config.routeOverrides,
      songLibrary: [config.defaultTrack],
    },
  })
  api.signed.mockImplementation(async (path: string) => ({
    data: { path, token: 'test-ticket' },
    error: null,
  }))
  const response = await request({
    operation: 'create-upload',
    file: { name: 'world.mp3', size: 12, type: 'audio/mpeg' },
  })
  expect(response.status).toBe(200)
  expect((await response.json()).upload).toMatchObject({
    bucket: 'site-music',
    token: 'test-ticket',
    path: expect.stringMatching(/^uploads\/\d{4}-\d{2}-\d{2}\/.*\.mp3$/),
    track: { source: 'upload', loop: true },
  })
  for (const file of [
    { name: 'bad.exe', size: 12, type: 'application/octet-stream' },
    { name: 'huge.mp3', size: 20 * 1024 * 1024 + 1, type: 'audio/mpeg' },
  ])
    expect((await request({ operation: 'create-upload', file })).status).toBe(400)
  expect(api.signed).toHaveBeenCalledTimes(1)
})

it('rejects legacy saves that omit the song library before they can replace stored unused songs', async () => {
  const config = createDefaultSiteMusicConfig()
  api.save.mockResolvedValue({
    ...config,
    songLibrary: [
      config.defaultTrack,
      { ...config.defaultTrack, label: 'Unused saved song', url: '/unused.mp3' },
    ],
  })
  const response = await request({ operation: 'save', expectedRevision: 1, config })
  expect(response.status).toBe(400)
  expect((await response.json()).error.message).toMatch(/refresh.*library/i)
  expect(api.save).not.toHaveBeenCalled()
})
