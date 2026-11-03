import { beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { createSupabaseCharacterSavedBuildLoadoutRepository } from './supabase-character-saved-build-loadout-repository'
const reference = {
  skillId: 'lifebinder.mending-light',
  contentVersion: 1,
  sourceDisciplineId: 'lifebinder',
  eligibilityDisciplineId: 'vanguard',
}
const row = {
  slot_index: 1,
  name: 'Shared',
  primary_discipline_id: 'vanguard',
  secondary_discipline_id: null,
  source_build_version: 1,
  support_action_id: 'basic.recover',
  discipline_skills: [reference],
  saved_at: '2026-10-20T00:00:00Z',
  updated_at: '2026-10-20T00:00:00Z',
}
beforeEach(() => rpc.mockReset())
it('named read preserves explicit selected eligibility and old omission without rewriting either', async () => {
  rpc.mockResolvedValue({ data: [row], error: null })
  const repository = createSupabaseCharacterSavedBuildLoadoutRepository()
  expect((await repository.list('user', 'character'))[0]?.disciplineSkills).toEqual([reference])
  const historical = {
    skillId: reference.skillId,
    contentVersion: 1,
    sourceDisciplineId: reference.sourceDisciplineId,
  }
  rpc.mockResolvedValue({ data: [{ ...row, discipline_skills: [historical] }], error: null })
  expect((await repository.list('user', 'character'))[0]?.disciplineSkills).toEqual([historical])
})
it.each([null, 42, ' vanguard', 'vanguard\n'])(
  'named read rejects present malformed eligibility %j',
  async (value) => {
    rpc.mockResolvedValue({
      data: [{ ...row, discipline_skills: [{ ...reference, eligibilityDisciplineId: value }] }],
      error: null,
    })
    await expect(
      createSupabaseCharacterSavedBuildLoadoutRepository().list('user', 'character'),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  },
)
it.each([
  ['40001', 'ITEM_CATALOGUE_RETRY', 'STALE_VERSION'],
  ['40001', 'ITEM_ADMISSION_RETRY', 'STALE_VERSION'],
  ['22023', 'ITEM_BATTLE_ACTIVE', 'INVALID_REQUEST'],
  ['22023', 'ITEM_DELETION_PENDING', 'INVALID_REQUEST'],
])('surfaces activation Item lock result %s %s as %s', async (code, message, expected) => {
  rpc.mockResolvedValue({ data: null, error: { code, message } })
  await expect(
    createSupabaseCharacterSavedBuildLoadoutRepository().activate({
      userId: 'user',
      characterId: 'character',
      slotIndex: 1,
      expectedBuildVersion: 1,
      idempotencyKey: 'request',
      requestFingerprint: 'fingerprint',
    }),
  ).rejects.toMatchObject({ code: expected })
})
