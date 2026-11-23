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
vi.mock('@/server/character/character-appearance-service', () => ({
  loadCharacterAppearance: async () => ({ appearanceTokens: 99, pendingImageUrl: null }),
}))
import CharacterTitlesPage from './page'
it('supplies the current title and inventory token balance to settings', async () => {
  const page = await CharacterTitlesPage()
  expect(page.props.personalTitle).toBeNull()
  expect(page.props.appearanceTokens).toBe(99)
})
