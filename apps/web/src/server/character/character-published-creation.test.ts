import { expect, it, vi } from 'vitest'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc }) }))
import { createCharacterInSlot } from './character-slot-service'
it('sends the five chosen bonuses and displayed Core version to atomic creation', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'CHARACTER_CORE_STALE', code: '40001' } })
  await expect(
    createCharacterInSlot({
      actor: { userId: 'user' },
      slotIndex: 0,
      idempotencyKey: 'request',
      expectedProfileVersion: 9,
      intent: {
        name: 'Arlen Vale',
        presentationId: 'androgynous',
        pronounPresetId: 'they_them',
        portraitRef: 'portrait.starter.wayfarer-01',
        starterAppearanceRef: 'appearance.starter.traveler-01',
        foundationDisciplineId: 'vanguard',
        attributeBonuses: {
          might: 2,
          finesse: 0,
          vitality: 2,
          agility: 0,
          intellect: 0,
          resolve: 1,
        },
      },
    }),
  ).rejects.toThrow('Core changed')
  expect(rpc).toHaveBeenCalledWith(
    'create_character_v4',
    expect.objectContaining({
      p_bonus_might: 2,
      p_bonus_vitality: 2,
      p_bonus_resolve: 1,
      p_expected_profile_version: 9,
    }),
  )
  expect(rpc.mock.calls[0][1]).not.toHaveProperty('p_might')
})

import { loadPublishedDisciplineAtlas } from './published-discipline-catalogue'
it('public Atlas carries current authored metadata and never resurrects a removed published builtin', async () => {
  rpc.mockResolvedValue({
    data: [
      {
        discipline_id: 'new-school',
        enabled_for_primary: true,
        enabled_for_secondary: true,
        name: 'New School',
        summary: 'Authored school.',
        profile_version: 7,
        definition_version: 7,
        core_base_attributes: {
          might: 7,
          finesse: 5,
          vitality: 5,
          agility: 5,
          intellect: 5,
          resolve: 4,
        },
        focus_attributes: ['might', 'intellect'],
        off_focus_cap: 40,
        authored_definition: {
          schemaVersion: 1,
          id: 'new-school',
          contentVersion: 7,
          name: 'New School',
          description: 'Authored school.',
          sortOrder: 0,
          enabled: true,
          media: {},
          core: { might: 7, finesse: 5, vitality: 5, agility: 5, intellect: 5, resolve: 4 },
          focus: ['might', 'intellect'],
          enabledForPrimary: true,
          enabledForSecondary: true,
          linkedSkills: [],
          unlock: { kind: 'mastery', disciplineId: 'vanguard', minimumStage: 3 },
          atlas: {
            family: 'mage',
            band: 'first-journey',
            disclosure: 'open',
            power: { reliability: 1, flexibility: 2, setup: 3, ruleAccess: 4, execution: 5 },
          },
          skillStages: [],
          essenceId: null,
          resonanceSelections: [],
        },
      },
    ],
    error: null,
  })
  const atlas = await loadPublishedDisciplineAtlas()
  expect(atlas.find((row) => row.id === 'new-school')).toMatchObject({
    name: 'New School',
    family: 'mage',
    unlock: { kind: 'mastery', disciplineId: 'vanguard', minimumStage: 3 },
  })
  expect(atlas.some((row) => row.id === 'vanguard')).toBe(false)
  expect(atlas.some((row) => row.publication === 'planned')).toBe(true)
})
