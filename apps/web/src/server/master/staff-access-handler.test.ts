import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { handleStaffAccessRequest } from './staff-access-handler'
import {
  createMasterPanelStaffAccessService,
  type MasterPanelStaffAccessStore,
  type SetCharacterStaffAccessInput,
} from './staff-access'
const owner = '11111111-1111-4111-8111-111111111111',
  staff = '22222222-2222-4222-8222-222222222222',
  character = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function fixture() {
  let saved: SetCharacterStaffAccessInput | null = null
  const store: MasterPanelStaffAccessStore = {
    readAccess: async () => ({
      userId: owner,
      roles: ['game-owner'],
      specialCapabilities: [],
      accessVersion: 1,
    }),
    listStaff: async () => [],
    resolveIdentity: async () => ({
      userId: staff,
      email: 'verified@example.com',
      characters: [{ characterId: character, name: 'Chosen', playable: true }],
    }),
    setCharacterAccess: async (input) => {
      saved = input
      return 2
    },
  }
  return {
    dependencies: {
      getActor: async () => ({ userId: owner }),
      createService: () => createMasterPanelStaffAccessService(store),
    },
    saved: () => saved,
  }
}
const post = (body: unknown) =>
  new Request('http://localhost/api/master/staff-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const command = {
  operation: 'set-character-access',
  targetUserId: staff,
  targetCharacterId: character,
  roles: ['content-staff'],
  specialCapabilities: [],
  days: null,
  expectedVersion: 0,
  enabled: true,
  confirmed: true,
}
it('resolves a verified name or email to all linked characters without caching identity data', async () => {
  const { dependencies } = fixture()
  const response = await handleStaffAccessRequest(
    post({ operation: 'resolve-account', query: 'Chosen' }),
    dependencies,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toContain('no-store')
  expect(await response.json()).toMatchObject({
    account: { characters: [{ characterId: character }] },
  })
})
it('reason_free_attribution: server identity wins over client claims and no reason is required', async () => {
  const { dependencies, saved } = fixture()
  const response = await handleStaffAccessRequest(
    post({ ...command, actorUserId: staff, actorCharacterId: 'forged' }),
    dependencies,
  )
  expect(response.status).toBe(200)
  expect(saved()).toMatchObject({ actorUserId: owner, targetCharacterId: character })
  expect(saved()).not.toHaveProperty('actorCharacterId')
  expect(saved()).not.toHaveProperty('reason')
})
it.each([
  { confirmed: false },
  { targetCharacterId: null },
  { roles: ['game-owner'] },
  { days: 0 },
  { days: -1 },
  { expectedVersion: -1 },
])('rejects invalid sensitive assignment %j', async (patch) => {
  const { dependencies, saved } = fixture()
  expect(
    (await handleStaffAccessRequest(post({ ...command, ...patch }), dependencies)).status,
  ).toBe(400)
  expect(saved()).toBeNull()
})
it('rejects obsolete account-wide assignment operations', async () => {
  const { dependencies } = fixture()
  expect(
    (
      await handleStaffAccessRequest(
        post({
          operation: 'grant-role',
          targetUserId: staff,
          role: 'content-staff',
          confirmed: true,
        }),
        dependencies,
      )
    ).status,
  ).toBe(400)
})
