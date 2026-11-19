import { describe, expect, it } from 'vitest'
import {
  parseNpcDesignCommand,
  parseNpcDialogueRequest,
  type NpcDialogueReply,
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
        greetingExpression: 'happy',
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

it('bounds dialogue drafts and prohibits publishing unfinished or over-deep replies', () => {
  const leaf = { label: 'Listen', body: 'A distant bell is ringing.', replies: [] }
  const world = { sectorId: 'verdant-expanse', x: 5, y: 4, radius: 2, greeting: 'Welcome.' }
  const publish = (dialogue: unknown) =>
    parsePublishedWorldNpc({
      ...world,
      id,
      name: 'Tamsin',
      portraitRef: null,
      revision: 1,
      dialogue,
    })
  expect(publish([{ ...leaf, replies: [leaf] }])).not.toBeNull()
  expect(publish([{ ...leaf, body: '  ' }])).toBeNull()
  expect(publish([{ ...leaf, reward: 200 }])).toBeNull()
  expect(publish(Array(5).fill(leaf))).toBeNull()
  const wide = { ...leaf, replies: Array(4).fill(leaf) }
  expect(publish(Array(4).fill(wide))).toBeNull()
  let tall: NpcDialogueReply = leaf
  for (let depth = 1; depth <= 4; depth++) tall = { ...leaf, replies: [tall] }
  expect(publish([tall])).toBeNull()
  expect(
    parseNpcDesignCommand({
      kind: 'save',
      id,
      revision: 0,
      draft: {
        ...draft,
        uses: ['world'],
        arena: null,
        world: { ...world, dialogue: [{ ...leaf, body: '' }] },
      },
    }),
  ).not.toBeNull()
  const request = { characterId: id, npcId: id, revision: 1, path: [0] }
  expect(parseNpcDialogueRequest(request)).toEqual(request)
  expect(parseNpcDialogueRequest({ ...request, path: [0, 0, 0, 0, 0] })).toBeNull()
  expect(parseNpcDialogueRequest({ ...request, path: [4] })).toBeNull()
  expect(parseNpcDialogueRequest({ ...request, body: 'Forged response' })).toBeNull()
})
