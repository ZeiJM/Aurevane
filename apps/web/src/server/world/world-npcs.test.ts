import { expect, it, vi } from 'vitest'
import type { PublishedWorldNpc } from '@aurevane/validation/combat/npc-design'

vi.mock('server-only', () => ({}))
import { newWorldState } from '@/world/travel'
import { projectLocalWorldNpcs } from './world-npcs'

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
}

it('projects an authoritative local World greeting without any quest or combat action', () => {
  const state = newWorldState()
  const { npcs, interactions } = projectLocalWorldNpcs(state, [npc])
  expect(npcs).toEqual([expect.objectContaining({ id: npc.id, name: npc.name })])
  expect(interactions).toEqual([
    expect.objectContaining({
      speakerId: npc.id,
      body: npc.greeting,
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
