import { beforeEach, expect, it, vi } from 'vitest'

const authority = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({ id: 'character' }),
}))
vi.mock('@/server/character/character-build-service', () => ({
  saveCharacterDisciplineSkills: authority.save,
  loadCharacterBuildContext: vi.fn(),
}))
vi.mock('@/server/character/current-skill-detail-loader', () => ({
  resolveCurrentCharacterSkillDetails: async (value: unknown) => value,
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({}),
}))
vi.mock('@/server/combat/combat-content-resolver', () => ({
  createServerCombatContentResolver: () => ({}),
}))
import { PUT } from './route'

beforeEach(() => {
  vi.clearAllMocks()
  authority.save.mockResolvedValue({ disciplineSkills: { equippedSkills: [] } })
})

it('forwards explicit selected eligibility without treating it as intrinsic source', async () => {
  const eligibilitySelections = [
    { skillId: 'lifebinder.mending-light', eligibilityDisciplineId: 'vanguard' },
  ]
  const response = await PUT(
    new Request('https://aurevane.test/api/character/build/skills', {
      method: 'PUT',
      body: JSON.stringify({
        expectedBuildVersion: 7,
        idempotencyKey: 'request',
        skillIds: ['lifebinder.mending-light'],
        eligibilitySelections,
      }),
    }),
  )
  expect(response.status).toBe(200)
  expect(authority.save).toHaveBeenCalledWith(
    'owner',
    { id: 'character' },
    {
      expectedBuildVersion: 7,
      idempotencyKey: 'request',
      skillIds: ['lifebinder.mending-light'],
      eligibilitySelections,
    },
    {},
  )
})

it.each([
  null,
  {},
  [null],
  [{ skillId: 'skill', eligibilityDisciplineId: 7 }],
  [{ skillId: 'skill' }],
])('rejects malformed eligibility %j before service mutation', async (eligibilitySelections) => {
  const response = await PUT(
    new Request('https://aurevane.test/api/character/build/skills', {
      method: 'PUT',
      body: JSON.stringify({
        expectedBuildVersion: 7,
        idempotencyKey: 'request',
        skillIds: ['skill'],
        eligibilitySelections,
      }),
    }),
  )
  expect(response.status).toBe(400)
  expect(authority.save).not.toHaveBeenCalled()
})
