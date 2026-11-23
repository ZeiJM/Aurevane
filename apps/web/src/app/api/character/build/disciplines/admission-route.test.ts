import { beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'account' }),
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({
    id: 'character',
    level: 1,
    attributes: { might: 8, finesse: 5, vitality: 8, agility: 5, intellect: 4, resolve: 6 },
  }),
}))
import { PUT } from './route'

const core = { might: 7, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 }
const current = {
  character_id: 'character',
  schema_version: 4,
  build_version: 7,
  primary_discipline_id: 'vanguard',
  primary_definition_version: 1,
  primary_profile_version: 1,
  primary_name: 'Vanguard',
  primary_summary: 'Armed tradition.',
  primary_enabled_for_primary: true,
  primary_enabled_for_secondary: true,
  primary_stat_offsets: {},
  core_base_attributes: core,
  focus_attributes: ['might', 'vitality', 'resolve'],
  off_focus_cap: 40,
  secondary_discipline_id: null,
  secondary_definition_version: null,
  secondary_name: null,
  secondary_summary: null,
  secondary_enabled_for_primary: null,
  secondary_enabled_for_secondary: null,
  attunement_policy_version: 1,
  primary_cooldown_seconds: 0,
  secondary_cooldown_seconds: 0,
  primary_attunement_locked_until: null,
  secondary_attunement_locked_until: null,
  support_action_id: 'basic.guard',
  server_now: '2026-10-22T00:00:00Z',
  updated_at: '2026-10-22T00:00:00Z',
}
let mutationError = { code: '40001', message: 'COMBAT_CONTENT_ADMISSION_RETRY' }
let mutationAttempts = 0
beforeEach(() => {
  rpc.mockReset()
  mutationAttempts = 0
  rpc.mockImplementation(async (name: string) => {
    if (name === 'change_character_disciplines_v3') {
      mutationAttempts++
      return { data: null, error: mutationError }
    }
    if (name === 'get_character_active_build_v4') return { data: current, error: null }
    if (name === 'get_character_discipline_catalog_v3')
      return {
        data: ['vanguard', 'aetherist'].map((discipline_id) => ({
          discipline_id,
          definition_version: 1,
          profile_version: 1,
          name: discipline_id,
          summary: 'Current Discipline.',
          enabled_for_primary: true,
          enabled_for_secondary: true,
          stat_offsets: {},
          mastered_at: '2026-10-20T00:00:00Z',
          core_base_attributes: core,
          focus_attributes: ['might', 'vitality', 'resolve'],
          off_focus_cap: 40,
        })),
        error: null,
      }
    if (
      name === 'get_character_learned_skills_v2' ||
      name === 'get_character_discipline_skill_loadout_v2'
    )
      return { data: [], error: null }
    if (name === 'read_combat_content_catalogue_token_v1')
      return { data: 'a'.repeat(32), error: null }
    if (name === 'read_combat_content_catalogue_v1')
      return {
        data: {
          token: 'a'.repeat(32),
          policy: { version: 1, modes: {} },
          publications: [],
          archivedKeys: [],
        },
        error: null,
      }
    if (name === 'read_current_discipline_selection_v1')
      return {
        data: {
          selectionVersion: 1,
          catalogueToken: 'a'.repeat(32),
          essence: null,
          resonance: null,
        },
        error: null,
      }
    throw new Error(`Unexpected RPC ${name}`)
  })
})
it.each([
  ['40001', 'COMBAT_CONTENT_ADMISSION_RETRY', 409, 'STALE_VERSION', /content is changing.*retry/i],
  ['22023', 'COMBAT_CONTENT_ARCHIVED', 400, 'INVALID_REQUEST', /archived.*new build/i],
  ['22023', 'PRIMARY_DISCIPLINE_UNAVAILABLE', 400, 'INVALID_REQUEST', /build change is not legal/i],
  [
    '22023',
    'SECONDARY_DISCIPLINE_UNAVAILABLE',
    400,
    'INVALID_REQUEST',
    /build change is not legal/i,
  ],
  ['40001', 'CHARACTER_BUILD_VERSION_CONFLICT', 409, 'STALE_VERSION', /build changed/i],
  ['22023', 'CHARACTER_BUILD_IDEMPOTENCY_CONFLICT', 409, 'IDEMPOTENCY_CONFLICT', /request key/i],
  ['22023', 'PRIMARY_ATTUNEMENT_LOCKED', 409, 'BUILD_ATTUNEMENT_COOLDOWN', /still locked/i],
  ['22023', 'SECONDARY_ATTUNEMENT_LOCKED', 409, 'BUILD_ATTUNEMENT_COOLDOWN', /still locked/i],
  ['22023', 'PRIMARY_DISCIPLINE_MASTERY_REQUIRED', 400, 'INVALID_REQUEST', /Mastery prerequisites/],
  ['22023', 'CHARACTER_CORE_CONVERSION_REQUIRED', 400, 'INVALID_REQUEST', /Redistribute.*Core/],
  [
    '22023',
    'PRIMARY_CORE_ALLOCATION_REQUIRES_REDISTRIBUTION',
    400,
    'INVALID_REQUEST',
    /personal Core Stat investment/,
  ],
  ['XX000', 'SECRET DATABASE FAILURE', 503, 'PERSISTENCE_UNAVAILABLE', /unavailable right now/],
] as const)(
  'real PUT/service/v3 adapter maps %s %s',
  async (code, message, status, expectedCode, expectedMessage) => {
    mutationError = { code, message }
    const response = await PUT(
      new Request('https://aurevane.test/api/character/build/disciplines', {
        method: 'PUT',
        body: JSON.stringify({
          expectedCharacterId: 'character',
          expectedBuildVersion: 7,
          primaryDisciplineId: 'aetherist',
          secondaryDisciplineId: null,
          idempotencyKey: '00000000-0000-4000-8000-000000000099',
        }),
      }),
    )
    expect(mutationAttempts).toBe(1)
    expect(response.status).toBe(status)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    const body = await response.json()
    expect(body).toMatchObject({
      error: { code: expectedCode, message: expect.stringMatching(expectedMessage) },
    })
    expect(JSON.stringify(body)).not.toContain(message)
  },
)
