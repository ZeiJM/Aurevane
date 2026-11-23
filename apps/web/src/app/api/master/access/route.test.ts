import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const access = vi.hoisted(() => ({ readAccess: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'verified' }),
}))
vi.mock('@/server/master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => access,
}))
import { GET } from './route'
beforeEach(() => access.readAccess.mockReset())
it.each([
  { roles: ['moderator'], effectiveCapabilities: [], expected: false },
  { roles: ['moderator'], effectiveCapabilities: ['content.combat.author'], expected: false },
  { roles: ['moderator'], effectiveCapabilities: ['master.access'], expected: true },
  {
    roles: ['game-owner'],
    effectiveCapabilities: ['master.access', 'staff.manage'],
    expected: true,
  },
])(
  'reports current effective Master entry permission for $roles / $effectiveCapabilities',
  async ({ roles, effectiveCapabilities, expected }) => {
    access.readAccess.mockResolvedValue({
      userId: 'verified',
      accessVersion: 1,
      roles,
      specialCapabilities: [],
      effectiveCapabilities,
    })
    const response = await GET()
    expect(await response.json()).toEqual({ hasAccess: expected })
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(access.readAccess).toHaveBeenCalledExactlyOnceWith('verified')
  },
)
it('does not expose entry after selected-character expiry or revocation', async () => {
  access.readAccess.mockResolvedValue(null)
  expect(await (await GET()).json()).toEqual({ hasAccess: false })
})
