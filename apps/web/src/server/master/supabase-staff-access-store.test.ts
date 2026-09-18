import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { RpcMasterPanelStaffAccessStore } from './supabase-staff-access-store'

const OWNER = '11111111-1111-4111-8111-111111111111'
const STAFF = '22222222-2222-4222-8222-222222222222'

function rpcResult(data: unknown, error: { code?: string; message?: string } | null = null) {
  return Promise.resolve({ data, error })
}

describe('RpcMasterPanelStaffAccessStore', () => {
  it('reads a multi-role access record and normalizes bigint versions', async () => {
    const rpc = vi.fn(() =>
      rpcResult([
        {
          user_id: STAFF,
          access_version: '7',
          roles: ['content-staff', 'event-staff'],
        },
      ]),
    )
    const store = new RpcMasterPanelStaffAccessStore(rpc)

    await expect(store.readAccess(STAFF)).resolves.toEqual({
      userId: STAFF,
      accessVersion: 7,
      roles: ['content-staff', 'event-staff'],
    })
    expect(rpc).toHaveBeenCalledWith('read_master_panel_access_v1', { p_user_id: STAFF })
  })

  it('fails closed on unknown role data', async () => {
    const rpc = vi.fn(() =>
      rpcResult([
        {
          user_id: STAFF,
          access_version: 1,
          roles: ['super-admin'],
        },
      ]),
    )

    await expect(new RpcMasterPanelStaffAccessStore(rpc).readAccess(STAFF)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('routes Owner grant and revoke commands through actor-bound RPCs', async () => {
    const rpc = vi.fn((name: string) => rpcResult(name.startsWith('grant_') ? '2' : 3))
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
        note: null,
      }),
    ).resolves.toBe(3)

    expect(rpc).toHaveBeenNthCalledWith(1, 'grant_master_panel_role_v1', {
      p_actor_user_id: OWNER,
      p_target_user_id: STAFF,
      p_role: 'content-staff',
      p_note: 'Combat content',
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'revoke_master_panel_role_v1', {
      p_actor_user_id: OWNER,
      p_target_user_id: STAFF,
      p_role: 'content-staff',
      p_note: null,
    })
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
        note: null,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
