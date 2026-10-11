import { beforeEach, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
vi.mock('server-only', () => ({}))
const { requireCapability, publish } = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  publish: vi.fn(),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'staff' }) }))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability }),
}))
vi.mock('@/server/master/battlefield-elevation-policy-store', () => ({
  publishBattlefieldElevationPolicy: publish,
}))
import { POST } from './route'
beforeEach(() => {
  requireCapability.mockReset()
  publish.mockReset()
})
it('requires staff authority before reading or publishing a body', async () => {
  requireCapability.mockRejectedValueOnce(new AurevaneError('FORBIDDEN', 'Owner only'))
  const response = await POST(
    new Request('http://localhost/api/master/combat-elevation', {
      method: 'POST',
      body: 'invalid',
    }),
  )
  expect(response.status).toBe(403)
  expect(publish).not.toHaveBeenCalled()
})
it('passes the authenticated actor and returns a private policy response', async () => {
  const policy = {
    version: 2,
    level1BasisPoints: 10000,
    level2BasisPoints: 0,
    level3BasisPoints: 0,
  }
  publish.mockResolvedValueOnce(policy)
  const response = await POST(
    new Request('http://localhost/api/master/combat-elevation', {
      method: 'POST',
      body: JSON.stringify({ policy, reason: 'test' }),
    }),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ policy })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(publish).toHaveBeenCalledWith({ actorUserId: 'staff', policy, reason: 'test' })
})
