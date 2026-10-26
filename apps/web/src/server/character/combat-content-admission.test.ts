import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: () => ({ rpc }) }))
vi.mock('../master/selected-character-rpc', () => ({
  createSelectedCharacterRpc: (call: unknown) => call,
}))
vi.mock('../master/staff-access-server', () => ({
  createServerMasterPanelStaffAccessService: () => ({ requireCapability: async () => {} }),
}))
import { createCharacterInSlot } from './character-slot-service'
import { createSupabaseCharacterAttributeRepository } from './supabase-character-attribute-repository'
import { createSupabaseCharacterRepository } from './supabase-character-repository'
import { createSupabaseCharacterBuildRepository } from './supabase-character-build-repository'
import { createSupabaseCharacterSavedBuildLoadoutRepository } from './supabase-character-saved-build-loadout-repository'
import { claimDisciplineTrial } from './discipline-mastery-service'
import { preparePv2BuildcraftTestKit } from './pv2-buildcraft-test-kit'
import { createServerMasterPlayersService } from '../master/players-server'
import { toServerErrorResponse } from '../http/error-response'
import { buildInitialCharacterState } from '@aurevane/game-core/character/creation'
const intent = {
  name: 'Arlen Vale',
  presentationId: 'androgynous',
  pronounPresetId: 'they_them',
  portraitRef: 'portrait.starter.wayfarer-01',
  starterAppearanceRef: 'appearance.starter.traveler-01',
  attributeBonuses: { might: 1, finesse: 1, vitality: 1, agility: 1, intellect: 1, resolve: 0 },
  foundationDisciplineId: 'vanguard',
}
const base = {
  userId: 'user',
  characterId: 'character',
  idempotencyKey: 'request',
  requestFingerprint: 'fingerprint',
  expectedBuildVersion: 1,
}
const calls: [string, () => Promise<unknown>][] = [
  [
    'slot creation',
    () =>
      createCharacterInSlot({
        actor: { userId: 'user' },
        slotIndex: 0,
        idempotencyKey: 'request',
        intent,
      }),
  ],
  [
    'base creation',
    () => {
      const seed = buildInitialCharacterState(intent)
      return createSupabaseCharacterRepository().createBaseCharacter({
        ...base,
        ...seed,
        ...seed.attributes,
        actorKey: base.userId,
        commandName: 'character.create',
      })
    },
  ],
  [
    'Discipline change',
    () =>
      createSupabaseCharacterBuildRepository().changeDisciplines({
        ...base,
        changePrimary: true,
        primaryDisciplineId: 'vanguard',
        changeSecondary: false,
        secondaryDisciplineId: null,
      }),
  ],
  [
    'Skill loadout',
    () => createSupabaseCharacterBuildRepository().saveDisciplineSkills({ ...base, skills: [] }),
  ],
  [
    'saved loadout save',
    () =>
      createSupabaseCharacterSavedBuildLoadoutRepository().save({
        ...base,
        slotIndex: 1,
        name: 'Test',
      }),
  ],
  [
    'saved loadout activation',
    () => createSupabaseCharacterSavedBuildLoadoutRepository().activate({ ...base, slotIndex: 1 }),
  ],
  [
    'Core allocation',
    () =>
      createSupabaseCharacterAttributeRepository().commitAllocation({
        ...base,
        mode: 'spend',
        attributes: { might: 12, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
      }),
  ],
  ['trial claim', () => claimDisciplineTrial('user', 'battle')],
  ['test kit grants', () => preparePv2BuildcraftTestKit('user', 'character')],
  [
    'Players correction',
    () =>
      createServerMasterPlayersService().edit('user', 'character', 'a'.repeat(64), 'request', {
        kind: 'skills',
        skills: [],
      }),
  ],
]
beforeEach(() => {
  vi.stubEnv('AUREVANE_PV2_TEST_MODE', '1')
  rpc.mockReset()
})
afterEach(() => vi.unstubAllEnvs())
it.each(calls)('%s maps catalogue admission contention to actual HTTP409', async (_name, call) => {
  rpc.mockImplementation(async (name: string) =>
    name === 'get_character_active_build_v2'
      ? { data: [{}], error: null }
      : name === 'get_character_learned_skills_v1'
        ? { data: [], error: null }
        : { data: null, error: { code: '40001', message: 'COMBAT_CONTENT_ADMISSION_RETRY' } },
  )
  const error = await call().catch((e: unknown) => e)
  expect(error).toMatchObject({ code: 'STALE_VERSION' })
  expect(toServerErrorResponse(error).status).toBe(409)
})
it.each(calls)(
  '%s names archived content rather than misclassifying idempotency/persistence',
  async (_name, call) => {
    rpc.mockImplementation(async (name: string) =>
      name === 'get_character_active_build_v2'
        ? { data: [{}], error: null }
        : name === 'get_character_learned_skills_v1'
          ? { data: [], error: null }
          : { data: null, error: { code: '22023', message: 'COMBAT_CONTENT_ARCHIVED' } },
    )
    const error = await call().catch((e: unknown) => e)
    expect(error).toMatchObject({ code: 'INVALID_REQUEST' })
    expect(toServerErrorResponse(error).status).toBe(400)
    expect((error as Error).message).toMatch(/archived/i)
  },
)
