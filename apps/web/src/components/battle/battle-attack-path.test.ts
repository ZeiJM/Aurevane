import { describe, expect, it } from 'vitest'
import type { TacticalBattleState } from '@aurevane/game-core/combat/board'
import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
import { battleAttackReachTiles, battleTargetReachTiles } from './battle-attack-path'
import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import { createCombatEncounterState } from '@aurevane/game-core/combat/actions'

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
          { aimSource: 'player', selection: { kind: 'tile', position: affected[0]! } },
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

describe('persistent current targeting footprints', () => {
  const line = {
    ...basic.target,
    geometryVersion: 2 as const,
    minimumRange: 0,
    maximumRange: 3,
    shape: { kind: 'line' as const, length: 3 },
  }
  it('keeps four full lanes when an automatic forecast detects one recipient', () => {
    const before = battleAttackReachTiles(tactical, origin, line, basic.effects)
    const after = battleAttackReachTiles(tactical, origin, line, basic.effects, [{ x: 4, y: 3 }])
    expect(before.size).toBe(12)
    expect(after).toEqual(before)
    expect([...after].sort()).toEqual([
      '0:3',
      '1:3',
      '2:3',
      '3:0',
      '3:1',
      '3:2',
      '3:4',
      '3:5',
      '3:6',
      '4:3',
      '5:3',
      '6:3',
    ])
  })
  it('keeps all potential lanes when one explicit direction is previewed', () => {
    expect([
      ...battleAttackReachTiles(tactical, origin, line, basic.effects, [], {
        aimSource: 'player',
        selection: { kind: 'direction', direction: 'east' },
      }),
    ]).toHaveLength(12)
    expect(battleAttackReachTiles(tactical, origin, line, basic.effects).size).toBe(12)
  })
  it.each([1, 2])('shows the immediate external Circle %i including its inner ring', (radius) => {
    const tiles = battleAttackReachTiles(
      tactical,
      origin,
      {
        ...line,
        shape: { kind: 'circle', radius },
        maximumRange: radius,
      },
      basic.effects,
      [{ x: 4, y: 3 }],
    )
    expect(tiles.size).toBe(radius === 1 ? 8 : 24)
    expect(tiles.has('3:3')).toBe(false)
    expect(tiles.has('4:4')).toBe(true)
  })
  it('keeps all Single candidates after automatic detection', () => {
    expect(
      battleAttackReachTiles(tactical, origin, basic.target, basic.effects, [{ x: 4, y: 3 }]).size,
    ).toBe(4)
  })
  it('shows All and nonattack potential footprints independently of victims', () => {
    const all = {
      ...line,
      shape: { kind: 'all' as const },
      maximumRange: 0,
      requiresLineOfSight: false,
    }
    expect(battleTargetReachTiles(tactical, origin, all).size).toBe(49)
    expect(battleTargetReachTiles(tactical, origin, line).size).toBe(12)
    expect(battleAttackReachTiles(tactical, origin, all, [{ type: 'healing' }]).size).toBe(0)
  })
  it('uses authoritative spatial filtering without letting elevation block a whole lane', () => {
    const battle = startBattle(
      createPendingBattle({
        battleId: 'spatial',
        rulesVersion: 1,
        contentVersion: 1,
        rngSeed: 1,
        combatants: [
          {
            id: 'actor',
            teamId: 'one',
            initiative: 20,
            baseMovementBudget: 3,
            hp: 100,
            maxHp: 100,
            mp: 10,
            maxMp: 10,
          },
          {
            id: 'enemy',
            teamId: 'two',
            initiative: 10,
            baseMovementBudget: 3,
            hp: 100,
            maxHp: 100,
            mp: 10,
            maxMp: 10,
          },
        ],
      }),
    ).state
    const board = createTacticalBattleState({
      ...tactical,
      battle,
      terrains: [
        { id: 'open', traversalCost: 1 },
        { id: 'wall', traversalCost: null },
      ],
      movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
      placements: [
        { combatantId: 'actor', position: origin, facing: 'east', movementProfileId: 'ground' },
        {
          combatantId: 'enemy',
          position: { x: 6, y: 3 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
      tiles: tactical.tiles.map((tile) => ({
        ...tile,
        elevation: tile.position.x === 4 && tile.position.y === 3 ? 3 : 0,
        terrainId: tile.position.x === 3 && tile.position.y === 2 ? 'wall' : 'open',
      })),
    })
    const state = createCombatEncounterState(board)
    const before = JSON.stringify(state)
    const reach = battleTargetReachTiles(
      board,
      origin,
      { ...line, maximumElevationDifference: 1, requiresLineOfSight: true },
      [],
      { aimSource: 'implicit' },
      { tactical: board, terrainOverlays: state.terrainOverlays },
    )
    expect(reach.has('4:3')).toBe(false)
    expect(reach.has('5:3')).toBe(true)
    expect(reach.has('6:3')).toBe(true)
    expect(reach.has('3:1')).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
    const global = {
      ...line,
      shape: { kind: 'all' as const },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
    }
    expect([
      ...battleTargetReachTiles(
        board,
        origin,
        global,
        [],
        { aimSource: 'implicit' },
        { tactical: board, actorId: 'actor' },
      ),
    ]).toEqual(['6:3'])
    expect(
      battleTargetReachTiles(
        board,
        origin,
        { ...global, kind: 'ground-tile' },
        [],
        { aimSource: 'implicit' },
        { tactical: board, actorId: 'actor' },
      ).size,
    ).toBe(48)
  })
})

it('retains the complete Ground Single range after aiming, without depending on the selected tile', () => {
  const target = { ...basic.target, kind: 'ground-tile' as const, maximumRange: 3 }
  const reach = battleTargetReachTiles(tactical, origin, target, [], { aimSource: 'implicit' })
  expect(reach.size).toBeGreaterThan(1)
  for (const position of [
    { x: 4, y: 1 },
    { x: 0, y: 0 },
  ]) {
    expect(
      battleTargetReachTiles(tactical, origin, target, [], {
        aimSource: 'player',
        selection: { kind: 'tile', position },
      }),
    ).toEqual(reach)
  }
})
