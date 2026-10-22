import { expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import {
  commitCharacterAttributeAllocation,
  type CharacterAttributeAllocationView,
} from './character-attribute-service'
import type { PersistedCharacter } from '@aurevane/game-core/character/persistence'
const base = { might: 8, finesse: 4, vitality: 7, agility: 4, intellect: 4, resolve: 4 }
it('allocation honors the actual pinned published focus and base while preserving personal points', async () => {
  const current = {
    characterId: 'character',
    attributes: { ...base, intellect: 44 },
    baseAttributes: base,
    focusAttributes: ['intellect', 'resolve'],
    offFocusCap: 40,
    level: 70,
    pointPool: 105,
    personalPointPool: 74,
    spentPoints: 71,
    unspentPoints: 34,
    conversionRequired: false,
    resetWindowStartedAt: null,
    resetUsed: 0,
    resetRemaining: 5,
    resetRenewsAt: null,
    serverNow: '2026-10-22T00:00:00Z',
  } as CharacterAttributeAllocationView
  const commitAllocation = vi.fn(async () => ({ allocation: current, replayed: false }))
  await commitCharacterAttributeAllocation(
    'owner',
    { id: 'character' } as PersistedCharacter,
    {
      mode: 'spend',
      attributes: { ...current.attributes, intellect: 45 },
      primaryDisciplineId: 'vanguard',
      idempotencyKey: '00000000-0000-4000-8000-000000000099',
    },
    { loadAllocation: async () => current, commitAllocation },
  )
  expect(commitAllocation).toHaveBeenCalledWith(
    expect.objectContaining({ attributes: { ...current.attributes, intellect: 45 } }),
  )
})
