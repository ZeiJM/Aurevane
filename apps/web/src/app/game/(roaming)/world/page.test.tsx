import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
const mocks = vi.hoisted(() => ({
  battle: vi.fn(),
  spectating: vi.fn(),
  character: vi.fn(),
  world: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: 'localhost' }) }))
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))
vi.mock('@/lib/supabase/config', () => ({ getOptionalPublicSupabaseConfig: () => ({}) }))
vi.mock('@/server/account/account-services-readiness', () => ({
  getCurrentAccountServicesReadiness: () => ({ available: true }),
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: async () => ({ userId: 'owner' }) }))
vi.mock('@/server/account/active-game-session', () => ({
  getActiveBattleForUser: mocks.battle,
  getActiveSpectatingForUser: mocks.spectating,
}))
vi.mock('@/server/character/selected-character', () => ({ loadSelectedCharacter: mocks.character }))
vi.mock('@/server/character/character-identity-rail-context', () => ({
  loadCharacterIdentityRailContext: vi.fn(),
}))
vi.mock('@/server/world/world-repository', () => ({ readWorld: mocks.world }))
import WorldMapPage from './page'
beforeEach(() => {
  mocks.battle.mockReset().mockResolvedValue(null)
  mocks.spectating.mockReset().mockResolvedValue(null)
  mocks.character.mockReset().mockResolvedValue(null)
  mocks.world.mockReset()
})
it('carries a World return preference when an owned active battle blocks World entry', async () => {
  mocks.battle.mockResolvedValue({ battleSessionId: '00000000-0000-4000-8000-000000000001' })
  await expect(WorldMapPage()).rejects.toThrow(
    'REDIRECT:/game/battle/00000000-0000-4000-8000-000000000001?returnTo=world',
  )
  expect(mocks.battle).toHaveBeenCalledWith('owner')
  expect(mocks.world).not.toHaveBeenCalled()
})
it('retains the distinct spectator redirect and never grants participant return context', async () => {
  mocks.spectating.mockResolvedValue({ battleKey: 'spectator-key' })
  await expect(WorldMapPage()).rejects.toThrow('REDIRECT:/game/battle/spectate/spectator-key')
  expect(mocks.world).not.toHaveBeenCalled()
})
it('still requires a selected character before any World read', async () => {
  await expect(WorldMapPage()).rejects.toThrow('REDIRECT:/game')
  expect(mocks.world).not.toHaveBeenCalled()
})
