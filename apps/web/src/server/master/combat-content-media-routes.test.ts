import { beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  actor: vi.fn(),
  selection: vi.fn(),
  capability: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.actor }))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: mocks.selection }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: mocks.capability }),
}))
import { POST, GET as list } from '@/app/api/master/combat-content/media/route'
import { GET as preview } from '@/app/api/master/combat-content/media/[mediaId]/route'
import { GET as published } from '@/app/api/content-media/[mediaId]/route'
const bytes = Buffer.from(
  '524946462600000057415645666d7420100000000100010044ac0000885801000200100064617461020000000000',
  'hex',
)
const id = '00000000-0000-4000-8000-000000000012'
const descriptor = {
  id,
  kind: 'audio',
  contentType: 'audio/wav',
  byteLength: bytes.length,
  checksum: createHash('sha256').update(bytes).digest('hex'),
  channels: 1,
  sampleRate: 44100,
  durationMs: 0.023,
}
const context = { params: Promise.resolve({ mediaId: id }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.actor.mockResolvedValue({ userId: 'verified-user' })
  mocks.selection.mockResolvedValue({ id: 'selected-character' })
  mocks.capability.mockResolvedValue(undefined)
})
it('real POST normalizes file bytes, re-reads selected actor and calls the actual SQL entrypoint', async () => {
  mocks.rpc.mockResolvedValue({ data: descriptor, error: null })
  const body = new FormData()
  body.set('file', new File([bytes], 'sound.wav', { type: 'audio/wav' }))
  const response = await POST(
    new Request('https://local/api/master/combat-content/media', { method: 'POST', body }),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ media: descriptor })
  const normalizedDescriptor = Object.fromEntries(
    Object.entries(descriptor).filter(([key]) => key !== 'id'),
  )
  expect(mocks.rpc).toHaveBeenCalledWith('finalize_combat_content_media_v1', {
    p_actor_user_id: 'verified-user',
    p_actor_character_id: 'selected-character',
    p_bytes: `\\x${bytes.toString('hex')}`,
    p_descriptor: normalizedDescriptor,
  })
  expect(mocks.capability).toHaveBeenCalledWith('verified-user', 'content.combat.author')
  expect(mocks.selection).toHaveBeenCalledWith({ userId: 'verified-user' })
})
it('preview GET uses fresh selection without browser actor headers; public GET requires published reachability', async () => {
  mocks.rpc.mockResolvedValue({
    data: { descriptor, bytes: bytes.toString('base64') },
    error: null,
  })
  const request = new Request(`https://local/api/content-media/${id}`)
  const privateResponse = await preview(request, context)
  expect(privateResponse.status).toBe(200)
  expect(privateResponse.headers.get('Cache-Control')).toBe('private, no-store')
  expect(mocks.rpc).toHaveBeenLastCalledWith('read_combat_content_media_v1', {
    p_actor_user_id: 'verified-user',
    p_actor_character_id: 'selected-character',
    p_media_id: id,
  })
  mocks.selection.mockResolvedValue(null)
  await preview(request, context)
  expect(mocks.rpc).toHaveBeenLastCalledWith('read_combat_content_media_v1', {
    p_actor_user_id: 'verified-user',
    p_actor_character_id: null,
    p_media_id: id,
  })
  mocks.actor.mockRejectedValue(new Error('No browser session'))
  const publicResponse = await published(request, context)
  expect(publicResponse.status).toBe(200)
  expect(Buffer.from(await publicResponse.arrayBuffer())).toEqual(bytes)
  expect(mocks.rpc).toHaveBeenLastCalledWith('read_published_combat_content_media_v1', {
    p_media_id: id,
  })
  expect(
    (
      await published(
        new Request(request.url, { headers: { 'If-None-Match': `"${descriptor.checksum}"` } }),
        context,
      )
    ).status,
  ).toBe(304)
  mocks.rpc.mockResolvedValue({ data: null, error: null })
  expect((await published(request, context)).status).toBe(404)
})
it('real private list and preview preserve SQL denial without exposing bytes or internal errors', async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: '42501', message: 'private internals' },
  })
  const response = await preview(
    new Request(`https://local/api/master/combat-content/media/${id}`),
    context,
  )
  expect(response.status).toBe(403)
  expect(await response.text()).not.toContain('private internals')
  expect((await list()).status).toBe(403)
})
