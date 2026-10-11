import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))

import { findPlayableOwnedCharacterById, loadCharacterSlots } from './character-slot-service'

const userId = '00000000-0000-4000-8000-000000000901'
const characterId = '00000000-0000-4000-8000-000000000902'

function slotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: characterId,
    user_id: userId,
    slot_index: 0,
    rules_version: 1,
    name: 'Aurelia BHJGBCBJFGHGCAEE',
    name_key: 'aurelia',
    presentation_id: 'androgynous',
    pronoun_preset_id: 'they_them',
    portrait_ref: 'portrait.starter.wayfarer-01',
    starter_appearance_ref: 'appearance.starter.roadworn',
    foundation_discipline_id: 'vanguard',
    might: 6,
    finesse: 6,
    vitality: 6,
    agility: 6,
    intellect: 6,
    resolve: 6,
    level: 2,
    xp: 0,
    progression_cycle: 1,
    created_at: '2026-10-01T00:00:00.000Z',
    cycle_started_at: '2026-10-01T00:00:00.000Z',
    last_active_at: '2026-10-01T00:00:00.000Z',
    deletion_requested_at: null,
    deletion_execute_after: null,
    reselect_available_at: '2026-10-02T01:00:00.000Z',
    ...overrides,
  }
}

function buildRow(secondary = false) {
  return {
    character_id: characterId,
    schema_version: 1,
    build_version: 8,
    primary_discipline_id: 'chronoweaver',
    primary_definition_version: 1,
    primary_profile_version: 1,
    primary_name: 'Chronoweaver',
    primary_summary: 'Time.',
    primary_enabled_for_primary: true,
    primary_enabled_for_secondary: true,
    primary_stat_offsets: {},
    secondary_discipline_id: secondary ? 'shadebinder' : null,
    secondary_definition_version: secondary ? 1 : null,
    secondary_name: secondary ? 'Shadebinder' : null,
    secondary_summary: secondary ? 'Shadow.' : null,
    secondary_enabled_for_primary: secondary ? true : null,
    secondary_enabled_for_secondary: secondary ? true : null,
    primary_attunement_locked_until: null,
    secondary_attunement_locked_until: null,
    attunement_policy_version: 1,
    primary_cooldown_seconds: 14400,
    secondary_cooldown_seconds: 14400,
    server_now: '2026-10-02T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    support_action_id: 'basic.guard',
  }
}

function responses(build: unknown, slots = [slotRow()]) {
  rpc.mockImplementation(async (name: string, args: Record<string, string>) => {
    if (args.p_user_id !== userId) throw new Error('Wrong owner')
    if (name === 'get_character_slots_v2') return { data: slots, error: null }
    if (name === 'get_character_active_build_v4' && args.p_character_id === characterId)
      return { data: build, error: null }
    throw new Error('Unexpected authority read')
  })
}

describe('roster equipped discipline projection', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it.each([
    ['pure', false],
    ['mixed', true],
  ] as const)(
    'shows a changed %s build instead of its creation discipline',
    async (_mode, mixed) => {
      responses(buildRow(mixed))
      const [character] = await loadCharacterSlots(userId)
      expect(character.disciplines).toEqual({
        primary: { id: 'chronoweaver', name: 'Chronoweaver' },
        secondary: mixed ? { id: 'shadebinder', name: 'Shadebinder' } : null,
      })
      expect(character.foundationDisciplineId).toBe('vanguard')
      expect(character.reselectAvailableAt).toBe('2026-10-02T01:00:00.000Z')
    },
  )

  it('uses server names for a discipline outside the client foundation catalog', async () => {
    responses({
      ...buildRow(),
      primary_discipline_id: 'published-owner-discipline',
      primary_name: 'Published Discipline',
    })
    const [character] = await loadCharacterSlots(userId)
    expect(character.disciplines.primary).toEqual({
      id: 'published-owner-discipline',
      name: 'Published Discipline',
    })
  })

  it('falls back to foundation only when the authority explicitly returns no build', async () => {
    responses(null)
    const [character] = await loadCharacterSlots(userId)
    expect(character.disciplines).toEqual({
      primary: { id: 'vanguard', name: 'Vanguard' },
      secondary: null,
    })
  })

  it('does not disguise a malformed equipped build as a legacy foundation build', async () => {
    responses({ ...buildRow(), primary_name: null })
    await expect(loadCharacterSlots(userId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('does not fall back when equipped-build persistence is unavailable', async () => {
    responses(buildRow())
    const respond = rpc.getMockImplementation()!
    rpc.mockImplementation(async (name, args) =>
      name === 'get_character_active_build_v4'
        ? { data: null, error: { code: '42501' } }
        : respond(name, args),
    )
    await expect(loadCharacterSlots(userId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('does not trust a build returned for another character', async () => {
    responses({ ...buildRow(), character_id: '00000000-0000-4000-8000-000000000999' })
    await expect(loadCharacterSlots(userId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
  })

  it('does not read equipped state for a foreign slot row', async () => {
    responses(buildRow(), [slotRow({ user_id: '00000000-0000-4000-8000-000000000999' })])
    await expect(loadCharacterSlots(userId)).rejects.toMatchObject({
      code: 'PERSISTENCE_UNAVAILABLE',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('keeps portrait and play authorization independent of build presentation reads', async () => {
    responses({ invalid: true })
    expect((await findPlayableOwnedCharacterById(userId, characterId))?.id).toBe(characterId)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('still rejects play during the deletion grace period', async () => {
    responses(buildRow(), [slotRow({ deletion_execute_after: '2026-10-03T00:00:00.000Z' })])
    expect(await findPlayableOwnedCharacterById(userId, characterId)).toBeNull()
  })
})
