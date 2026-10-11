import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  battle: vi.fn(),
  spectating: vi.fn(),
  selected: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock('@/server/auth/actor', () => ({ getAuthenticatedActor: mocks.actor }))
vi.mock('@/server/account/active-game-session', () => ({
  getActiveBattleForUser: mocks.battle,
  getActiveSpectatingForUser: mocks.spectating,
}))
vi.mock('./selected-character', () => ({ loadSelectedCharacter: mocks.selected }))
import { requireRoamingCharacter } from './require-roaming-character'
describe('Haven and Loadout session authority', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.actor.mockResolvedValue({ userId: 'owner' })
    mocks.battle.mockResolvedValue(null)
    mocks.spectating.mockResolvedValue(null)
    mocks.selected.mockResolvedValue({ id: 'selected' })
  })
  it('returns only the authenticated actor and selected character', async () => {
    expect(await requireRoamingCharacter()).toEqual({
      actor: { userId: 'owner' },
      character: { id: 'selected' },
    })
    expect(mocks.selected).toHaveBeenCalledWith({ userId: 'owner' })
  })
  it('returns signed-out visitors to account entry', async () => {
    mocks.actor.mockRejectedValue(new AurevaneError('UNAUTHENTICATED', 'Sign in'))
    await expect(requireRoamingCharacter()).rejects.toThrow('redirect:/')
    expect(mocks.selected).not.toHaveBeenCalled()
  })
  it('returns an account without a selected character to the roster', async () => {
    mocks.selected.mockResolvedValue(null)
    await expect(requireRoamingCharacter()).rejects.toThrow('redirect:/game')
  })
  it('prioritizes a playable battle over spectating', async () => {
    mocks.battle.mockResolvedValue({ battleSessionId: 'battle' })
    mocks.spectating.mockResolvedValue({ battleKey: 'spectator' })
    await expect(requireRoamingCharacter()).rejects.toThrow('redirect:/game/battle/battle')
  })
  it('returns spectators to the active battlefield', async () => {
    mocks.spectating.mockResolvedValue({ battleKey: 'spectator' })
    await expect(requireRoamingCharacter()).rejects.toThrow(
      'redirect:/game/battle/spectate/spectator',
    )
  })
  it('does not treat a failed session lookup as permission to roam', async () => {
    mocks.battle.mockRejectedValue(new Error('unavailable'))
    await expect(requireRoamingCharacter()).rejects.toThrow('unavailable')
  })
})
