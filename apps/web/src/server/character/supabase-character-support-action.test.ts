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

it.each([
  ['ITEM_CATALOGUE_RETRY', '40001', 'STALE_VERSION'],
  ['ITEM_ADMISSION_RETRY', '40001', 'STALE_VERSION'],
  ['ITEM_CATALOGUE_RETRY', 'PT409', 'STALE_VERSION'],
  ['ITEM_ADMISSION_RETRY', 'PT409', 'STALE_VERSION'],
  ['ITEM_BATTLE_ACTIVE', '22023', 'INVALID_REQUEST'],
] as const)(
  'maps synchronized Item admission failure %s through the existing Basic support writer',
  async (message, dbCode, code) => {
    rpc.mockResolvedValueOnce({ data: null, error: { message, code: dbCode } })
    await expect(
      createSupabaseCharacterBuildRepository().saveSupportAction(command),
    ).rejects.toMatchObject({ code })
  },
)

it.each(['ITEM_ADMISSION_RETRY', 'ITEM_BATTLE_ACTIVE'])(
  'treats changed battle admission %s as stale preparation',
  async (message) => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message, code: message.endsWith('ACTIVE') ? '22023' : 'PT409' },
    })
    await expect(
      createSupabaseCharacterBuildRepository().loadBattleEquipment!(
        command.userId,
        command.characterId,
      ),
    ).rejects.toMatchObject({ code: 'STALE_VERSION' })
  },
)

describe('World battle equipment capture under contention', () => {
  const capture = {
    schemaVersion: 2,
    inventoryRevision: 8,
    selectedSupport: { kind: 'basic', actionId: command.supportActionId },
    equipment: [],
  }
  const busy = { data: null, error: { message: 'ITEM_ADMISSION_RETRY', code: 'PT409' } }

  it('captures equipment after a concurrent World read releases the account lock', async () => {
    rpc
      .mockReset()
      .mockResolvedValueOnce(busy)
      .mockResolvedValueOnce({ data: capture, error: null })
    const repository = createSupabaseCharacterBuildRepository({
      retryBattleEquipmentAdmission: true,
    })
    await expect(
      repository.loadBattleEquipment!(command.userId, command.characterId),
    ).resolves.toEqual(capture)
    expect(rpc.mock.calls).toEqual(
      Array.from({ length: 2 }, () => [
        'read_character_battle_equipment_v1',
        { p_user_id: command.userId, p_character_id: command.characterId },
      ]),
    )
  })

  it.each([
    ['ITEM_ADMISSION_RETRY', 3],
    ['ITEM_STALE_REVISION', 1],
    ['ITEM_BATTLE_ACTIVE', 1],
  ] as const)(
    'keeps the existing stale response for %s after %i attempts',
    async (message, attempts) => {
      rpc.mockReset().mockResolvedValue({ data: null, error: { message, code: 'PT409' } })
      const repository = createSupabaseCharacterBuildRepository({
        retryBattleEquipmentAdmission: true,
      })
      await expect(
        repository.loadBattleEquipment!(command.userId, command.characterId),
      ).rejects.toMatchObject({
        code: 'STALE_VERSION',
      })
      expect(rpc).toHaveBeenCalledTimes(attempts)
    },
  )
})
