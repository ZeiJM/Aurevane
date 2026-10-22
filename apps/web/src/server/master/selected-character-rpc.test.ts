import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: vi.fn() }))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: vi.fn() }))
import { createSelectedCharacterRpc } from './selected-character-rpc'
it('switch_recalculates: fresh server selection replaces client actor claims on each protected call', async () => {
  let selection: string | null = 'chosen'
  const seen: Record<string, unknown>[] = []
  const rpc = createSelectedCharacterRpc(
    async (_name, parameters) => {
      seen.push(parameters)
      return { data: [], error: null }
    },
    {
      getActor: async () => ({ userId: 'verified' }),
      loadSelection: async () => (selection === null ? null : { id: selection }),
    },
  )
  await rpc('save_combat_content_draft_v1', {
    p_actor_user_id: 'verified',
    p_actor_character_id: 'forged',
  })
  selection = 'alternate'
  await rpc('read_event_operation_dashboard_v1', { p_actor_user_id: 'verified' })
  selection = null
  await rpc('read_master_panel_access_v1', { p_user_id: 'verified' })
  expect(seen.map((row) => row.p_actor_character_id)).toEqual(['chosen', 'alternate', null])
  await expect(rpc('read_master_panel_access_v1', { p_user_id: 'other' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
})
it('ordinary current/pinned gameplay reads retain their service-only path without selected Master authority', async () => {
  const getActor = vi.fn(async () => {
    throw new Error('not a master request')
  })
  const rpc = createSelectedCharacterRpc(
    async (_name, parameters) => ({ data: parameters, error: null }),
    { getActor, loadSelection: async () => null },
  )
  expect((await rpc('read_combat_content_version_v1', { p_content_key: 'historic' })).data).toEqual(
    { p_content_key: 'historic' },
  )
  expect(getActor).not.toHaveBeenCalled()
})
it.each([
  'search_master_players_v1',
  'read_master_player_v1',
  'edit_master_player_v1',
  'recover_master_player_battle_v1',
])('Players %s uses fresh trusted selected actor', async (name) => {
  const call = vi.fn(async (_name: string, parameters: Record<string, unknown>) => ({
    data: parameters,
    error: null,
  }))
  const rpc = createSelectedCharacterRpc(call, {
    getActor: async () => ({ userId: 'owner' }),
    loadSelection: async () => ({ id: 'selected' }),
  })
  await rpc(name, { p_actor_user_id: 'owner', p_actor_character_id: 'forged' })
  expect(call).toHaveBeenCalledWith(name, {
    p_actor_user_id: 'owner',
    p_actor_character_id: 'selected',
  })
})
it.each([
  'finalize_combat_content_media_v1',
  'read_combat_content_media_v1',
  'read_combat_content_record_v1',
  'list_combat_content_records_v1',
  'write_combat_content_record_v1',
  'publish_saved_combat_content_v1',
])('Content %s replaces caller actor with current trusted selection', async (name) => {
  const rpc = createSelectedCharacterRpc(async (_name, parameters) => parameters, {
    getActor: async () => ({ userId: 'owner' }),
    loadSelection: async () => ({ id: 'selected' }),
  })
  expect(
    await rpc(name, { p_actor_user_id: 'owner', p_actor_character_id: 'forged' }),
  ).toMatchObject({ p_actor_character_id: 'selected' })
})
