import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { RpcMasterPanelStaffAccessStore } from './supabase-staff-access-store'

const OWNER = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'

function rpcResult(data: unknown, error: { code?: string; message?: string } | null = null) {
  return Promise.resolve({ data, error })
}

describe('RpcMasterPanelStaffAccessStore', () => {
  it('reads roles plus explicit special capabilities and normalizes bigint versions', async () => {
    const rpc = vi.fn(() =>
      rpcResult([
        {
          user_id: STAFF,
          access_version: '7',
          roles: ['content-staff', 'event-staff'],
          special_capabilities: ['events.global_scope'],
        },
      ]),
    )
    const store = new RpcMasterPanelStaffAccessStore(rpc)

    await expect(store.readAccess(STAFF)).resolves.toEqual({
      userId: STAFF,
      accessVersion: 7,
      roles: ['content-staff', 'event-staff'],
      specialCapabilities: ['events.global_scope'],
    })
  })

  it('lists current staff and resolves an exact Owner-authorized account email', async () => {
    const rpc = vi.fn((name: string) => {
      if (name === 'list_master_panel_staff_v1') {
        return rpcResult([
          {
            user_id: STAFF,
            email: 'staff@example.com',
            access_version: 3,
            roles: ['content-staff'],
            special_capabilities: ['content.story_copy'],
          },
        ])
      }
      return rpcResult([{ user_id: STAFF, email: 'staff@example.com' }])
    })
    const store = new RpcMasterPanelStaffAccessStore(rpc)

    await expect(store.listStaff(OWNER)).resolves.toEqual([
      {
        userId: STAFF,
        email: 'staff@example.com',
        accessVersion: 3,
        roles: ['content-staff'],
        specialCapabilities: ['content.story_copy'],
      },
    ])
    await expect(store.resolveAccountByEmail(OWNER, 'Staff@example.com')).resolves.toEqual({
      userId: STAFF,
      email: 'staff@example.com',
    })
  })

  it('fails closed on unknown role or capability data', async () => {
    const unknownRole = vi.fn(() =>
      rpcResult([
        {
          user_id: STAFF,
          access_version: 1,
          roles: ['super-admin'],
          special_capabilities: [],
        },
      ]),
    )
    const unknownCapability = vi.fn(() =>
      rpcResult([
        {
          user_id: STAFF,
          access_version: 1,
          roles: ['content-staff'],
          special_capabilities: ['root.everything'],
        },
      ]),
    )

    await expect(new RpcMasterPanelStaffAccessStore(unknownRole).readAccess(STAFF)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
    await expect(
      new RpcMasterPanelStaffAccessStore(unknownCapability).readAccess(STAFF),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  })

  it('routes role and special-capability mutations through actor-bound RPCs', async () => {
    const rpc = vi.fn((name: string) => {
      if (name.startsWith('grant_master_panel_role')) return rpcResult('2')
      if (name.startsWith('revoke_master_panel_role')) return rpcResult(3)
      if (name.startsWith('grant_master_panel_capability')) return rpcResult('4')
      return rpcResult(5)
    })
    const store = new RpcMasterPanelStaffAccessStore(rpc)

    await expect(
      store.grantRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'content-staff',
        note: 'Combat content',
      }),
    ).resolves.toBe(2)
    await expect(
      store.revokeRole({
        actorUserId: OWNER,
        targetUserId: STAFF,
        role: 'content-staff',
        note: 'Role rotation',
      }),
    ).resolves.toBe(3)
    await expect(
      store.grantCapability({
        actorUserId: OWNER,
        targetUserId: STAFF,
        capability: 'events.global_scope',
        note: 'Global events',
      }),
    ).resolves.toBe(4)
    await expect(
      store.revokeCapability({
        actorUserId: OWNER,
        targetUserId: STAFF,
        capability: 'events.global_scope',
        note: 'Scope removed',
      }),
    ).resolves.toBe(5)
  })

  it('maps database authorization rejection to FORBIDDEN', async () => {
    const rpc = vi.fn(() =>
      rpcResult(null, { code: '42501', message: 'MASTER_PANEL_OWNER_REQUIRED' }),
    )

    await expect(
      new RpcMasterPanelStaffAccessStore(rpc).grantRole({
        actorUserId: STAFF,
        targetUserId: OWNER,
        role: 'event-staff',
        note: 'Escalation',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
