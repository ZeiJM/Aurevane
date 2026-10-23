import { beforeEach, expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { createSupabaseCharacterBuildRepository } from './supabase-character-build-repository'

const at = '2026-10-20T00:00:00Z'
const learned = {
  skill_id: 'lifebinder.mend',
  skill_content_version: 5,
  source_discipline_id: 'lifebinder',
  eligibility_discipline_id: 'vanguard',
  learned_at: at,
  granted_at: at,
  earned_at: at,
  grant_source_kind: 'gameplay',
  grant_source_id: 'discipline-mastery:v1',
  earned_source_kind: 'gameplay',
  earned_source_id: 'discipline-mastery:v1',
}
beforeEach(() => rpc.mockReset())
it('actual learned transport reads the joined v2 authority and preserves eligibility plus earned provenance', async () => {
  rpc.mockResolvedValue({ data: [learned], error: null })
  const rows = await createSupabaseCharacterBuildRepository().listLearnedSkills('user', 'character')
  expect(rpc).toHaveBeenCalledWith('get_character_learned_skills_v2', {
    p_user_id: 'user',
    p_character_id: 'character',
  })
  expect(rows[0]).toMatchObject({
    skillId: 'lifebinder.mend',
    contentVersion: 5,
    sourceDisciplineId: 'lifebinder',
    eligibilityDisciplineId: 'vanguard',
    earnedAt: at,
    grantedAt: at,
    grantSourceKind: 'gameplay',
    grantSourceId: 'discipline-mastery:v1',
  })
})
it.each([null, 42, {}, ' vanguard', 'vanguard\n'])(
  'malformed present learned eligibility %j fails closed',
  async (value) => {
    rpc.mockResolvedValue({ data: [{ ...learned, eligibility_discipline_id: value }], error: null })
    await expect(
      createSupabaseCharacterBuildRepository().listLearnedSkills('user', 'character'),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  },
)
it('actual equipped transport retains the selected eligibility and uses the v2 read', async () => {
  rpc.mockResolvedValue({ data: [{ ...learned, slot_index: 1, equipped_at: at }], error: null })
  const rows = await createSupabaseCharacterBuildRepository().listEquippedDisciplineSkills(
    'user',
    'character',
  )
  expect(rpc).toHaveBeenCalledWith('get_character_discipline_skill_loadout_v2', {
    p_user_id: 'user',
    p_character_id: 'character',
  })
  expect(rows[0]).toMatchObject({
    sourceDisciplineId: 'lifebinder',
    eligibilityDisciplineId: 'vanguard',
  })
})
it('save forwards the explicit choice and maps the specific ambiguous-selection blocker to an actionable request error', async () => {
  rpc.mockResolvedValue({
    data: null,
    error: { code: '22023', message: 'DISCIPLINE_SKILL_ELIGIBILITY_REQUIRED' },
  })
  const reference = {
    skillId: 'lifebinder.mend',
    contentVersion: 5,
    sourceDisciplineId: 'lifebinder',
    eligibilityDisciplineId: 'vanguard',
  }
  await expect(
    createSupabaseCharacterBuildRepository().saveDisciplineSkills({
      userId: 'user',
      characterId: 'character',
      expectedBuildVersion: 1,
      idempotencyKey: 'key',
      requestFingerprint: 'fingerprint',
      skills: [reference],
    }),
  ).rejects.toMatchObject({
    code: 'INVALID_REQUEST',
    publicMessage: expect.stringMatching(/choose.*Discipline/i),
  })
  expect(rpc.mock.calls[0]![1].p_skills).toEqual([reference])
})
const snapshot = {
  schemaVersion: 3,
  buildVersion: 1,
  primary: { disciplineId: 'vanguard', definitionVersion: 1, profileVersion: 1 },
  secondary: null,
  disciplineSkills: [
    {
      slotIndex: 1,
      skillId: 'lifebinder.mend',
      contentVersion: 5,
      sourceDisciplineId: 'lifebinder',
      eligibilityDisciplineId: 'vanguard',
    },
  ],
  extensions: {
    resonance: null,
    essence: null,
    equipmentSkills: [],
    supernatural: null,
    prestige: null,
  },
}
it('committed transport preserves present selected eligibility and historical omitted native references', async () => {
  rpc.mockResolvedValue({ data: snapshot, error: null })
  expect(
    (await createSupabaseCharacterBuildRepository().loadCommittedBuildSnapshot('user', 'character'))
      ?.disciplineSkills,
  ).toEqual(snapshot.disciplineSkills)
  const old = {
    ...snapshot,
    disciplineSkills: [
      {
        slotIndex: 1,
        skillId: 'vanguard.brace',
        contentVersion: 1,
        sourceDisciplineId: 'vanguard',
      },
    ],
  }
  rpc.mockResolvedValue({ data: old, error: null })
  expect(
    (await createSupabaseCharacterBuildRepository().loadCommittedBuildSnapshot('user', 'character'))
      ?.disciplineSkills,
  ).toEqual(old.disciplineSkills)
})
it('committed transport rejects present malformed eligibility instead of dropping it', async () => {
  rpc.mockResolvedValue({
    data: {
      ...snapshot,
      disciplineSkills: [{ ...snapshot.disciplineSkills[0], eligibilityDisciplineId: null }],
    },
    error: null,
  })
  await expect(
    createSupabaseCharacterBuildRepository().loadCommittedBuildSnapshot('user', 'character'),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
})

it('testing eligibility stays usable but explicitly unearned in the actual joined read', async () => {
  rpc.mockResolvedValue({
    data: [
      {
        ...learned,
        grant_source_kind: 'support',
        grant_source_id: 'discipline-testing-open:v1',
        earned_at: null,
        earned_source_kind: null,
        earned_source_id: null,
      },
    ],
    error: null,
  })
  expect(
    (await createSupabaseCharacterBuildRepository().listLearnedSkills('user', 'character'))[0],
  ).toMatchObject({
    eligibilityDisciplineId: 'vanguard',
    earnedAt: null,
    earnedSourceKind: null,
    earnedSourceId: null,
  })
})
it.each([
  { earned_source_kind: null },
  { earned_at: null },
  { grant_source_kind: 'invented' },
  { granted_at: 'not-a-date' },
  { earned_source_id: '' },
])('joined provenance rejects incoherent fields %j', async (patch) => {
  rpc.mockResolvedValue({ data: [{ ...learned, ...patch }], error: null })
  await expect(
    createSupabaseCharacterBuildRepository().listLearnedSkills('user', 'character'),
  ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
})
it.each([true, false])(
  'committed read retains SQL-derived selected earned eligibility %s',
  async (earnedEligibility) => {
    const captured = {
      ...snapshot,
      disciplineSkills: [{ ...snapshot.disciplineSkills[0], earnedEligibility }],
    }
    rpc.mockResolvedValue({ data: captured, error: null })
    expect(
      (
        await createSupabaseCharacterBuildRepository().loadCommittedBuildSnapshot(
          'user',
          'character',
        )
      )?.disciplineSkills,
    ).toEqual(captured.disciplineSkills)
  },
)
it.each([null, 'true', 1])(
  'committed read rejects malformed earned eligibility %j',
  async (earnedEligibility) => {
    rpc.mockResolvedValue({
      data: {
        ...snapshot,
        disciplineSkills: [{ ...snapshot.disciplineSkills[0], earnedEligibility }],
      },
      error: null,
    })
    await expect(
      createSupabaseCharacterBuildRepository().loadCommittedBuildSnapshot('user', 'character'),
    ).rejects.toMatchObject({ code: 'PERSISTENCE_UNAVAILABLE' })
  },
)
it('retains the authoritative catalogue generation and earned policy through committed transport', async () => {
  rpc.mockResolvedValue({
    data: { ...snapshot, skillEligibilityPolicyVersion: 1, catalogueToken: 'a'.repeat(32) },
    error: null,
  })
  expect(
    await createSupabaseCharacterBuildRepository().loadCommittedBuildSnapshot('user', 'character'),
  ).toMatchObject({ skillEligibilityPolicyVersion: 1, catalogueToken: 'a'.repeat(32) })
})
it('actual current catalogue transports published Core bases and focus without static identity fallback', async () => {
  rpc.mockResolvedValue({
    data: [
      {
        discipline_id: 'authored.discipline',
        definition_version: 12,
        name: 'Authored',
        summary: 'Current.',
        enabled_for_primary: true,
        enabled_for_secondary: true,
        profile_version: 12,
        stat_offsets: {},
        mastered_at: null,
        core_base_attributes: {
          might: 8,
          finesse: 4,
          vitality: 7,
          agility: 4,
          intellect: 4,
          resolve: 4,
        },
        focus_attributes: ['intellect', 'resolve'],
        off_focus_cap: 40,
      },
    ],
    error: null,
  })
  const rows = await createSupabaseCharacterBuildRepository().listDisciplines('user', 'character')
  expect(rows[0]?.profile).toMatchObject({
    corePolicy: {
      disciplineId: 'authored.discipline',
      policyVersion: 12,
      baseAttributes: { might: 8, finesse: 4, vitality: 7, agility: 4, intellect: 4, resolve: 4 },
      focusAttributes: ['intellect', 'resolve'],
      attributeCaps: { might: 40, intellect: 60, resolve: 60 },
    },
  })
})
