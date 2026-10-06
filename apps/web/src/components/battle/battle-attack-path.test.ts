import { describe, expect, it } from 'vitest'
import type { TacticalBattleState } from '@aurevane/game-core/combat/board'
import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
import { battleAttackReachTiles } from './battle-attack-path'

// Pure geometry fixture: deliberately has no placements or combatants.
const tactical = {
  width: 7,
  height: 7,
  tiles: Array.from({ length: 49 }, (_, i) => ({
    position: { x: i % 7, y: Math.floor(i / 7) },
    elevation: 0,
    terrainId: 'open',
  })),
} satisfies Pick<TacticalBattleState, 'width' | 'height' | 'tiles'>
const basic = createPv1fBasicAttackDefinition(1)
const origin = { x: 3, y: 3 }

describe('armed damage reach', () => {
  it('shows all four Basic Attack neighbors without any detected target or forecast', () => {
    expect(
      [...battleAttackReachTiles(tactical, origin, basic.target, basic.effects)].sort(),
    ).toEqual(['2:3', '3:2', '3:4', '4:3'])
  })
  it('clips Basic Attack to the board at a corner', () => {
    expect(
      [...battleAttackReachTiles(tactical, { x: 0, y: 0 }, basic.target, basic.effects)].sort(),
    ).toEqual(['0:1', '1:0'])
  })
  it.each(['damage', 'burn', 'bleed', 'poison'])(
    'shows ranged %s reach with its minimum range',
    (type) => {
      const tiles = battleAttackReachTiles(
        tactical,
        origin,
        { ...basic.target, minimumRange: 2, maximumRange: 3 },
        [{ type }],
      )
      expect(tiles.has('3:0')).toBe(true)
      expect(tiles.has('3:2')).toBe(false)
      expect(tiles.has('0:0')).toBe(false)
    },
  )
  it('shows cardinal line reach and excludes diagonal aims', () => {
    const tiles = battleAttackReachTiles(
      tactical,
      origin,
      { ...basic.target, maximumRange: 3, shape: { kind: 'line', length: 3 } },
      basic.effects,
    )
    expect(tiles.size).toBe(12)
    expect(tiles.has('3:0')).toBe(true)
    expect(tiles.has('4:4')).toBe(false)
  })
  it.each(['line', 'circle'] as const)(
    'keeps the exact aimed %s footprint even when empty',
    (kind) => {
      const shape = kind === 'line' ? { kind, length: 3 } : { kind, radius: 2 }
      const affected = [
        { x: 4, y: 3 },
        { x: 5, y: 3 },
      ]
      expect([
        ...battleAttackReachTiles(
          tactical,
          origin,
          { ...basic.target, shape },
          basic.effects,
          affected,
        ),
      ]).toEqual(['4:3', '5:3'])
    },
  )
  it('uses the authored circle around a self-target without needing an enemy', () => {
    const tiles = battleAttackReachTiles(
      tactical,
      origin,
      {
        ...basic.target,
        kind: 'self',
        minimumRange: 0,
        maximumRange: 0,
        shape: { kind: 'circle', radius: 2 },
      },
      basic.effects,
    )
    expect(tiles.size).toBe(13)
    expect(tiles.has('3:1')).toBe(true)
    expect(tiles.has('1:1')).toBe(false)
  })
  it('does not paint red for non-damaging effects', () => {
    expect(
      battleAttackReachTiles(tactical, origin, basic.target, [
        { type: 'healing' },
        { type: 'apply-status' },
      ]).size,
    ).toBe(0)
  })
})
