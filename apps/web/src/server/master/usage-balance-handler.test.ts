import { expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
vi.mock('server-only', () => ({}))
vi.mock('./usage-balance-server', () => ({ createServerUsageBalanceService: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: vi.fn() }))
import { handleUsageBalanceRequest } from './usage-balance-handler'
it('uses only authenticated identity and keeps reporting responses private', async () => {
  const read = vi.fn().mockResolvedValue({ contentKey: 'vanguard' })
  const response = await handleUsageBalanceRequest(
    new Request(
      'https://game.test/api/master/combat-content/usage-balance?contentKey=vanguard&actorUserId=forged',
    ),
    { getActor: async () => ({ userId: 'actual' }), createService: () => ({ read }) },
  )
  expect(read).toHaveBeenCalledWith('actual', 'vanguard', undefined)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(response.status).toBe(200)
})
it('denies revoked authority without exposing data or backend exceptions', async () => {
  const response = await handleUsageBalanceRequest(
    new Request('https://game.test/api/master/combat-content/usage-balance?contentKey=vanguard'),
    {
      getActor: async () => ({ userId: 'actual' }),
      createService: () => ({
        read: async () => {
          throw new AurevaneError('FORBIDDEN', 'Access revoked.')
        },
      }),
    },
  )
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({
    error: { code: 'FORBIDDEN', message: 'Access revoked.' },
  })
})

it('forwards the selected collected week without accepting a supplied actor', async () => {
  const read = vi.fn().mockResolvedValue({})
  await handleUsageBalanceRequest(
    new Request(
      'https://game.test/api/master/combat-content/usage-balance?contentKey=vanguard&week=2026-10-19&actorUserId=forged',
    ),
    { getActor: async () => ({ userId: 'actual' }), createService: () => ({ read }) },
  )
  expect(read).toHaveBeenCalledWith('actual', 'vanguard', '2026-10-19')
})
