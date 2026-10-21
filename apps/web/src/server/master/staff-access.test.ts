import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  createMasterPanelStaffAccessService,
  effectiveMasterPanelCapabilities,
  MASTER_PANEL_SPECIAL_CAPABILITIES,
  type MasterPanelAccessRecord,
  type MasterPanelStaffAccessStore,
  type SetCharacterStaffAccessInput,
} from './staff-access'
const owner = '11111111-1111-4111-8111-111111111111',
  staff = '22222222-2222-4222-8222-222222222222',
  character = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function fixture() {
  const records = new Map<string, MasterPanelAccessRecord>([
    [owner, { userId: owner, roles: ['game-owner'], specialCapabilities: [], accessVersion: 1 }],
  ])
  let saved: SetCharacterStaffAccessInput | null = null
  const store: MasterPanelStaffAccessStore = {
    readAccess: async (userId) => records.get(userId) ?? null,
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
  const input: SetCharacterStaffAccessInput = {
    actorUserId: owner,
    targetUserId: staff,
    targetCharacterId: character,
    roles: ['content-staff'],
    specialCapabilities: [],
    days: null,
    expectedVersion: 0,
    enabled: true,
  }
  return { service: createMasterPanelStaffAccessService(store), records, input, saved: () => saved }
}
describe('selected-character staff service', () => {
  it('preserves canonical role presets and nondelegable root powers', () => {
    expect(effectiveMasterPanelCapabilities(['content-staff'])).toEqual([
      'master.access',
      'content.combat.author',
    ])
    expect(effectiveMasterPanelCapabilities(['event-staff'])).toEqual([
      'master.access',
      'events.author',
      'events.operate',
    ])
    expect(effectiveMasterPanelCapabilities(['moderator'])).toEqual(['master.access'])
    expect(effectiveMasterPanelCapabilities(['game-owner'])).toContain('staff.manage')
    expect(MASTER_PANEL_SPECIAL_CAPABILITIES).not.toContain('staff.manage')
  })
  it('expired_revoked_open_session: rereads live access for the next protected action', async () => {
    const { service, records } = fixture()
    records.set(staff, {
      userId: staff,
      roles: ['content-staff'],
      specialCapabilities: [],
      accessVersion: 1,
    })
    await expect(service.requireCapability(staff, 'content.combat.author')).resolves.toMatchObject({
      roles: ['content-staff'],
    })
    records.delete(staff)
    await expect(service.requireCapability(staff, 'content.combat.author')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })
  it('reason_free_attribution: selected-character assignments need no fabricated reason or account grant', async () => {
    const { service, input, saved } = fixture()
    await expect(service.setCharacterAccess(input)).resolves.toBe(2)
    expect(saved()).toEqual(input)
    expect(saved()).not.toHaveProperty('reason')
    await expect(service.resolveIdentity(owner, 'Chosen')).resolves.toMatchObject({
      characters: [{ characterId: character }],
    })
  })
  it.each([0, -1, 0.5, 36501, NaN])('rejects invalid positive-day duration %s', async (days) => {
    const { service, input } = fixture()
    await expect(service.setCharacterAccess({ ...input, days })).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
  })
  it('denies delegated management, self-elevation and invented roles/capabilities', async () => {
    const { service, input, records } = fixture()
    records.set(staff, {
      userId: staff,
      roles: ['event-staff'],
      specialCapabilities: [],
      accessVersion: 1,
    })
    await expect(
      service.setCharacterAccess({ ...input, actorUserId: staff }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      service.setCharacterAccess({ ...input, targetUserId: owner }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      service.setCharacterAccess({ ...input, roles: ['game-owner' as never] }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
    await expect(
      service.setCharacterAccess({ ...input, specialCapabilities: ['staff.manage' as never] }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  })
})
