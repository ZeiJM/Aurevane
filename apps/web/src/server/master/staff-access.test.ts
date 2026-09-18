import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { AurevaneError } from '@aurevane/game-core/errors'

import {
  createMasterPanelStaffAccessService,
  effectiveMasterPanelCapabilities,
  type DelegatedMasterPanelRole,
  type MasterPanelAccessRecord,
  type MasterPanelStaffAccessStore,
} from './staff-access'

const OWNER = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'
const OUTSIDER = '33333333-3333-4333-8333-333333333333'

class MemoryStaffAccessStore implements MasterPanelStaffAccessStore {
  readonly access = new Map<string, MasterPanelAccessRecord>()
  readonly mutations: string[] = []

  async readAccess(userId: string): Promise<MasterPanelAccessRecord | null> {
    return this.access.get(userId) ?? null
  }

  async grantRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string | null
  }): Promise<number> {
    this.mutations.push(`grant:${input.actorUserId}:${input.targetUserId}:${input.role}`)
    return 2
  }

  async revokeRole(input: {
    actorUserId: string
    targetUserId: string
    role: DelegatedMasterPanelRole
    note: string | null
  }): Promise<number> {
    this.mutations.push(`revoke:${input.actorUserId}:${input.targetUserId}:${input.role}`)
    return 3
  }
}

describe('Master Panel staff access', () => {
  it('derives permissions from the fixed four-role model', () => {
    expect(effectiveMasterPanelCapabilities(['game-owner'])).toEqual([
      'master.access',
      'staff.manage',
      'content.combat.author',
    ])
    expect(effectiveMasterPanelCapabilities(['content-staff'])).toEqual([
      'master.access',
      'content.combat.author',
    ])
    expect(effectiveMasterPanelCapabilities(['moderator', 'event-staff'])).toEqual([
      'master.access',
    ])
  })

  it('supports multiple roles without inventing another authority class', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(STAFF, {
      userId: STAFF,
      accessVersion: 4,
      roles: ['moderator', 'content-staff'],
    })

    const access = await createMasterPanelStaffAccessService(store).requireCapability(
      STAFF,
      'content.combat.author',
    )

    expect(access.roles).toEqual(['moderator', 'content-staff'])
    expect(access.effectiveCapabilities).toContain('content.combat.author')
  })

  it('fails closed for accounts without Master Panel authority', async () => {
    const service = createMasterPanelStaffAccessService(new MemoryStaffAccessStore())

    await expect(service.requireCapability(OUTSIDER, 'master.access')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('allows the Game Owner to grant and revoke only delegated roles', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(OWNER, {
      userId: OWNER,
      accessVersion: 1,
      roles: ['game-owner'],
    })
    const service = createMasterPanelStaffAccessService(store)

    await expect(
      service.grantRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'content-staff',
        note: 'Combat authoring',
      }),
    ).resolves.toBe(2)
    await expect(
      service.revokeRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'content-staff',
        note: 'Role rotation',
      }),
    ).resolves.toBe(3)

    expect(store.mutations).toEqual([
      `grant:${OWNER}:${STAFF}:content-staff`,
      `revoke:${OWNER}:${STAFF}:content-staff`,
    ])
  })

  it('blocks delegated staff from managing roles and blocks self-grants', async () => {
    const store = new MemoryStaffAccessStore()
    store.access.set(STAFF, {
      userId: STAFF,
      accessVersion: 1,
      roles: ['content-staff'],
    })
    store.access.set(OWNER, {
      userId: OWNER,
      accessVersion: 1,
      roles: ['game-owner'],
    })
    const service = createMasterPanelStaffAccessService(store)

    await expect(
      service.grantRole({
        actorUserId: STAFF,
        targetUserId: OUTSIDER,
        role: 'event-staff',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await expect(
      service.grantRole({
        actorUserId: OWNER,
        targetUserId: OWNER,
        role: 'event-staff',
      }),
    ).rejects.toBeInstanceOf(AurevaneError)

    expect(store.mutations).toEqual([])
  })
})
