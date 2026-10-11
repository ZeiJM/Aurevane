import { beforeEach, describe, expect, it, vi } from 'vitest'

const authority = vi.hoisted(() => ({ change: vi.fn(), selected: vi.fn(), context: vi.fn() }))
vi.mock('@/server/auth/actor', () => ({
  getAuthenticatedActor: async () => ({ userId: 'account-b' }),
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: authority.selected,
}))
vi.mock('@/server/character/character-build-service', () => ({
  changeCharacterDisciplines: authority.change,
  loadCharacterBuildContext: authority.context,
  previewCharacterDisciplines: vi.fn(),
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({}),
}))
vi.mock('@/server/character/supabase-character-build-repository-v3', () => ({
  createSupabaseCharacterBuildRepositoryV3: () => ({}),
}))

import { PUT } from './route'

describe('Discipline commit selected-character boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authority.selected.mockResolvedValue({ id: 'character-b' })
    authority.change.mockResolvedValue({ replayed: false })
    authority.context.mockResolvedValue({ build: { characterId: 'character-b', buildVersion: 8 } })
  })

  it('rejects an intent prepared for a previous character before mutation', async () => {
    const response = await PUT(
      new Request('https://aurevane.test/api/character/build/disciplines', {
        method: 'PUT',
        body: JSON.stringify({
          expectedCharacterId: 'character-a',
          expectedBuildVersion: 1,
          primaryDisciplineId: 'aetherist',
          secondaryDisciplineId: null,
          idempotencyKey: 'change-a',
        }),
      }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      error: { message: expect.stringContaining('selected character changed') },
    })
    expect(authority.change).not.toHaveBeenCalled()
  })

  it.each(['character-b', undefined])(
    'preserves the version and idempotency contract for identity %s',
    async (expectedCharacterId) => {
      const response = await PUT(
        new Request('https://aurevane.test/api/character/build/disciplines', {
          method: 'PUT',
          body: JSON.stringify({
            expectedCharacterId,
            expectedBuildVersion: 7,
            primaryDisciplineId: 'aetherist',
            secondaryDisciplineId: null,
            idempotencyKey: 'change-b',
          }),
        }),
      )
      expect(response.status).toBe(200)
      expect(authority.change).toHaveBeenCalledExactlyOnceWith(
        'account-b',
        { id: 'character-b' },
        {
          expectedBuildVersion: 7,
          primaryDisciplineId: 'aetherist',
          secondaryDisciplineId: null,
          idempotencyKey: 'change-b',
        },
        {},
      )
      expect(await response.json()).toMatchObject({
        context: { build: { characterId: 'character-b', buildVersion: 8 } },
      })
    },
  )
})
