import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  createMasterPanelStaffAccessService,
  createMasterPanelRoleDefaultsService,
  effectiveMasterPanelCapabilities,
  MASTER_PANEL_SPECIAL_CAPABILITIES,
  type MasterPanelAccessRecord,
  type MasterPanelRoleDefaults,
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

it('only the protected Owner can read and CAS-save validated role defaults', async () => {
  const { service, records } = fixture()
  let defaults: MasterPanelRoleDefaults = {
    revision: 1,
    roles: {
      moderator: ['master.access'],
      'content-staff': ['master.access', 'content.combat.author'],
      'event-staff': ['master.access', 'events.author', 'events.operate'],
    },
  }
  const defaultsService = createMasterPanelRoleDefaultsService(service, {
    readRoleDefaults: async () => defaults,
    saveRoleDefaults: async (input) => {
      if (input.expectedRevision !== defaults.revision)
        throw Object.assign(new Error('stale'), { code: 'STALE_VERSION' })
      defaults = {
        revision: defaults.revision + 1,
        roles: input.roles as MasterPanelRoleDefaults['roles'],
      }
      return defaults
    },
  })
  expect(await defaultsService.readRoleDefaults(owner)).toMatchObject({ revision: 1 })
  const roles = { ...defaults.roles, moderator: ['master.access', 'content.combat.author'] }
  expect(
    await defaultsService.saveRoleDefaults({ actorUserId: owner, expectedRevision: 1, roles }),
  ).toMatchObject({ revision: 2 })
  await expect(
    defaultsService.saveRoleDefaults({ actorUserId: owner, expectedRevision: 1, roles }),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  records.set(staff, {
    userId: staff,
    roles: ['moderator'],
    specialCapabilities: [],
    accessVersion: 1,
    effectiveCapabilities: ['master.access', 'staff.manage'],
  })
  await expect(defaultsService.readRoleDefaults(staff)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(
    defaultsService.saveRoleDefaults({ actorUserId: staff, expectedRevision: 2, roles }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(defaultsService.readRoleDefaults('no-selection')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  for (const invalid of [
    ['staff.manage'],
    ['invented'],
    ['events.author', 'events.author'],
    [null],
  ]) {
    await expect(
      defaultsService.saveRoleDefaults({
        actorUserId: owner,
        expectedRevision: 2,
        roles: { ...roles, moderator: invalid },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
  }
  expect(await service.requireCapability(owner, 'staff.manage')).toMatchObject({
    roles: ['game-owner'],
  })
})
it('uses current authoritative capabilities instead of the built-in role preset on every action', async () => {
  const { service, records } = fixture()
  records.set(staff, {
    userId: staff,
    roles: ['content-staff'],
    specialCapabilities: [],
    accessVersion: 1,
    effectiveCapabilities: ['master.access'],
  })
  await expect(service.requireCapability(staff, 'content.combat.author')).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  records.set(staff, {
    ...records.get(staff)!,
    effectiveCapabilities: ['master.access', 'content.combat.author'],
  })
  await expect(service.requireCapability(staff, 'content.combat.author')).resolves.toMatchObject({
    roles: ['content-staff'],
  })
  await expect(service.listStaff(staff)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
