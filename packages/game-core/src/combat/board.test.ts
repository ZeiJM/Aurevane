import { describe, expect, it } from 'vitest'

import {
  createPendingBattle,
  spendAction,
  startBattle,
  type BattleState,
  type CreatePendingBattleInput,
} from './battle-state'
import {
  P2_2_ORDINARY_GROUND_PROFILE,
  P2_2_VERTICAL_SLICE_TERRAINS,
  classifyFacingRelation,
  createTacticalBattleState,
  evaluateCurrentMovementPath,
  moveCurrentCombatant,
  selectCurrentFinalFacing,
  validateTacticalBattleState,
  type CombatTile,
  type GridPosition,
  type TacticalBattleState,
} from './board'

function battleInput(): CreatePendingBattleInput {
  return {
    battleId: 'p2-2-board-test',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 0x10203040,
    combatants: [
      {
        id: 'wayfarer',
        teamId: 'players',
        initiative: 12,
        baseMovementBudget: 4,
        hp: 164,
        maxHp: 164,
        mp: 90,
        maxMp: 90,
      },
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: 8,
        baseMovementBudget: 3,
        hp: 120,
        maxHp: 120,
        mp: 30,
        maxMp: 30,
      },
    ],
  }
}

function tile(
  x: number,
  y: number,
  terrainId = 'open-ground',
  elevation = 0,
): CombatTile {
  return { position: { x, y }, elevation, terrainId }
}

function rectangularTiles(width = 4, height = 3): CombatTile[] {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => tile(x, y)),
  ).flat()
}

function activeTacticalBattle(options?: {
  tiles?: readonly CombatTile[]
  wayfarerPosition?: GridPosition
  recruitPosition?: GridPosition
  battle?: BattleState
}): TacticalBattleState {
  const battle = options?.battle ?? startBattle(createPendingBattle(battleInput())).state

  return createTacticalBattleState({
    battle,
    width: 4,
    height: 3,
    terrains: P2_2_VERTICAL_SLICE_TERRAINS,
    tiles: options?.tiles ?? rectangularTiles(),
    movementProfiles: [P2_2_ORDINARY_GROUND_PROFILE],
    placements: [
      {
        combatantId: 'wayfarer',
        position: options?.wayfarerPosition ?? { x: 0, y: 1 },
        facing: 'east',
        movementProfileId: 'ordinary-ground',
      },
      {
        combatantId: 'recruit',
        position: options?.recruitPosition ?? { x: 3, y: 1 },
        facing: 'west',
        movementProfileId: 'ordinary-ground',
      },
    ],
  })
}

function withBattle(state: TacticalBattleState, battle: BattleState): TacticalBattleState {
  return createTacticalBattleState({ ...state, battle })
}

