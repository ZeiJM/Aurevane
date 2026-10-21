import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { handleStaffAccessRequest } from './staff-access-handler'
import type { MasterPanelStaffAccessService } from './staff-access'
const owner = '11111111-1111-4111-8111-111111111111'
const character = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const post = (body: unknown) =>
  new Request('http://localhost/api/master/staff-access', {
    method: 'POST',
    body: JSON.stringify(body),
  })
function fixture() {
  const service: MasterPanelStaffAccessService = {
    readAccess: vi.fn(),
    requireCapability: vi.fn(),
    listStaff: vi.fn(),
    resolveAccounts: vi.fn(async () => []),
    setCharacterAccess: vi.fn(async () => 2),
    revokeLegacyAccess: vi.fn(),
    revokeCharacterAccess: vi.fn(async () => 3),
  }
  return {
    service,
    dependencies: { getActor: async () => ({ userId: owner }), createService: () => service },
  }
}
it('resolves exact character names or email through verified actor identity', async () => {
  const f = fixture()
  const response = await handleStaffAccessRequest(
    post({ operation: 'resolve-accounts', query: 'First' }),
    f.dependencies,
  )
  expect(response.status).toBe(200)
  expect(f.service.resolveAccounts).toHaveBeenCalledWith(owner, 'First')
})
it('reason_free_attribution: accepts confirmed selected-only grants and injects verified identity', async () => {
  const f = fixture()
  const response = await handleStaffAccessRequest(
    post({
      operation: 'set-character-access',
      targetCharacterId: character,
      roles: ['content-staff'],
      specialCapabilities: [],
      days: 2,
      bindLegacy: true,
      expectedAccessVersion: 1,
      confirmed: true,
      actorUserId: 'forged',
    }),
    f.dependencies,
  )
  expect(response.status).toBe(200)
  expect(f.service.setCharacterAccess).toHaveBeenCalledWith({
    actorUserId: owner,
    targetCharacterId: character,
    roles: ['content-staff'],
    specialCapabilities: [],
    days: 2,
    bindLegacy: true,
    expectedAccessVersion: 1,
  })
})
it.each([
  { confirmed: false },
  { days: 0 },
  { days: -1 },
  { days: 1.5 },
  { days: '2' },
  { roles: ['game-owner'] },
  { specialCapabilities: ['staff.manage'] },
  { targetCharacterId: 'bad' },
])('rejects invalid selected grants %j', async (change) => {
  const f = fixture()
  const response = await handleStaffAccessRequest(
    post({
      operation: 'set-character-access',
      targetCharacterId: character,
      roles: ['content-staff'],
      specialCapabilities: [],
      days: null,
      bindLegacy: false,
      expectedAccessVersion: null,
      confirmed: true,
      ...change,
    }),
    f.dependencies,
  )
  expect(response.status).toBe(400)
  expect(f.service.setCharacterAccess).not.toHaveBeenCalled()
})
it('revokes one character without a written reason', async () => {
  const f = fixture()
  const response = await handleStaffAccessRequest(
    post({
      operation: 'revoke-character-access',
      targetCharacterId: character,
      expectedAccessVersion: 2,
      confirmed: true,
    }),
    f.dependencies,
  )
  expect(response.status).toBe(200)
  expect(f.service.revokeCharacterAccess).toHaveBeenCalledWith({
    actorUserId: owner,
    targetCharacterId: character,
    expectedAccessVersion: 2,
  })
})
