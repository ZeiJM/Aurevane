import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('./activity-log-server', () => ({ createServerMasterActivityService: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: vi.fn() }))
import { AurevaneError } from '@aurevane/game-core/errors'
import { createMasterActivityService, parseMasterActivityFeed } from './activity-log'
import { handleMasterActivityRequest } from './activity-log-handler'

const feed = {
  entries: [
    {
      id: '1',
      occurredAt: '2026-10-26T06:00:00Z',
      actor: 'Mira',
      action: 'Published content',
      subject: 'Ember',
      detail: '',
    },
  ],
  weekStartsAt: '2026-10-26T00:00:00Z',
  resetsAt: '2026-11-02T00:00:00Z',
  nextCursor: null,
}
const access = (roles: ('game-owner' | 'moderator')[]) => ({
  requireCapability: async () => ({
    userId: 'actor',
    roles,
    accessVersion: 1,
    effectiveCapabilities: [],
    specialCapabilities: [],
  }),
})
it('requires live Activity Log page access and projects bounded display data', async () => {
  const rpc = vi.fn(async () => ({ ...feed, privatePayload: 'secret' }))
  const denied = {
    requireCapability: async () => {
      throw new AurevaneError('FORBIDDEN', 'Page access required.')
    },
  }
  await expect(createMasterActivityService(denied, rpc).read('actor')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  expect(rpc).not.toHaveBeenCalled()
  expect(await createMasterActivityService(access(['moderator']), rpc).read('actor')).toEqual(feed)
  const result = await createMasterActivityService(access(['game-owner']), rpc).read('actor', '23')
  expect(result).toEqual(feed)
  expect(rpc).toHaveBeenCalledWith('read_master_panel_activity_v1', {
    p_actor_user_id: 'actor',
    p_limit: 100,
    p_before_id: '23',
  })
  expect(() =>
    parseMasterActivityFeed({ ...feed, entries: [{ ...feed.entries[0], actor: 'x'.repeat(121) }] }),
  ).toThrow()
  expect(() => parseMasterActivityFeed({ ...feed, resetsAt: feed.weekStartsAt })).toThrow()
})
it('returns private no-store reads and rejects invalid or caller-supplied actor parameters', async () => {
  const read = vi.fn(async () => feed)
  const dependencies = {
    getActor: async () => ({ userId: 'owner' }),
    createService: () => ({ read }),
  }
  const response = await handleMasterActivityRequest(
    new Request('https://a.test/api/master/activity?before=2'),
    dependencies,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual(feed)
  for (const query of [
    'before=-1',
    'before=9223372036854775808',
    'actor=other',
    'before=1&before=2',
  ]) {
    const result = await handleMasterActivityRequest(
      new Request(`https://a.test/api/master/activity?${query}`),
      dependencies,
    )
    expect(result.status).toBe(400)
  }
  const denied = await handleMasterActivityRequest(
    new Request('https://a.test/api/master/activity'),
    {
      ...dependencies,
      getActor: async () => {
        throw new AurevaneError('UNAUTHENTICATED', 'Sign in.')
      },
    },
  )
  expect(denied.status).toBe(401)
})
