import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { RpcMasterPanelStaffAccessStore } from './supabase-staff-access-store'
const staff = '22222222-2222-4222-8222-222222222222'
it('parses only canonical authoritative live access', async () => {
  const store = new RpcMasterPanelStaffAccessStore(async () => ({
    data: [
      {
        user_id: staff,
        access_version: '2',
        roles: ['content-staff'],
        special_capabilities: [],
        effective_capabilities: ['master.access'],
      },
    ],
    error: null,
  }))
  expect(await store.readAccess(staff)).toEqual({
    userId: staff,
    accessVersion: 2,
    roles: ['content-staff'],
    specialCapabilities: [],
    effectiveCapabilities: ['master.access'],
  })
  const invalid = new RpcMasterPanelStaffAccessStore(async () => ({
    data: [
      { user_id: staff, access_version: 2, roles: ['administrator'], special_capabilities: [] },
    ],
    error: null,
  }))
  await expect(invalid.readAccess(staff)).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
})
it('round-trips verified discovery and character directory records', async () => {
  const identity = {
    userId: staff,
    email: 'verified@example.com',
    characters: [{ characterId: 'chosen', name: 'Chosen', playable: true }],
  }
  const row = {
    userId: staff,
    email: identity.email,
    characterId: 'chosen',
    characterName: 'Chosen',
    accessVersion: 2,
    roles: ['event-staff'],
    specialCapabilities: [],
    status: 'active',
    expiresAt: null,
  }
  const store = new RpcMasterPanelStaffAccessStore(async (name) => ({
    data: name === 'resolve_master_panel_account_v2' ? identity : [row],
    error: null,
  }))
  expect(await store.resolveIdentity('owner', 'Chosen')).toEqual(identity)
  expect(await store.listStaff('owner')).toEqual([row])
})
it('maps authoritative denial, stale CAS and malformed identity records safely', async () => {
  for (const [code, expected] of [
    ['42501', 'FORBIDDEN'],
    ['40001', 'STALE_VERSION'],
    ['22023', 'INVALID_REQUEST'],
  ]) {
    const store = new RpcMasterPanelStaffAccessStore(async () => ({ data: null, error: { code } }))
    await expect(store.resolveIdentity('owner', 'Chosen')).rejects.toMatchObject({ code: expected })
  }
  const store = new RpcMasterPanelStaffAccessStore(async () => ({
    data: {
      userId: staff,
      email: 'verified@example.com',
      characters: [{ characterId: 'chosen', name: 'Chosen', playable: 'yes' }],
    },
    error: null,
  }))
  await expect(store.resolveIdentity('owner', 'Chosen')).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})

it('reads and saves authoritative role defaults through Owner-only revision RPCs', async () => {
  const defaults = {
    revision: 3,
    roles: { moderator: ['master.access'], 'content-staff': [], 'event-staff': ['events.author'] },
  }
  const rpc = vi.fn(async () => ({ data: defaults, error: null }))
  const store = new RpcMasterPanelStaffAccessStore(rpc)
  expect(await store.readRoleDefaults('owner')).toEqual(defaults)
  expect(rpc).toHaveBeenLastCalledWith('read_master_panel_role_defaults_v1', {
    p_actor_user_id: 'owner',
  })
  expect(
    await store.saveRoleDefaults({
      actorUserId: 'owner',
      expectedRevision: 2,
      roles: defaults.roles,
    }),
  ).toEqual(defaults)
  expect(rpc).toHaveBeenLastCalledWith('save_master_panel_role_defaults_v1', {
    p_actor_user_id: 'owner',
    p_expected_revision: 2,
    p_roles: defaults.roles,
  })
  const invalid = new RpcMasterPanelStaffAccessStore(async () => ({
    data: { ...defaults, roles: { ...defaults.roles, moderator: ['staff.manage'] } },
    error: null,
  }))
  await expect(invalid.readRoleDefaults('owner')).rejects.toMatchObject({
    code: 'PERSISTENCE_UNAVAILABLE',
  })
})
it('rejects missing or noncanonical authoritative capability snapshots', async () => {
  for (const effective of [
    undefined,
    ['staff.manage'],
    ['invented'],
    ['master.access', 'master.access'],
  ]) {
    const store = new RpcMasterPanelStaffAccessStore(async () => ({
      data: [
        {
          user_id: staff,
          access_version: 2,
          roles: ['moderator'],
          special_capabilities: [],
          effective_capabilities: effective,
        },
      ],
      error: null,
    }))
    await expect(store.readAccess(staff)).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  }
})
