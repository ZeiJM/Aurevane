import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ access: vi.fn(), read: vi.fn() }))
vi.mock('@/server/master/master-panel-page-access', () => ({
  requireMasterPanelPageAccess: mocks.access,
}))
vi.mock('@/server/master/players-server', () => ({
  createServerMasterPlayersService: () => ({ read: mocks.read }),
}))
vi.mock('@/components/master/master-panel-shell', () => ({ MasterPanelShell: () => null }))
vi.mock('@/components/master/players-workspace', () => ({ PlayersWorkspace: () => null }))
import MasterPlayersPage from './page'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ actor: { userId: 'owner' }, access: {} })
  mocks.read.mockResolvedValue({ characterId: 'target' })
})
it('opens the selected player only after page authorization', async () => {
  const characterId = '00000000-0000-4000-8000-000000000001'
  await MasterPlayersPage({ searchParams: Promise.resolve({ characterId }) })
  expect(mocks.access).toHaveBeenCalledWith('players.manage')
  expect(mocks.read).toHaveBeenCalledWith('owner', characterId)
})
it('ignores malformed links and does not read a player', async () => {
  await MasterPlayersPage({ searchParams: Promise.resolve({ characterId: 'not-a-character' }) })
  expect(mocks.read).not.toHaveBeenCalled()
})
it('denied access cannot reach the player service', async () => {
  mocks.access.mockRejectedValue(new Error('Denied'))
  await expect(
    MasterPlayersPage({
      searchParams: Promise.resolve({ characterId: '00000000-0000-4000-8000-000000000001' }),
    }),
  ).rejects.toThrow('Denied')
  expect(mocks.read).not.toHaveBeenCalled()
})
