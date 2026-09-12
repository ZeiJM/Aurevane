import { createPendingBattle, startBattle } from '@aurevane/game-core/combat/battle-state'
import { createTacticalBattleState } from '@aurevane/game-core/combat/board'
import {
  createCombatEncounterState,
  type CombatEncounterState,
} from '@aurevane/game-core/combat/actions'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { createPvpQualityResources } from '@aurevane/game-core/combat/pvp-quality'
import {
  createPv1fTemporaryResources,
  PV1F_COMBAT_CONTENT,
  evaluatePv1fMovement,
} from '@aurevane/game-core/combat/pv1f-action-economy'
import { describe, expect, it } from 'vitest'

import { buildReachablePaths, retractProjectedPath } from './battle-geometry'

describe('retractProjectedPath', () => {
  const path = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
  ] as const

  it('retracts to an earlier projected tile without committing movement', () => {
    expect(retractProjectedPath(path, { x: 1, y: 1 })).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
  })

  it('retracts all the way to zero projected movement at the committed origin', () => {
    expect(retractProjectedPath(path, { x: 0, y: 1 })).toEqual([])
  })

  it('does not treat the current projected tip or an unrelated tile as retraction', () => {
    expect(retractProjectedPath(path, { x: 3, y: 1 })).toBeNull()
    expect(retractProjectedPath(path, { x: 4, y: 1 })).toBeNull()
  })
})

function encounter(): StatDrivenCombatEncounterState {
  const ids = ['actor', 'enemy', 'other', 'ally']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'phase4-effects',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || id === 'ally' ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 5,
        hp: 25,
        maxHp: 50,
        mp: 10,
        maxMp: 20,
        temporaryResources: [
          ...createPv1fTemporaryResources(10),
          ...createPvpQualityResources(),
        ].sort((a, b) => a.key.localeCompare(b.key)),
      })),
    }),
  ).state
  const positions = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
  ]
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 4,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 20 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, i) => ({
          combatantId,
          position: positions[i]!,
          facing: 'west' as const,
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:phase4', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}
function withStatus<T extends CombatEncounterState>(
  state: T,
  owner: string,
  statusId: string,
  source = 'actor',
): T {
  const definition = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === statusId)!
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === owner
        ? {
            ...row,
            statuses: [
              ...row.statuses.filter((status) => status.statusId !== statusId),
              {
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: definition?.durationOwnerTurnStarts ?? 2,
                sourceCombatantId: source,
              },
            ].sort((a, b) => a.statusId.localeCompare(b.statusId)),
          }
        : row,
    ),
  }
}

describe('authoritative movement highlights', () => {
  it.each([
    [[], true, 20, false],
    [['slow'], false, 20, false],
    [['root'], false, 100, false],
    [['airborne'], true, 20, true],
    [['airborne', 'slow'], true, 20, false],
  ] as [string[], boolean, number, boolean][])(
    'respects statuses %j, Frozen %j and %i AP',
    (statuses, frozen, ap, expected) => {
      let state = encounter()
      for (const status of statuses) state = withStatus(state, 'actor', status)
      if (frozen)
        state = {
          ...state,
          terrainOverlays: [
            {
              kind: 'frozen',
              position: { x: 1, y: 0 },
              remainingRoundBoundaries: 2,
              sourceCombatantId: 'actor',
            },
          ],
        }
      expect(buildReachablePaths(state, state.tactical.placements[0]!, ap).has('1:0')).toBe(
        expected,
      )
    },
  )

  it('keeps only paths accepted by the authoritative cost and Movement rules', () => {
    let state = withStatus(encounter(), 'actor', 'slow')
    state = {
      ...state,
      terrainOverlays: [
        {
          kind: 'frozen',
          position: { x: 0, y: 1 },
          remainingRoundBoundaries: 2,
          sourceCombatantId: 'actor',
        },
      ],
    }
    const paths = buildReachablePaths(state, state.tactical.placements[0]!, 70)
    expect(paths.has('0:0')).toBe(true)
    for (const path of paths.values()) {
      if (path.length < 2) continue
      const evaluation = evaluatePv1fMovement(state, path)
      expect(evaluation.movement.legal).toBe(true)
      expect(evaluation.economyCost).toBeLessThanOrEqual(70)
    }
  })

  it('never exchanges spare AP for extra Movement', () => {
    const state = encounter()
    state.tactical.battle.currentTurn!.movementRemaining = 1
    expect(buildReachablePaths(state, state.tactical.placements[0]!, 100).has('0:0')).toBe(false)
  })
})

it('retains both AP-cheaper and Movement-cheaper routes through a merge', () => {
  const base = encounter()
  const state = {
    ...base,
    tactical: {
      ...base.tactical,
      terrains: [
        ...base.tactical.terrains,
        { id: 'rough', traversalCost: 2 },
        { id: 'wall', traversalCost: null },
      ],
      placements: base.tactical.placements.map((row, i) => ({
        ...row,
        position: i === 0 ? { x: 0, y: 0 } : { x: i + 1, y: 3 },
      })),
      tiles: base.tactical.tiles.map((tile) => ({
        ...tile,
        terrainId:
          tile.position.x === 1 && tile.position.y === 1
            ? 'wall'
            : tile.position.x === 0 && tile.position.y === 1
              ? 'rough'
              : tile.position.x > 2 && tile.position.y < 2
                ? 'wall'
                : 'open',
      })),
    },
    terrainOverlays: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ].map((position) => ({
      kind: 'frozen' as const,
      position,
      remainingRoundBoundaries: 2,
      sourceCombatantId: 'actor',
    })),
  }
  const placement = state.tactical.placements[0]!
  // Top: 4 Movement / 110 AP. Bottom: 5 Movement / 100 AP.
  const affordable = buildReachablePaths(state, placement, 100).get('2:2')!
  expect(evaluatePv1fMovement(state, affordable).economyCost).toBe(100)
  expect(evaluatePv1fMovement(state, affordable).movement.cost).toBe(5)
  // A hypothetical larger AP budget still must preserve the shorter Movement route
  // through the merge to reach the next tile within the unchanged 5 Movement cap.
  const extended = buildReachablePaths(state, placement, 130).get('3:2')!
  expect(evaluatePv1fMovement(state, extended).economyCost).toBe(130)
  expect(evaluatePv1fMovement(state, extended).movement.cost).toBe(5)
})
