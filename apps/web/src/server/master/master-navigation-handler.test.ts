import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: vi.fn() }))
vi.mock('./master-navigation-server', () => ({ createServerMasterNavigationService: vi.fn() }))
import { AurevaneError } from '@aurevane/game-core/errors'
import { handleMasterNavigationRequest } from './master-navigation-handler'
const request = (body: unknown) =>
  new Request('https://a.test/api/master/navigation', {
    method: 'POST',
    body: JSON.stringify(body),
  })
it('rejects client actor injection and returns private results using the authenticated identity', async () => {
  const settings = { revision: 2, order: [] }
  const save = vi.fn(async () => settings)
  const dependencies = {
    getActor: async () => ({ userId: 'verified' }),
    createService: () => ({ save }) as never,
  }
  const input = { expectedRevision: 1, order: [] }
  const result = await handleMasterNavigationRequest(request(input), dependencies)
  expect(result.status).toBe(200)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await result.json()).toEqual({ settings })
  expect(save).toHaveBeenCalledWith('verified', input)
  expect(
    (
      await handleMasterNavigationRequest(
        request({ ...input, actorUserId: 'forged' }),
        dependencies,
      )
    ).status,
  ).toBe(400)
  expect(save).toHaveBeenCalledTimes(1)
})
it('does not construct privileged persistence for signed-out requests', async () => {
  const createService = vi.fn()
  const result = await handleMasterNavigationRequest(request({}), {
    getActor: async () => {
      throw new AurevaneError('UNAUTHENTICATED', 'Sign in.')
    },
    createService,
  })
  expect(result.status).toBe(401)
  expect(createService).not.toHaveBeenCalled()
})
