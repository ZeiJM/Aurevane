import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireCharacter: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/server/character/require-roaming-character', () => ({
  requireRoamingCharacter: mocks.requireCharacter,
}))

import LoadoutPage from './page'

describe('Loadout entry', () => {
  beforeEach(() => vi.clearAllMocks())
  it('opens Nexus automatically after the roaming guard succeeds', async () => {
    mocks.requireCharacter.mockResolvedValue({})
    await expect(LoadoutPage()).rejects.toThrow('redirect:/game/nexus')
    expect(mocks.requireCharacter).toHaveBeenCalledOnce()
    expect(mocks.redirect).toHaveBeenCalledWith('/game/nexus')
  })
  it('preserves the active-session or authentication guard rather than opening Nexus', async () => {
    mocks.requireCharacter.mockRejectedValue(new Error('redirect:/game/battle/active'))
    await expect(LoadoutPage()).rejects.toThrow('redirect:/game/battle/active')
    expect(mocks.redirect).not.toHaveBeenCalled()
  })
})
