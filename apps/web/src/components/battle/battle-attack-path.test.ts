import { describe, expect, it } from 'vitest'
import type { TacticalBattleState } from '@aurevane/game-core/combat/board'
import { createPv1fBasicAttackDefinition } from '@aurevane/game-core/combat/pv1f-action-economy'
import {
  battleActionDealsDamage,
  battleAttackReachTiles,
  battleTargetReachTiles,
} from './battle-attack-path'
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

it('uses captured damage presence ahead of an absent or stale native envelope', () => {
  expect(battleActionDealsDamage([], true)).toBe(true)
  expect(battleActionDealsDamage([{ type: 'damage' }], false)).toBe(false)
  expect(battleActionDealsDamage([{ type: 'damage' }])).toBe(true)
  expect(battleActionDealsDamage([])).toBe(false)
})

describe('armed damage reach', () => {
  it.each([
    [{ kind: 'line', length: 3 }, 3, 12],
    [{ kind: 'circle', radius: 2 }, 2, 24],
    [{ kind: 'all' }, 0, 49],
  ] as const)(
    'keeps the full geometry-three %j potential independent of victims',
    (shape, range, count) => {
      expect(
        battleTargetReachTiles(tactical, origin, {
          ...basic.target,
          geometryVersion: 3,
          categories: ['enemy'],
          maximumSelections: 1,
          minimumRange: 0,
          maximumRange: range,
          shape,
        }).size,
      ).toBe(count)
    },
  )
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

describe('retained destination aim boundaries', () => {
  const target = {
    ...basic.target,
    maximumRange: 1,
    shape: { kind: 'circle' as const, radius: 1 },
    maximumElevationDifference: 0,
    requiresLineOfSight: true,
  }
  const board = {
    ...tactical,
    terrains: [
      { id: 'open', traversalCost: 1 },
      { id: 'wall', traversalCost: null },
    ],
    placements: [
      {
        combatantId: 'actor',
        position: origin,
        facing: 'east' as const,
        movementProfileId: 'ground',
      },
      {
        combatantId: 'enemy',
        position: { x: 6, y: 3 },
        facing: 'west' as const,
        movementProfileId: 'ground',
      },
    ],
    battle: {
      combatants: [
        { id: 'actor', hp: 100, teamId: 'one' },
        { id: 'enemy', hp: 100, teamId: 'two' },
      ],
    },
  }
  it('does not extend a stale aimed circle to an enemy outside the current anchor range', () => {
    const reach = battleAttackReachTiles(
      board,
      origin,
      target,
      basic.effects,
      [{ x: 6, y: 3 }],
      { aimSource: 'player', selection: { kind: 'unit', combatantId: 'enemy' } },
      { tactical: board, actorId: 'actor' },
    )
    expect(reach.has('6:3')).toBe(false)
    expect(reach.has('4:3')).toBe(true)
    expect(reach.has('5:3')).toBe(true)
  })
  it.each(['elevation', 'line-of-sight'] as const)(
    'does not trust an old aimed footprint when its anchor fails %s',
    (boundary) => {
      const destination = boundary === 'elevation' ? { x: 4, y: 3 } : { x: 5, y: 3 }
      const changed = {
        ...board,
        tiles: board.tiles.map((tile) => ({
          ...tile,
          elevation:
            boundary === 'elevation' && tile.position.x === 4 && tile.position.y === 3 ? 1 : 0,
          terrainId:
            boundary === 'line-of-sight' && tile.position.x === 4 && tile.position.y === 3
              ? 'wall'
              : 'open',
        })),
      }
      const reach = battleAttackReachTiles(
        changed,
        origin,
        { ...target, maximumRange: boundary === 'elevation' ? 1 : 2 },
        basic.effects,
        [{ x: 6, y: 3 }],
        { aimSource: 'player', selection: { kind: 'tile', position: destination } },
        { tactical: changed, actorId: 'actor' },
      )
      expect(reach.has('6:3')).toBe(false)
      expect(reach.has('2:3')).toBe(true)
    },
  )
  it('keeps the full circle extent around a legal center beyond the center selection range', () => {
    expect([
      ...battleAttackReachTiles(
        board,
        origin,
        target,
        basic.effects,
        [
          { x: 4, y: 3 },
          { x: 5, y: 3 },
        ],
        { aimSource: 'player', selection: { kind: 'tile', position: { x: 4, y: 3 } } },
        { tactical: board, actorId: 'actor' },
      ),
    ]).toEqual(['4:3', '5:3'])
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

it.each([
  [
    { kind: 'single' },
    2,
    ['1:3', '2:2', '2:3', '2:4', '3:1', '3:2', '3:4', '3:5', '4:2', '4:3', '4:4', '5:3'],
  ],
  [{ kind: 'line', length: 2 }, 2, ['1:3', '2:3', '3:1', '3:2', '3:4', '3:5', '4:3', '5:3']],
  [{ kind: 'circle', radius: 1 }, 1, ['2:2', '2:3', '2:4', '3:2', '3:4', '4:2', '4:3', '4:4']],
] as const)(
  'keeps exact utility %j potential after forecast selection or unrelated occupancy changes',
  (shape, maximumRange, expected) => {
    const target = {
      ...basic.target,
      geometryVersion: 3 as const,
      categories: ['enemy' as const],
      shape,
      minimumRange: 1,
      maximumRange,
      maximumElevationDifference: null,
      requiresLineOfSight: false,
    }
    const placement = (combatantId: string, x: number, y: number) => ({
      combatantId,
      position: { x, y },
      facing: 'west' as const,
      movementProfileId: 'ground',
    })
    for (const placements of [
      [placement('actor', 3, 3)],
      [placement('actor', 3, 3), placement('enemy', 4, 3), placement('ally', 2, 3)],
      [placement('actor', 3, 3), placement('enemy', 0, 0), placement('ally', 6, 6)],
    ]) {
      const board = {
        ...tactical,
        terrains: [{ id: 'open', traversalCost: 1 }],
        placements,
        battle: {
          combatants: [
            { id: 'actor', hp: 100, teamId: 'one' },
            { id: 'ally', hp: 100, teamId: 'one' },
            { id: 'enemy', hp: 100, teamId: 'two' },
          ],
        },
      }
      const before = JSON.stringify(board)
      const spatial = { tactical: board, actorId: 'actor' }
      for (const aim of [
        { aimSource: 'implicit' as const },
        {
          aimSource: 'player' as const,
          selection: { kind: 'unit' as const, combatantId: 'enemy' },
        },
      ])
        expect(
          [...battleTargetReachTiles(board, origin, target, [{ x: 4, y: 3 }], aim, spatial)].sort(),
        ).toEqual(expected)
      expect(JSON.stringify(board)).toBe(before)
    }
  },
)

describe('Single status potential spatial legality', () => {
  const origin = { x: 1, y: 1 }
  const board = {
    width: 9,
    height: 7,
    tiles: Array.from({ length: 63 }, (_, index) => {
      const position = { x: index % 9, y: Math.floor(index / 9) }
      return {
        position,
        elevation: position.x === 4 && position.y === 1 ? 3 : 0,
        terrainId: position.x === 3 && position.y === 1 ? 'wall' : 'open',
      }
    }),
    terrains: [
      { id: 'open', traversalCost: 1 },
      { id: 'wall', traversalCost: null },
    ],
    placements: [
      {
        combatantId: 'actor',
        position: origin,
        facing: 'east' as const,
        movementProfileId: 'ground',
      },
      {
        combatantId: 'enemy',
        position: { x: 2, y: 1 },
        facing: 'west' as const,
        movementProfileId: 'ground',
      },
      {
        combatantId: 'ally',
        position: { x: 1, y: 2 },
        facing: 'east' as const,
        movementProfileId: 'ground',
      },
      {
        combatantId: 'defeated',
        position: { x: 8, y: 6 },
        facing: 'west' as const,
        movementProfileId: 'ground',
      },
    ],
    battle: {
      combatants: [
        { id: 'actor', hp: 100, teamId: 'one' },
        { id: 'enemy', hp: 100, teamId: 'two' },
        { id: 'ally', hp: 100, teamId: 'one' },
        { id: 'defeated', hp: 0, teamId: 'two' },
      ],
    },
  }
  const target = {
    ...basic.target,
    geometryVersion: 3 as const,
    categories: ['enemy' as const],
    minimumRange: 1,
    maximumRange: 15,
    maximumElevationDifference: 3,
    requiresLineOfSight: false,
  }
  const spatial = {
    tactical: board,
    actorId: 'actor',
    terrainOverlays: [{ kind: 'steam', position: { x: 1, y: 3 } }],
  }
  it('keeps every Single15 tile including empty height-three tiles without LOS', () => {
    const before = JSON.stringify(board)
    const reach = battleTargetReachTiles(
      board,
      origin,
      target,
      [],
      { aimSource: 'implicit' },
      spatial,
    )
    expect(reach.size).toBe(62)
    expect(reach.has('1:1')).toBe(false)
    expect(reach.has('4:1')).toBe(true)
    expect(reach.has('8:6')).toBe(true)
    expect(reach.has('1:4')).toBe(true)
    expect(
      battleTargetReachTiles(
        board,
        origin,
        target,
        [{ x: 2, y: 1 }],
        {
          aimSource: 'player',
          selection: { kind: 'unit', combatantId: 'enemy' },
        },
        spatial,
      ),
    ).toEqual(reach)
    expect(JSON.stringify(board)).toBe(before)
  })
  it('retains authored elevation and LOS exclusions instead of broadening legality', () => {
    const elevation = battleTargetReachTiles(
      board,
      origin,
      { ...target, maximumElevationDifference: 1 },
      [],
      { aimSource: 'implicit' },
      spatial,
    )
    expect(elevation.has('4:1')).toBe(false)
    expect(elevation.has('5:1')).toBe(true)
    const visible = battleTargetReachTiles(
      board,
      origin,
      { ...target, requiresLineOfSight: true },
      [],
      { aimSource: 'implicit' },
      spatial,
    )
    expect(visible.has('2:1')).toBe(true)
    expect(visible.has('4:1')).toBe(false)
    expect(visible.has('5:1')).toBe(false)
    expect(visible.has('1:4')).toBe(false)
    expect(visible.has('0:1')).toBe(true)
  })
  it('keeps living occupancy exclusions for Empty Tile while defeated units free tiles', () => {
    const reach = battleTargetReachTiles(
      board,
      origin,
      { ...target, kind: 'empty-tile', categories: ['ground'] },
      [],
      { aimSource: 'implicit' },
      spatial,
    )
    expect(reach.has('2:1')).toBe(false)
    expect(reach.has('1:2')).toBe(false)
    expect(reach.has('8:6')).toBe(true)
    expect(reach.has('0:1')).toBe(true)
  })
})
