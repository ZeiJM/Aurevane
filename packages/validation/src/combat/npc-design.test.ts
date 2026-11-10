import { describe, expect, it } from 'vitest'
import { parseNpcDesignCommand, parseArenaNpc } from './npc-design'

const id = 'd3ac17bd-5f14-4ae6-a24d-a82bbc9c1406'
const arena = { arenaId: 'duel-yard', aiDifficulty: 'high', lore: 'A patient duelist.' }
const draft = { name: 'Tamsin', portraitRef: null, uses: ['arena'], arena }

describe('NPC Design request boundary', () => {
  it('accepts an arena-only draft without any story, dialogue or placement', () => {
    expect(parseNpcDesignCommand({ kind: 'save', id, revision: 0, draft })).toEqual({
      kind: 'save',
      id,
      revision: 0,
      draft,
    })
  })

  it('separates public card and draft fields and rejects unusable published data', () => {
    expect(
      parseArenaNpc({ ...arena, id, name: 'Tamsin', portraitRef: null, revision: 1 }),
    ).not.toBeNull()
    expect(parseArenaNpc({ ...arena, id, name: ' ', portraitRef: null, revision: 1 })).toBeNull()
    expect(
      parseArenaNpc({ ...arena, id, name: 'Tamsin', portraitRef: null, revision: 1, draft }),
    ).toBeNull()
    expect(
      parseNpcDesignCommand({
        kind: 'save',
        id,
        revision: 0,
        draft: {
          ...draft,
          arena: { ...arena, lore: 'x'.repeat(701) },
        },
      }),
    ).toBeNull()
  })

  it('rejects malformed purposes, arena values, and stale-prone unversioned writes', () => {
    expect(
      parseNpcDesignCommand({
        kind: 'save',
        id,
        revision: 0,
        draft: { ...draft, uses: ['arena', 'arena'] },
      }),
    ).toBeNull()
    expect(
      parseNpcDesignCommand({
        kind: 'save',
        id,
        revision: 0,
        draft: { ...draft, arena: { ...arena, arenaId: 'fake' } },
      }),
    ).toBeNull()
    expect(parseNpcDesignCommand({ kind: 'commit-arena', id })).toBeNull()
  })
})
