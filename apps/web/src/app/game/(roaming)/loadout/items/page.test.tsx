import { beforeEach, expect, it, vi } from 'vitest'
import { CharacterItems } from '@/components/character/character-items'
const mocks = vi.hoisted(() => ({ guard: vi.fn(), read: vi.fn(), repository: vi.fn() }))
vi.mock('@/server/character/require-roaming-character', () => ({
  requireRoamingCharacter: mocks.guard,
}))
vi.mock('@/server/character/character-items-service', () => ({ loadCharacterItems: mocks.read }))
vi.mock('@/server/character/supabase-character-items-repository', () => ({
  createSupabaseCharacterItemsRepository: mocks.repository,
}))
import ItemsPage from './page'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.guard.mockResolvedValue({
    actor: { userId: 'owner' },
    character: { id: 'selected', presentationId: 'feminine' },
  })
  mocks.repository.mockReturnValue({})
})
it('reads only the guarded selected owner and passes its returned inventory view', async () => {
  const view = { revision: 3 }
  mocks.read.mockResolvedValue(view)
  const page = await ItemsPage()
  expect(mocks.read).toHaveBeenCalledWith('owner', 'selected', {})
  expect(page.props.children[1].type).toBe(CharacterItems)
  expect(page.props.children[1].props.initialView).toBe(view)
  expect(page.props.children[1].props.presentationId).toBe('feminine')
})
it('preserves battle/auth redirects before any Item read', async () => {
  mocks.guard.mockRejectedValue(new Error('redirect battle'))
  await expect(ItemsPage()).rejects.toThrow('redirect battle')
  expect(mocks.read).not.toHaveBeenCalled()
})
it('offers the client reload path when repository initialization is unavailable', async () => {
  mocks.repository.mockImplementation(() => {
    throw new Error('configuration unavailable')
  })
  const page = await ItemsPage()
  expect(page.props.children[1].props.initialView).toBeNull()
})
