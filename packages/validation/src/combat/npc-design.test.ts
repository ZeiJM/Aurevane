import { describe, expect, it } from 'vitest'
import {
  parseNpcDesignCommand,
  parseArenaNpc,
  parsePublishedStoryNpc,
  parsePublishedWorldNpc,
} from './npc-design'

const id = 'd3ac17bd-5f14-4ae6-a24d-a82bbc9c1406'
const arena = { arenaId: 'duel-yard', aiDifficulty: 'high', lore: 'A patient duelist.' }
const draft = { name: 'Tamsin', portraitRef: null, uses: ['arena'], arena }

describe('NPC Design request boundary', () => {
  it('accepts the shared cuffed sprite recipe in drafting and all three published surfaces', () => {
    const imageUrl =
      '/api/media/appearance/3/broad.deep.crop.onyx.cuirass.fur.close.clasps.split.quilt.brooch.indigo.greaves.braced/neutral.svg'
    const identity = { id, name: 'Tamsin', portraitRef: null, imageUrl, revision: 1 }
    expect(
      parseNpcDesignCommand({ kind: 'save', id, revision: 0, draft: { ...draft, imageUrl } }),
    ).not.toBeNull()
    expect(parseArenaNpc({ ...identity, ...arena })).not.toBeNull()
    expect(parsePublishedStoryNpc(identity)).not.toBeNull()
    expect(
      parsePublishedWorldNpc({
        ...identity,
        sectorId: 'verdant-expanse',
        x: 2,
        y: 4,
        radius: 1,
        greeting: 'Welcome.',
      }),
    ).not.toBeNull()
    expect(
      parsePublishedStoryNpc({ ...identity, imageUrl: imageUrl.replace('.braced', '') }),
    ).toBeNull()
  })
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
