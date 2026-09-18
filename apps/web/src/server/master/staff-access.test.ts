import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AurevaneError } from '@aurevane/game-core/errors'

import {
  MASTER_PANEL_SPECIAL_CAPABILITIES,
  createMasterPanelStaffAccessService,
  effectiveMasterPanelCapabilities,
  type DelegatedMasterPanelRole,
  type MasterPanelAccessRecord,
  type MasterPanelAccountReference,
  type MasterPanelSpecialCapability,
  type MasterPanelStaffAccessStore,
  type MasterPanelStaffSummary,
} from './staff-access'

const OWNER = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'
const OUTSIDER = '33333333-3333-4333-8333-333333333333'

class MemoryStaffAccessStore implements MasterPanelStaffAccessStore {
  readonly access = new Map<string, MasterPanelAccessRecord>()
  readonly mutations: string[] = []
  readonly staff: MasterPanelStaffSummary[] = []
  readonly accounts = new Map<string, MasterPanelAccountReference>()

  async readAccess(userId: string): Promise<MasterPanelAccessRecord | null> {
    return this.access.get(userId) ?? null
  }

  async listStaff(): Promise<readonly MasterPanelStaffSummary[]> {
    return this.staff
  }

  async resolveAccountByEmail(
    _actorUserId: string,
    email: string,
  ): Promise<MasterPanelAccountReference | null> {
    return this.accounts.get(email) ?? null
  }

  async grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string
  }): Promise<number> {
    this.mutations.push(`grant-role:${input.actorUserId}:${input.targetUserId}:${input.role}`)
    return 2
  }

  async revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string
  }): Promise<number> {
    this.mutations.push(`revoke-role:${input.actorUserId}:${input.targetUserId}:${input.role}`)
    return 3
  }

  async grantCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    note: string
  }): Promise<number> {
    this.mutations.push(
      `grant-capability:${input.actorUserId}:${input.targetUserId}:${input.capability}`,
    )
    return 4
  }

  async revokeCapability(input: {
    actorUserId: string
    targetUserId: string
    capability: MasterPanelSpecialCapability
    note: string
  }): Promise<number> {
    this.mutations.push(
      `revoke-capability:${input.actorUserId}:${input.targetUserId}:${input.capability}`,
    )
    return 5
  }
}

function access(
  userId: string,
  roles: MasterPanelAccessRecord['roles'],
  specialCapabilities: MasterPanelAccessRecord['specialCapabilities'] = [],
): MasterPanelAccessRecord {
  return { userId, accessVersion: 1, roles, specialCapabilities }
}

describe('Master Panel staff access', () => {
  it('derives role permissions and lets the Game Owner inherit every registered capability', () => {
    expect(effectiveMasterPanelCapabilities(['game-owner'])).toEqual([
      'master.access',
      'staff.manage',
      'content.combat.author',
      ...MASTER_PANEL_SPECIAL_CAPABILITIES,
    ])
    expect(effectiveMasterPanelCapabilities(['content-staff'])).toEqual([
      'master.access',
      'content.combat.author',
    ])
    expect(effectiveMasterPanelCapabilities(['moderator', 'event-staff'])).toEqual([
      'master.access',
    ])
  })

  it('unions explicit special capabilities without creating another role', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(
      STAFF,
      access(STAFF, ['moderator'], ['events.global_scope', 'events.emergency_stop']),
    )

    const service = createMasterPanelStaffAccessService(store)
    const effective = await service.requireCapability(STAFF, 'events.emergency_stop')

    expect(effective.roles).toEqual(['moderator'])
    expect(effective.specialCapabilities).toEqual(['events.global_scope', 'events.emergency_stop'])
    expect(effective.effectiveCapabilities).toEqual([
      'master.access',
      'events.global_scope',
      'events.emergency_stop',
    ])
  })

  it('fails closed for accounts without Master Panel authority', async () => {
    const service = createMasterPanelStaffAccessService(new MemoryStaffAccessStore())

    await expect(service.requireCapability(OUTSIDER, 'master.access')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('allows only the Game Owner to list staff and resolve an exact account email', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(OWNER, access(OWNER, ['game-owner']))
    store.accounts.set('staff@example.com', { userId: STAFF, email: 'staff@example.com' })
    store.staff.push({
      ...access(STAFF, ['content-staff']),
      email: 'staff@example.com',
    })
    const service = createMasterPanelStaffAccessService(store)

    await expect(service.listStaff(OWNER)).resolves.toHaveLength(1)
    await expect(service.resolveAccountByEmail(OWNER, 'staff@example.com')).resolves.toEqual({
      userId: STAFF,
      email: 'staff@example.com',
    })
    await expect(service.resolveAccountByEmail(OWNER, 'not-an-email')).rejects.toMatchObject({
      code: 'INVALID_REQUEST',
    })
  })

  it('requires a reason for delegated role mutations', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(OWNER, access(OWNER, ['game-owner']))
    const service = createMasterPanelStaffAccessService(store)

    await expect(
      service.grantRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'content-staff',
        reason: 'Combat authoring',
      }),
    ).resolves.toBe(2)
    await expect(
      service.revokeRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'content-staff',
        reason: 'Role rotation',
      }),
    ).resolves.toBe(3)
    await expect(
      service.grantRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'event-staff',
        reason: '',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    expect(store.mutations).toEqual([
      `grant-role:${OWNER}:${STAFF}:content-staff`,
      `revoke-role:${OWNER}:${STAFF}:content-staff`,
    ])
  })

  it('grants and revokes only approved special capabilities', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(OWNER, access(OWNER, ['game-owner']))
    const service = createMasterPanelStaffAccessService(store)

    await expect(
      service.grantCapability({
        actorUserId: OWNER,
        targetUserId: STAFF,
        capability: 'events.global_scope',
        reason: 'Global event operations',
      }),
    ).resolves.toBe(4)
    await expect(
      service.revokeCapability({
        actorUserId: OWNER,
        targetUserId: STAFF,
        capability: 'events.global_scope',
        reason: 'Scope no longer required',
      }),
    ).resolves.toBe(5)

    await expect(
      service.grantCapability({
        actorUserId: OWNER,
        targetUserId: STAFF,
        capability: 'staff.manage' as MasterPanelSpecialCapability,
        reason: 'Should fail',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })

    expect(store.mutations).toEqual([
      `grant-capability:${OWNER}:${STAFF}:events.global_scope`,
      `revoke-capability:${OWNER}:${STAFF}:events.global_scope`,
    ])
  })

  it('blocks delegated staff management and all Owner self-grants', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(STAFF, access(STAFF, ['content-staff']))
    store.access.set(OWNER, access(OWNER, ['game-owner']))
    const service = createMasterPanelStaffAccessService(store)

    await expect(
      service.grantRole({
        actorUserId: STAFF,
        targetUserId: OUTSIDER,
        role: 'event-staff',
        reason: 'Escalation attempt',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await expect(
      service.grantCapability({
        actorUserId: OWNER,
        targetUserId: OWNER,
        capability: 'events.global_scope',
        reason: 'Owner already has root power',
      }),
    ).rejects.toBeInstanceOf(AurevaneError)

    expect(store.mutations).toEqual([])
  })
})
