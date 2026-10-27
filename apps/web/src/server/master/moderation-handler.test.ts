import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: vi.fn() }))
vi.mock('./moderation-server', () => ({ createServerMasterModerationService: vi.fn() }))
import { AurevaneError } from '@aurevane/game-core/errors'
import { handleMasterModerationRequest } from './moderation-handler'
const target = '11111111-1111-4111-8111-111111111111'
const request = (body: unknown) =>
  new Request('https://a.test/api/master/moderation', {
    method: 'POST',
    body: JSON.stringify(body),
  })
it('uses the authenticated actor and rejects forged actor fields and unconfirmed writes', async () => {
  const write = vi.fn(async () => ({ active: true })),
    search = vi.fn(async () => []),
    read = vi.fn()
  const dependencies = {
    getActor: async () => ({ userId: 'verified' }),
    createService: () => ({ search, read, write }) as never,
  }
  const body = {
    operation: 'write',
    targetUserId: target,
    action: 'ban',
    expectedRevision: '0',
    minutes: 60,
    permanent: false,
    reason: 'Reviewed conduct',
    confirmed: true,
  }
  const result = await handleMasterModerationRequest(request(body), dependencies)
  expect(result.status).toBe(200)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(write).toHaveBeenCalledWith(
    'verified',
    expect.objectContaining({ targetUserId: target, reason: 'Reviewed conduct' }),
  )
  write.mockClear()
  for (const invalid of [
    { ...body, actorUserId: 'forged' },
    { ...body, confirmed: false },
    { ...body, targetUserId: 'invalid' },
  ])
    expect((await handleMasterModerationRequest(request(invalid), dependencies)).status).toBe(400)
  expect(write).not.toHaveBeenCalled()
})
it('denies signed-out requests before constructing a privileged service', async () => {
  const createService = vi.fn()
  const result = await handleMasterModerationRequest(
    request({ operation: 'search', query: 'Mira' }),
    {
      getActor: async () => {
        throw new AurevaneError('UNAUTHENTICATED', 'Sign in.')
      },
      createService,
    },
  )
  expect(result.status).toBe(401)
  expect(createService).not.toHaveBeenCalled()
})
