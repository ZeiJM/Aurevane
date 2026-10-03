import { describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))

import { createSupabaseCharacterBuildRepository } from './supabase-character-build-repository'

const command = {
  userId: '00000000-0000-4000-8000-000000000801',
  characterId: '00000000-0000-4000-8000-000000000802',
  expectedBuildVersion: 4,
  supportActionId: 'basic.recover.mp' as const,
  idempotencyKey: '00000000-0000-4000-8000-000000000803',
  requestFingerprint: 'sha256:support-command',
}

describe('Support Action database boundary', () => {
  it.each([
    ['CHARACTER_BUILD_VERSION_CONFLICT', 'STALE_VERSION'],
    ['CHARACTER_SUPPORT_ACTION_IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_CONFLICT'],
    ['CHARACTER_BUILD_NOT_FOUND', 'PERSISTENCE_UNAVAILABLE'],
  ])('translates %s without returning a successful save', async (message, code) => {
    rpc.mockResolvedValueOnce({ data: null, error: { message, code: 'P0001' } })
    await expect(
      createSupabaseCharacterBuildRepository().saveSupportAction(command),
    ).rejects.toMatchObject({ code })
  })
  it('passes identity, version, exact selection and receipt to the atomic RPC', async () => {
    rpc.mockResolvedValueOnce({ data: [{ build_version: 5, replayed: false }], error: null })
    expect(await createSupabaseCharacterBuildRepository().saveSupportAction(command)).toEqual({
      buildVersion: 5,
      replayed: false,
    })
    expect(rpc).toHaveBeenLastCalledWith('save_character_support_action_v1', {
      p_user_id: command.userId,
      p_character_id: command.characterId,
      p_expected_build_version: 4,
      p_support_action_id: 'basic.recover.mp',
      p_idempotency_key: command.idempotencyKey,
      p_request_fingerprint: command.requestFingerprint,
    })
  })
})
