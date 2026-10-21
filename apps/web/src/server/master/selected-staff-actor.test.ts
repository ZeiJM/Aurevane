import { beforeEach, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ userId: 'verified-user', characterId: 'first' as string | null }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: state.userId }),
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () =>
    state.characterId ? { id: state.characterId, userId: state.userId } : null,
}))
import { selectedStaffRpcParameters } from './selected-staff-actor'

beforeEach(() => {
  state.userId = 'verified-user'
  state.characterId = 'first'
})
it('derives the character afresh and overrides caller-substituted character identifiers', async () => {
  expect(
    await selectedStaffRpcParameters({
      p_actor_user_id: state.userId,
      p_actor_character_id: 'forged',
    }),
  ).toEqual({ p_actor_user_id: state.userId, p_actor_character_id: 'first' })
  state.characterId = 'alternate'
  expect(await selectedStaffRpcParameters({ p_user_id: state.userId })).toEqual({
    p_user_id: state.userId,
    p_actor_character_id: 'alternate',
  })
})
it('rejects stale or caller-substituted identities and missing playable selections', async () => {
  await expect(selectedStaffRpcParameters({ p_actor_user_id: 'other' })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  state.characterId = null
  await expect(selectedStaffRpcParameters({ p_user_id: state.userId })).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
})
