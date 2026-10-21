import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  createMasterPanelStaffAccessService,
  effectiveMasterPanelCapabilities,
  MASTER_PANEL_CAPABILITIES,
  type CharacterAccessAssignment,
  type MasterPanelStaffAccessStore,
} from './staff-access'
const owner = 'owner'
const input: CharacterAccessAssignment = {
  actorUserId: owner,
  targetCharacterId: 'first',
  roles: ['content-staff'],
  specialCapabilities: [],
  days: null,
  bindLegacy: false,
  expectedAccessVersion: null,
}
function fixture() {
  const store: MasterPanelStaffAccessStore = {
    readAccess: vi.fn(async (userId) => ({
      userId,
      characterId: 'selected',
      accessVersion: 1,
      roles: [userId === owner ? ('game-owner' as const) : ('content-staff' as const)],
      specialCapabilities: [],
    })),
    listStaff: vi.fn(async () => []),
    resolveAccounts: vi.fn(async () => []),
    setCharacterAccess: vi.fn(async () => 2),
    revokeLegacyAccess: vi.fn(),
    revokeCharacterAccess: vi.fn(async () => 3),
  }
  return { store, service: createMasterPanelStaffAccessService(store) }
}
it('preserves canonical role presets and single nondelegable Owner capabilities', () => {
  expect(effectiveMasterPanelCapabilities(['game-owner'])).toEqual(MASTER_PANEL_CAPABILITIES)
  expect(effectiveMasterPanelCapabilities(['content-staff'])).toEqual([
    'master.access',
    'content.combat.author',
  ])
  expect(effectiveMasterPanelCapabilities(['moderator', 'event-staff'])).not.toContain(
    'staff.manage',
  )
})
it('reads fresh authority for every protected service operation', async () => {
  const f = fixture()
  expect((await f.service.requireCapability('staff', 'content.combat.author')).characterId).toBe(
    'selected',
  )
  vi.mocked(f.store.readAccess).mockResolvedValueOnce(null)
  await expect(f.service.requireCapability('staff', 'content.combat.author')).rejects.toMatchObject(
    { code: 'FORBIDDEN' },
  )
  expect(f.store.readAccess).toHaveBeenCalledTimes(2)
})
it('keeps lookup/list/assignment/revocation Owner-only', async () => {
  const f = fixture()
  await expect(f.service.resolveAccounts('staff', 'First')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  await expect(f.service.listStaff('staff')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(
    f.service.setCharacterAccess({ ...input, actorUserId: 'staff' }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(
    f.service.revokeCharacterAccess({ ...input, actorUserId: 'staff' }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('passes selected-only reason-free assignment and explicit legacy binding to atomic storage', async () => {
  const f = fixture()
  await expect(f.service.setCharacterAccess({ ...input, days: 3, bindLegacy: true })).resolves.toBe(
    2,
  )
  expect(f.store.setCharacterAccess).toHaveBeenCalledWith({ ...input, days: 3, bindLegacy: true })
  expect(vi.mocked(f.store.setCharacterAccess).mock.calls[0]?.[0]).not.toHaveProperty('reason')
})
it.each([0, -1, 0.5, NaN, Infinity, 2147483648])(
  'rejects invalid UTC duration %s',
  async (days) => {
    const f = fixture()
    await expect(f.service.setCharacterAccess({ ...input, days })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
    expect(f.store.setCharacterAccess).not.toHaveBeenCalled()
  },
)
it('resolves a character name without requiring an email-only entry route', async () => {
  const f = fixture()
  await f.service.resolveAccounts(owner, 'First')
  expect(f.store.resolveAccounts).toHaveBeenCalledWith(owner, 'First')
})
