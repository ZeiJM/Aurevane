import { expect, it, vi } from 'vitest'
import type { PublishedWorldNpc } from '@aurevane/validation/combat/npc-design'

const { readPublishedNpcRows } = vi.hoisted(() => ({ readPublishedNpcRows: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/server/master/npc-design-store', () => ({
  readPublishedWorldNpcs: readPublishedNpcRows,
}))
import { newWorldState } from '@/world/travel'
import {
  loadWorldNpcs,
  peekWorldNpcs,
  projectLocalWorldNpcs,
  readLocalNpcDialogue,
  resetWorldNpcReadCache,
} from './world-npcs'

const npc: PublishedWorldNpc = {
  id: '50bcf54b-d667-4e03-af93-3457b0055a95',
  name: 'World Fixture',
  portraitRef: null,
  revision: 2,
  sectorId: 'verdant-expanse',
  x: 5,
  y: 4,
  radius: 2,
  greeting: 'Safe travels.',
  greetingExpression: 'happy',
}

it('projects an authoritative local World greeting without any quest or combat action', () => {
  const state = newWorldState()
  const { npcs, interactions } = projectLocalWorldNpcs(state, [npc])
  expect(npcs).toEqual([expect.objectContaining({ id: npc.id, name: npc.name })])
  expect(interactions).toEqual([
    expect.objectContaining({
      speakerId: npc.id,
      body: npc.greeting,
      expression: 'happy',
      actionId: null,
      actionLabel: null,
    }),
  ])
})

it('keeps known distant NPCs visible but suppresses greetings beyond the placement range', () => {
  const state = newWorldState()
  state.position = { ...state.position, x: 2 }
  expect(projectLocalWorldNpcs(state, [npc]).npcs).toHaveLength(1)
  expect(projectLocalWorldNpcs(state, [npc]).interactions).toEqual([])
})

it('does not project another sector or a placement on invalid ground', () => {
  const state = newWorldState()
  expect(
    projectLocalWorldNpcs(state, [
      { ...npc, sectorId: 'aureth-crown' },
      { ...npc, y: -1 },
    ]),
  ).toEqual({ npcs: [], interactions: [] })
})

it('offers an explicit local challenge for a published World encounter without exposing its tags', () => {
  const state = newWorldState()
  const fighter: PublishedWorldNpc = {
    ...npc,
    encounter: { arenaId: 'duel-yard', aiDifficulty: 'standard', tags: ['private-fixture-tag'] },
  }
  const view = projectLocalWorldNpcs(state, [fighter])
  expect(view.interactions.map((entry) => entry.actionId)).toEqual([null, 'challenge-npc'])
  expect(JSON.stringify(view)).not.toContain('private-fixture-tag')
  expect(
    projectLocalWorldNpcs({ ...state, position: { ...state.position, x: 2 } }, [fighter])
      .interactions,
  ).toEqual([])
})

it('projects only available reply labels and reads one current narrative turn inside reach', async () => {
  const actor: PublishedWorldNpc = {
    ...npc,
    dialogue: [
      {
        label: 'Ask about the shore',
        body: 'The shore beyond the headland is quiet.',
        expression: 'sad',
        replies: [{ label: 'Listen closely', body: 'Listen at the breakwater.', replies: [] }],
      },
      {
        label: 'Ask about the ridge',
        body: 'The crest is covered in cloud.',
        replies: [],
      },
    ],
  }
  readPublishedNpcRows.mockResolvedValue([actor])
  const state = newWorldState()
  const scene = projectLocalWorldNpcs(state, [actor])
  expect(scene.interactions[0]?.narrative).toEqual({
    revision: 2,
    replies: ['Ask about the shore', 'Ask about the ridge'],
  })
  expect(JSON.stringify(scene)).not.toContain('headland')
  expect(JSON.stringify(scene)).not.toContain('Listen closely')
  const request = { characterId: npc.id, npcId: npc.id, revision: npc.revision, path: [0] }
  await expect(readLocalNpcDialogue(state, request)).resolves.toEqual({
    body: 'The shore beyond the headland is quiet.',
    expression: 'sad',
    replies: ['Listen closely'],
  })
  await expect(readLocalNpcDialogue(state, { ...request, path: [1, 0] })).resolves.toBeNull()
  await expect(readLocalNpcDialogue(state, { ...request, revision: 1 })).resolves.toBeNull()
  await expect(
    readLocalNpcDialogue(
      {
        ...state,
        position: { ...state.position, x: 2 },
      },
      request,
    ),
  ).resolves.toBeNull()
  await expect(
    readLocalNpcDialogue(
      {
        ...state,
        route: [{ position: state.position, durationMs: 250 }],
      },
      request,
    ),
  ).resolves.toBeNull()
  readPublishedNpcRows.mockResolvedValue([])
  await expect(readLocalNpcDialogue(state, request)).resolves.toBeNull()
})

it('keeps the new World publication after an older in-flight snapshot finishes', async () => {
  resetWorldNpcReadCache()
  const state = newWorldState()
  let resolveOld!: (rows: PublishedWorldNpc[]) => void
  readPublishedNpcRows.mockImplementationOnce(
    () => new Promise<PublishedWorldNpc[]>((resolve) => (resolveOld = resolve)),
  )
  const previousRequest = loadWorldNpcs(state)
  resetWorldNpcReadCache()
  const published = {
    ...npc,
    dialogue: [{ label: 'Ask about the tide', body: 'The tide has turned.', replies: [] }],
  }
  readPublishedNpcRows.mockResolvedValueOnce([published])
  await expect(loadWorldNpcs(state)).resolves.toMatchObject({
    interactions: [{ narrative: { revision: npc.revision, replies: ['Ask about the tide'] } }],
  })
  resolveOld([])
  await previousRequest
  expect(peekWorldNpcs(state)?.interactions[0]?.narrative?.replies).toEqual(['Ask about the tide'])
  resetWorldNpcReadCache()
})