describe('P2.2 tactical board legality', () => {
  it('normalizes board data into stable deterministic ordering', () => {
    const state = createTacticalBattleState({
      battle: startBattle(createPendingBattle(battleInput())).state,
      width: 2,
      height: 2,
      terrains: [...P2_2_VERTICAL_SLICE_TERRAINS].reverse(),
      tiles: [tile(1, 1), tile(0, 1), tile(1, 0), tile(0, 0)],
      movementProfiles: [
        {
          id: 'ordinary-ground',
          maxElevationStep: 1,
          terrainCostOverrides: [
            { terrainId: 'rough-ground', traversalCost: 1 },
            { terrainId: 'open-ground', traversalCost: 1 },
          ],
        },
      ],
      placements: [
        {
          combatantId: 'recruit',
          position: { x: 1, y: 1 },
          facing: 'west',
          movementProfileId: 'ordinary-ground',
        },
        {
          combatantId: 'wayfarer',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'ordinary-ground',
        },
      ],
    })

    expect(state.terrains.map((terrain) => terrain.id)).toEqual([
      'blocked',
      'open-ground',
      'rough-ground',
    ])
    expect(state.tiles.map((entry) => entry.position)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
    expect(state.placements.map((placement) => placement.combatantId)).toEqual([
      'recruit',
      'wayfarer',
    ])
    expect(state.movementProfiles[0].terrainCostOverrides.map((entry) => entry.terrainId)).toEqual([
      'open-ground',
      'rough-ground',
    ])
    expect(validateTacticalBattleState(state)).toEqual([])
    expect(JSON.stringify(state)).toBe(
      JSON.stringify(
        createTacticalBattleState({
          battle: startBattle(createPendingBattle(battleInput())).state,
          width: 2,
          height: 2,
          terrains: [...P2_2_VERTICAL_SLICE_TERRAINS].reverse(),
          tiles: [tile(1, 1), tile(0, 1), tile(1, 0), tile(0, 0)],
          movementProfiles: [
            {
              id: 'ordinary-ground',
              maxElevationStep: 1,
              terrainCostOverrides: [
                { terrainId: 'rough-ground', traversalCost: 1 },
                { terrainId: 'open-ground', traversalCost: 1 },
              ],
            },
          ],
          placements: [
            {
              combatantId: 'recruit',
              position: { x: 1, y: 1 },
              facing: 'west',
              movementProfileId: 'ordinary-ground',
            },
            {
              combatantId: 'wayfarer',
              position: { x: 0, y: 0 },
              facing: 'east',
              movementProfileId: 'ordinary-ground',
            },
          ],
        }),
      ),
    )
  })

  it('prices an authoritative orthogonal path from terrain costs and commits it', () => {
    const tiles = rectangularTiles().map((entry) =>
      entry.position.x === 1 && entry.position.y === 1
        ? { ...entry, terrainId: 'rough-ground' }
        : entry,
    )
    const state = activeTacticalBattle({ tiles })
    const path = [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]

    expect(evaluateCurrentMovementPath(state, path)).toEqual({
      legal: true,
      combatantId: 'wayfarer',
      path,
      cost: 3,
      destination: { x: 2, y: 1 },
      movementRemainingBefore: 4,
      movementRemainingAfter: 1,
      issues: [],
    })

    const moved = moveCurrentCombatant(state, path)
    expect(moved.state.battle.currentTurn).toMatchObject({
      movementMaximum: 4,
      movementRemaining: 1,
      movementSpent: 3,
      actionState: 'ready',
    })
    expect(
      moved.state.placements.find((placement) => placement.combatantId === 'wayfarer')?.position,
    ).toEqual({ x: 2, y: 1 })
    expect(moved.events).toEqual([
      {
        event: 'movement_spent',
        combatantId: 'wayfarer',
        amount: 3,
        remaining: 1,
      },
      {
        event: 'combatant_moved',
        combatantId: 'wayfarer',
        from: { x: 0, y: 1 },
        to: { x: 2, y: 1 },
        movementCost: 3,
      },
    ])
  })

  it('preserves split movement after the P2.1 Action has been spent', () => {
    let state = activeTacticalBattle()

    state = moveCurrentCombatant(state, [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]).state
    state = withBattle(state, spendAction(state.battle).state)
    state = moveCurrentCombatant(state, [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
    ]).state

    expect(state.battle.currentTurn).toMatchObject({
      movementMaximum: 4,
      movementRemaining: 2,
      movementSpent: 2,
      actionState: 'spent',
    })
    expect(
      state.placements.find((placement) => placement.combatantId === 'wayfarer')?.position,
    ).toEqual({ x: 1, y: 0 })
  })

  it.each([
    {
      name: 'authoritative start mismatch',
      state: () => activeTacticalBattle(),
      path: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ],
      code: 'start-mismatch',
    },
    {
      name: 'non-adjacent step',
      state: () => activeTacticalBattle(),
      path: [
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ],
      code: 'non-adjacent-step',
    },
    {
      name: 'out-of-bounds step',
      state: () => activeTacticalBattle(),
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
      ],
      code: 'out-of-bounds',
    },
    {
      name: 'occupied destination',
      state: () => activeTacticalBattle({ recruitPosition: { x: 1, y: 1 } }),
      path: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      code: 'occupied-tile',
    },
    {
      name: 'blocked terrain',
      state: () =>
        activeTacticalBattle({
          tiles: rectangularTiles().map((entry) =>
            entry.position.x === 1 && entry.position.y === 1
              ? { ...entry, terrainId: 'blocked' }
              : entry,
          ),
        }),
      path: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      code: 'blocked-terrain',
    },
    {
      name: 'excess elevation step',
      state: () =>
        activeTacticalBattle({
          tiles: rectangularTiles().map((entry) =>
            entry.position.x === 1 && entry.position.y === 1 ? { ...entry, elevation: 2 } : entry,
          ),
        }),
      path: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      code: 'elevation-step-too-high',
    },
    {
      name: 'movement budget exceeded',
      state: () =>
        activeTacticalBattle({
          tiles: rectangularTiles().map((entry) =>
            entry.position.y === 0 ? { ...entry, terrainId: 'rough-ground' } : entry,
          ),
        }),
      path: [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      code: 'movement-budget-exceeded',
    },
  ])('rejects $name with a stable movement reason', ({ state, path, code }) => {
    const preview = evaluateCurrentMovementPath(state(), path)

    expect(preview.legal).toBe(false)
    expect(preview.issues[0]?.code).toBe(code)
    expect(() => moveCurrentCombatant(state(), path)).toThrow(`Illegal movement path: ${code}`)
  })

  it('rejects a path that does not actually move', () => {
    const state = activeTacticalBattle()
    const preview = evaluateCurrentMovementPath(state, [{ x: 0, y: 1 }])

    expect(preview.legal).toBe(false)
    expect(preview.issues[0]?.code).toBe('path-too-short')
  })

  it('supports profile-specific terrain costs without changing terrain identity', () => {
    const state = createTacticalBattleState({
      ...activeTacticalBattle({
        tiles: rectangularTiles().map((entry) =>
          entry.position.x === 1 && entry.position.y === 1
            ? { ...entry, terrainId: 'rough-ground' }
            : entry,
        ),
      }),
      movementProfiles: [
        {
          id: 'ordinary-ground',
          maxElevationStep: 1,
          terrainCostOverrides: [{ terrainId: 'rough-ground', traversalCost: 1 }],
        },
      ],
    })

    expect(
      evaluateCurrentMovementPath(state, [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
      ]),
    ).toMatchObject({ legal: true, cost: 2, movementRemainingAfter: 2 })
  })

  it('selects final facing through the same P2.1 turn state and placement snapshot', () => {
    const state = activeTacticalBattle()
    const faced = selectCurrentFinalFacing(state, 'north')

    expect(faced.state.battle.currentTurn?.finalFacing).toBe('north')
    expect(
      faced.state.placements.find((placement) => placement.combatantId === 'wayfarer')?.facing,
    ).toBe('north')
    expect(faced.events).toEqual([
      { event: 'final_facing_selected', combatantId: 'wayfarer', facing: 'north' },
      { event: 'combatant_facing_changed', combatantId: 'wayfarer', facing: 'north' },
    ])
  })

  it.each([
    ['north', { x: 2, y: 1 }, 'front'],
    ['north', { x: 2, y: 3 }, 'rear'],
    ['north', { x: 3, y: 2 }, 'side'],
    ['south', { x: 2, y: 3 }, 'front'],
    ['south', { x: 2, y: 1 }, 'rear'],
    ['south', { x: 1, y: 2 }, 'side'],
    ['east', { x: 3, y: 2 }, 'front'],
    ['east', { x: 1, y: 2 }, 'rear'],
    ['east', { x: 2, y: 1 }, 'side'],
    ['west', { x: 1, y: 2 }, 'front'],
    ['west', { x: 3, y: 2 }, 'rear'],
    ['west', { x: 2, y: 3 }, 'side'],
  ] as const)('classifies %s-facing source position as %s', (facing, source, relation) => {
    expect(classifyFacingRelation({ x: 2, y: 2 }, facing, source)).toBe(relation)
  })

  it('fails closed on incomplete boards, duplicate occupancy and blocked spawn terrain', () => {
    const valid = activeTacticalBattle()
    const missingTile: TacticalBattleState = { ...valid, tiles: valid.tiles.slice(1) }
    expect(validateTacticalBattleState(missingTile)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'tiles', message: expect.stringContaining('exactly cover') }),
      ]),
    )

    expect(() =>
      createTacticalBattleState({
        ...valid,
        placements: valid.placements.map((placement) => ({
          ...placement,
          position: { x: 0, y: 0 },
        })),
      }),
    ).toThrow('Two combatants cannot share a tile')

    expect(() =>
      createTacticalBattleState({
        ...valid,
        tiles: valid.tiles.map((entry) =>
          entry.position.x === 0 && entry.position.y === 1
            ? { ...entry, terrainId: 'blocked' }
            : entry,
        ),
      }),
    ).toThrow('Combatant cannot occupy terrain blocked')
  })
})
