import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'localhost' }) }))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(path)
  },
}))
vi.mock('@/lib/supabase/config', () => ({ getOptionalPublicSupabaseConfig: () => ({}) }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/account/active-game-session', () => ({
  getActiveBattleForUser: async () => null,
  getActiveSpectatingForUser: async () => null,
}))
vi.mock('@/server/character/selected-character', () => ({
  loadSelectedCharacter: async () => ({
    id: 'character',
    name: 'Hero',
    foundationDisciplineId: 'vanguard',
    portraitRef: 'portrait.starter.wayfarer-01',
  }),
}))
vi.mock('@/server/character/character-title-service', () => ({
  loadCharacterTitleState: async () => ({ personalTitle: null, personalTitleSetAt: null }),
}))
vi.mock('@/server/character/character-profile-display-service', () => ({
  loadCharacterProfileDisplay: async () => ({ imageUrl: null }),
}))
vi.mock('@/server/character/character-portrait-choice-service', () => ({
  loadCharacterPortraitChoice: async () => ({ available: true, changedAt: null }),
}))
vi.mock('@/server/character/supabase-character-build-repository', () => ({
  createSupabaseCharacterBuildRepository: () => ({
    findActiveBuild: async () => ({
      primaryDefinition: { id: 'discipline.custom', name: 'Super Saiyan' },
    }),
  }),
}))
import CharacterTitlesPage from './page'
it('shows the current programmed active Discipline instead of the original static foundation', async () => {
  const page = await CharacterTitlesPage()
  expect(page.props.disciplineName).toBe('Super Saiyan')
})
