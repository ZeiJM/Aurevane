import { describe, expect, it, vi } from 'vitest'
import { AurevaneError } from '@aurevane/game-core/errors'
const load = vi.hoisted(() => vi.fn())
vi.mock('server-only', () => ({}))
vi.mock('@/server/character/require-roaming-character', () => ({
  requireRoamingCharacter: async () => ({
    actor: { userId: 'owner' },
    character: { id: 'character', name: 'Kaelen', level: 1, progressionCycle: { number: 1 } },
  }),
}))
vi.mock('@/server/character/supernatural-story-state-service', () => ({
  findAuthoredSupernaturalStoryState: load,
}))
vi.mock('@/server/character/supabase-supernatural-story-state-repository', () => ({
  createSupabaseSupernaturalStoryStateRepository: () => ({}),
}))
import HavenPage from './page'
describe('Haven optional Current Path recovery', () => {
  it('keeps the landing available when optional path persistence is unavailable', async () => {
    load.mockRejectedValueOnce(new AurevaneError('PERSISTENCE_UNAVAILABLE', 'Unavailable'))
    await expect(HavenPage()).resolves.toBeTruthy()
  })
  it('does not hide unexpected errors', async () => {
    load.mockRejectedValueOnce(new Error('unexpected'))
    await expect(HavenPage()).rejects.toThrow('unexpected')
  })
})
