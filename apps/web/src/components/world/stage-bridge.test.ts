import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { STARTER_CHARACTER_PORTRAITS } from '@aurevane/game-core/character/starter-options'
import { projectWorld } from '@/server/world/world-service'
import { newWorldState } from '@/world/travel'
import { buildStageState, parseStageMessage, travelDestination } from './stage-bridge'

const view = () => projectWorld(newWorldState(), [], 1000)

describe('World stage bridge', () => {
  it('accepts only well-formed stage intents', () => {
    expect(parseStageMessage({ av: 'world-stage', type: 'ready' })).toEqual({ type: 'ready' })
    expect(
      parseStageMessage({
        av: 'world-stage',
        type: 'walk',
        destination: { sectorId: 'a', x: 1, y: 2 },
      }),
    ).toEqual({ type: 'walk', destination: { sectorId: 'a', x: 1, y: 2 } })
    expect(parseStageMessage({ av: 'world-stage', type: 'attack', targetId: 'c1' })).toEqual({
      type: 'attack',
      targetId: 'c1',
    })
    expect(parseStageMessage({ av: 'world-stage', type: 'travel', sectorId: 's' })).toEqual({
      type: 'travel',
      sectorId: 's',
    })
    expect(parseStageMessage({ av: 'other', type: 'ready' })).toBeNull()
    expect(
      parseStageMessage({ av: 'world-stage', type: 'walk', destination: { x: 'a' } }),
    ).toBeNull()
    expect(
      parseStageMessage({
        av: 'world-stage',
        type: 'walk',
        destination: { sectorId: 'a', x: 1.5, y: 0 },
      }),
    ).toBeNull()
    expect(parseStageMessage('walk')).toBeNull()
    expect(parseStageMessage(null)).toBeNull()
  })

  it('resolves every player portrait and carries the server environment', () => {
    const v = view()
    const state = buildStageState(
      {
        ...v,
        players: [
          {
            characterId: 'p1',
            name: 'Maren',
            level: 3,
            portraitRef: STARTER_CHARACTER_PORTRAITS[0]!.ref,
            imageUrl: null,
            position: v.position,
            online: false,
            attackable: false,
          },
        ],
      },
      { name: 'Hero', portrait: '/me.webp' },
      5000,
      true,
    )
    expect(state.portrait).toBe('/me.webp')
    expect(state.busy).toBe(true)
    expect(state.serverNow).toBe(5000)
    expect(state.players[0]!.portrait).toBeTruthy()
    expect(state.environment).toEqual(v.environment)
  })

  it('chooses a walkable arrival tile in a charted sector and null for unknown ones', () => {
    const v = view()
    const other = v.sectors.find((s) => s.id !== v.position.sectorId)
    if (other) {
      const dest = travelDestination(v, other.id)!
      expect(dest.sectorId).toBe(other.id)
      expect(
        other.cells.find((c) => c.x === dest.x && c.y === dest.y)?.walkable ||
          v.sectors.some((s) => s.exits.some((e) => e.to.x === dest.x && e.to.y === dest.y)),
      ).toBe(true)
    }
    expect(travelDestination(v, 'nowhere')).toBeNull()
  })
})
