import { expect, it, vi } from 'vitest'
import type { NpcDesignRecord } from '@aurevane/validation/combat/npc-design'

vi.mock('server-only', () => ({}))
import { rehearseNpcArenaTurn } from './npc-arena-rehearsal'

const arenaDraft: NpcDesignRecord = {
  id: 'e8b172a2-c88f-439b-9a8f-7f7b5f3c491e',
  revision: 1,
  draft: {
    name: 'Draft Duelist',
    portraitRef: null,
    uses: ['arena'],
    arena: { arenaId: 'duel-yard', aiDifficulty: 'standard', lore: '' },
  },
  arena: null,
}

it('runs and captures an actual bounded AI turn using the unpublished saved Arena draft', async () => {
  const result = await rehearseNpcArenaTurn(arenaDraft)
  expect(result).toMatchObject({
    opponentName: 'Draft Duelist',
    revision: 1,
    profileId: 'recruit-standard-v2',
    arenaName: 'Duel Yard',
  })
  expect(result.decisions.length).toBeGreaterThan(0)
  expect(result.decisions.length).toBeLessThanOrEqual(8)
  expect(result.decisions).toContainEqual(expect.objectContaining({ reason: expect.any(String) }))
  expect(result.nextTurn).toBe('Practice character')
})

it('rejects a talk-only draft without touching the battle runner', async () => {
  await expect(
    rehearseNpcArenaTurn({
      ...arenaDraft,
      draft: { ...arenaDraft.draft, uses: ['world'], arena: null },
    }),
  ).rejects.toMatchObject({ code: 'INVALID_REQUEST' })
})
