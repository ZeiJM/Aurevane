import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { RpcMasterPanelStaffAccessStore } from './supabase-staff-access-store'
const row = {
  user_id: 'staff',
  character_id: 'first',
  access_version: 2,
  roles: ['content-staff'],
  special_capabilities: [],
}
const result = (data: unknown) => Promise.resolve({ data, error: null })
it('parses selected-character authority and rejects malformed current authority', async () => {
  const rpc = vi.fn(() => result([row]))
  const store = new RpcMasterPanelStaffAccessStore(rpc)
  expect(await store.readAccess('staff')).toEqual({
    userId: 'staff',
    characterId: 'first',
    accessVersion: 2,
    roles: ['content-staff'],
    specialCapabilities: [],
  })
  await expect(
    new RpcMasterPanelStaffAccessStore(() => result([{ ...row, character_id: null }])).readAccess(
      'staff',
    ),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  await expect(
    new RpcMasterPanelStaffAccessStore(() =>
      result([{ ...row, roles: ['administrator'] }]),
    ).readAccess('staff'),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
})
it('returns authorized per-character directory status and linked identity details', async () => {
  const rpc = vi.fn(() =>
    result([
      {
        ...row,
        character_name: 'First',
        email: 'staff@example.test',
        status: 'expired',
        expires_at: '2026-10-20T12:00:00Z',
      },
    ]),
  )
  expect(await new RpcMasterPanelStaffAccessStore(rpc).listStaff('owner')).toMatchObject([
    {
      characterId: 'first',
      characterName: 'First',
      status: 'expired',
      expiresAt: '2026-10-20T12:00:00Z',
    },
  ])
})
it('validates the verified identity and all linked characters lookup shape', async () => {
  const accounts = [
    {
      user_id: 'staff',
      email: 'staff@example.test',
      characters: [
        { id: 'first', name: 'First', playable: true },
        { id: 'alternate', name: 'Alternate', playable: false },
      ],
    },
  ]
  const rpc = vi.fn(() => result(accounts))
  expect(await new RpcMasterPanelStaffAccessStore(rpc).resolveAccounts('owner', 'First')).toEqual([
    { userId: 'staff', email: 'staff@example.test', characters: accounts[0]!.characters },
  ])
  expect(rpc).toHaveBeenCalledWith('resolve_master_panel_accounts_v2', {
    p_actor_user_id: 'owner',
    p_query: 'First',
  })
})
it('routes atomic assignment/revoke with explicit character, duration, binding and CAS, without reasons', async () => {
  const rpc = vi.fn(() => result(3))
  const store = new RpcMasterPanelStaffAccessStore(rpc)
  await store.setCharacterAccess({
    actorUserId: 'owner',
    targetCharacterId: 'first',
    roles: ['content-staff'],
    specialCapabilities: [],
    days: 2,
    bindLegacy: true,
    expectedAccessVersion: 2,
  })
  expect(rpc).toHaveBeenLastCalledWith('set_master_panel_character_access_v2', {
    p_actor_user_id: 'owner',
    p_target_character_id: 'first',
    p_roles: ['content-staff'],
    p_capabilities: [],
    p_days: 2,
    p_bind_legacy: true,
    p_expected_access_version: 2,
  })
  await store.revokeCharacterAccess({
    actorUserId: 'owner',
    targetCharacterId: 'first',
    expectedAccessVersion: 3,
  })
  expect(rpc).toHaveBeenLastCalledWith('revoke_master_panel_character_access_v2', {
    p_actor_user_id: 'owner',
    p_target_character_id: 'first',
    p_expected_access_version: 3,
  })
})
it('maps live denial and stale assignment conflicts safely', async () => {
  await expect(
    new RpcMasterPanelStaffAccessStore(() =>
      Promise.resolve({ data: null, error: { code: '42501' } }),
    ).readAccess('staff'),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(
    new RpcMasterPanelStaffAccessStore(() =>
      Promise.resolve({ data: null, error: { code: '40001' } }),
    ).readAccess('staff'),
  ).rejects.toMatchObject({ code: 'STALE_VERSION' })
})
