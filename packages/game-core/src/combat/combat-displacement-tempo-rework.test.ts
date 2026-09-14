import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  evaluateCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, type GridPosition } from './board'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMovement,
  executePv1fMovement,
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

import { movementApCostForTile } from './pv1f-skills'

const OPEN = 'open'
const ROUGH = 'rough'

function combatEncounter(input?: {
  actor?: GridPosition
  enemy?: GridPosition
  blocker?: GridPosition
}): CombatEncounterState {
  const actor = input?.actor ?? { x: 1, y: 1 }
  const enemy = input?.enemy ?? { x: 2, y: 1 }
  const blocker = input?.blocker ?? { x: 6, y: 0 }
  const battle = startBattle(
    createPendingBattle({
      battleId: 'combat-displacement-tempo-rework',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x2468ace1,
      combatants: [
        combatant('actor', 'players', 30),
        combatant('enemy', 'enemies', 20),
        combatant('blocker', 'enemies', 10),
      ],
    }),
  ).state

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 7,
      height: 3,
      terrains: [
        { id: OPEN, traversalCost: 1 },
        { id: ROUGH, traversalCost: 2 },
      ],
      tiles: Array.from({ length: 21 }, (_, index) => ({
        position: { x: index % 7, y: Math.floor(index / 7) },
        elevation: 0,
        terrainId: OPEN,
      })),
      movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
      placements: [
        placement('actor', actor),
        placement('enemy', enemy),
        placement('blocker', blocker),
      ],
    }),
  )
}

function movementEncounter(terrain = OPEN): StatDrivenCombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'combat-tempo-movement',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 0x13572468,
      combatants: [combatant('actor', 'players', 20), combatant('enemy', 'enemies', 10)],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 4,
    height: 2,
    terrains: [
      { id: OPEN, traversalCost: 1 },
      { id: ROUGH, traversalCost: 2 },
    ],
    tiles: Array.from({ length: 8 }, (_, index) => ({
      position: { x: index % 4, y: Math.floor(index / 4) },
      elevation: 0,
      terrainId: index === 4 ? terrain : OPEN,
    })),
    movementProfiles: [{ id: 'ground', maxElevationStep: 1, terrainCostOverrides: [] }],
    placements: [placement('actor', { x: 1, y: 1 }), placement('enemy', { x: 3, y: 1 })],
  })
  return createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    ['actor', 'enemy'].map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario' as const, sourceId: 'scenario:tempo', sourceRulesVersion: 1 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
}

function combatant(id: string, teamId: string, initiative: number) {
  return {
    id,
    teamId,
    initiative,
    baseMovementBudget: 4,
    hp: 100,
    maxHp: 100,
    mp: 20,
    maxMp: 20,
    temporaryResources: createPv1fTemporaryResources(10),
  }
}

function placement(combatantId: string, position: GridPosition) {
  return {
    combatantId,
    position,
    facing: 'east' as const,
    movementProfileId: 'ground',
  }
}

function displace(
  direction: 'push' | 'pull' | undefined,
  distance: number,
): CombatActionDefinition {
  const effect: Record<string, unknown> = {
    type: 'displace',
    recipient: 'primary-unit',
    distance,
  }
  if (direction) effect.direction = direction
  return {
    id: `test.${direction ?? 'historical-push'}.${distance}`,
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 6,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [effect],
  } as unknown as CombatActionDefinition
}

function withStatus<T extends CombatEncounterState>(
  state: T,
  combatantId: string,
  statusId: string,
): T {
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === combatantId
        ? {
            ...row,
            statuses: [
              ...row.statuses.filter((status) => status.statusId !== statusId),
              {
                statusId,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
            ].sort((left, right) => left.statusId.localeCompare(right.statusId)),
          }
        : row,
    ),
  }
}

function at(state: CombatEncounterState, combatantId: string): GridPosition {
  return state.tactical.placements.find((row) => row.combatantId === combatantId)!.position
}

function hasStatus(state: CombatEncounterState, combatantId: string, statusId: string): boolean {
  return Boolean(
    state.statusState
      .find((row) => row.combatantId === combatantId)
      ?.statuses.some((status) => status.statusId === statusId),
  )
}

function path(): readonly GridPosition[] {
  return [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
}

function withFrozenDestination<T extends CombatEncounterState>(state: T): T {
  return {
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
}

describe('Task 2 variable Push and Pull', () => {
  it('keeps historical directionless distance-1 displacement as Push 1', () => {
    const result = executeCombatAction(
      combatEncounter(),
      displace(undefined, 1),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 3, y: 1 })
    expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(true)
  })

  it('pushes stepwise for the full authored distance when every tile is legal', () => {
    const result = executeCombatAction(
      combatEncounter(),
      displace('push', 3),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 5, y: 1 })
    expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(true)
  })

  it('pulls stepwise toward the caster without crossing the caster tile', () => {
    const result = executeCombatAction(
      combatEncounter({ enemy: { x: 5, y: 1 } }),
      displace('pull', 3),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 2, y: 1 })
    expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(true)
  })

  it('stops a Pull before the caster and applies no Displaced when zero tiles are traversed', () => {
    const state = combatEncounter({ enemy: { x: 2, y: 1 } })
    const result = executeCombatAction(
      state,
      displace('pull', 3),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 2, y: 1 })
    expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(false)
  })

  it('stops before an occupied intermediate tile while keeping prior legal movement', () => {
    const result = executeCombatAction(
      combatEncounter({ actor: { x: 0, y: 1 }, enemy: { x: 2, y: 1 }, blocker: { x: 4, y: 1 } }),
      displace('push', 3),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 3, y: 1 })
    expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(true)
  })

  it('Root prevents every displacement step and therefore does not apply Displaced', () => {
    const state = withStatus(combatEncounter(), 'enemy', 'root')
    const result = executeCombatAction(
      state,
      displace('push', 2),
      { kind: 'unit', combatantId: 'enemy' },
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 2, y: 1 })
    expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(false)
  })
})

describe('Task 2 Haste and Slow movement AP', () => {
  it('keeps the normal and Slow baselines while Haste reduces AP per entered tile', () => {
    const normal = evaluatePv1fMovement(movementEncounter(), path())
    const haste = evaluatePv1fMovement(withStatus(movementEncounter(), 'actor', 'haste'), path())
    const slow = evaluatePv1fMovement(withStatus(movementEncounter(), 'actor', 'slow'), path())
    const both = evaluatePv1fMovement(
      withStatus(withStatus(movementEncounter(), 'actor', 'haste'), 'actor', 'slow'),
      path(),
    )

    expect(normal.economyCost).toBe(20)
    expect(haste.economyCost).toBe(10)
    expect(slow.economyCost).toBe(30)
    expect(both.economyCost).toBe(20)
    expect(normal.movement.cost).toBe(1)
    expect(haste.movement.cost).toBe(1)
    expect(slow.movement.cost).toBe(1)
  })

  it('applies Haste after terrain traversal cost without changing Movement allowance', () => {
    const rough = evaluatePv1fMovement(movementEncounter(ROUGH), path())
    const roughHaste = evaluatePv1fMovement(
      withStatus(movementEncounter(ROUGH), 'actor', 'haste'),
      path(),
    )
    expect(rough.economyCost).toBe(40)
    expect(roughHaste.economyCost).toBe(30)
    expect(roughHaste.movement.cost).toBe(2)
  })

  it('combines Frozen, Slow, Airborne and Haste in the approved per-tile order', () => {
    const frozenSlow = evaluatePv1fMovement(
      withStatus(withFrozenDestination(movementEncounter()), 'actor', 'slow'),
      path(),
    )
    const airborneHaste = evaluatePv1fMovement(
      withStatus(
        withStatus(withFrozenDestination(movementEncounter()), 'actor', 'airborne'),
        'actor',
        'haste',
      ),
      path(),
    )
    expect(frozenSlow.economyCost).toBe(40)
    expect(airborneHaste.economyCost).toBe(10)
  })

  it('does not reinterpret historical Hastened as movement Haste', () => {
    const historical = evaluatePv1fMovement(
      withStatus(movementEncounter(), 'actor', 'hastened'),
      path(),
    )
    expect(historical.economyCost).toBe(20)
  })

  it('Root still blocks movement regardless of Haste', () => {
    const state = withStatus(withStatus(movementEncounter(), 'actor', 'haste'), 'actor', 'root')
    const preview = evaluatePv1fMovement(state, path())
    expect(preview.movement.legal).toBe(false)
    expect(preview.movement.issues).toContainEqual(
      expect.objectContaining({ code: 'status-restricted' }),
    )
  })
})

describe('displacement edge cases and preview parity', () => {
  it('recalculates the dominant axis at every diagonal Pull step with horizontal ties', () => {
    const state = combatEncounter({ actor: { x: 1, y: 0 }, enemy: { x: 4, y: 2 } })
    const action = displace('pull', 4)
    const selection = { kind: 'unit' as const, combatantId: 'enemy' }
    const preview = evaluateCombatAction(state, action, selection, PV1F_COMBAT_CONTENT)
    const result = executeCombatAction(
      JSON.parse(JSON.stringify(state)),
      action,
      selection,
      PV1F_COMBAT_CONTENT,
    )
    expect(at(result.state, 'enemy')).toEqual({ x: 1, y: 1 })
    expect(preview.projectedEffects[0]).toMatchObject({ before: '4,2', after: '1,1' })
    expect(preview.projectedEvents).toEqual(
      result.events.filter((event) => event.event !== 'combat_action_used'),
    )
    expect(at(state, 'enemy')).toEqual({ x: 4, y: 2 })
  })

  it.each(['blocked', 'elevated', 'edge'] as const)(
    'keeps legal earlier Push steps before %s',
    (obstacle) => {
      let state = combatEncounter({ enemy: { x: obstacle === 'edge' ? 5 : 2, y: 1 } })
      if (obstacle !== 'edge')
        state = {
          ...state,
          tactical: {
            ...state.tactical,
            terrains: [{ id: 'blocked', traversalCost: null }, ...state.tactical.terrains],
            tiles: state.tactical.tiles.map((tile) =>
              tile.position.x === 4 && tile.position.y === 1
                ? {
                    ...tile,
                    terrainId: obstacle === 'blocked' ? 'blocked' : tile.terrainId,
                    elevation: obstacle === 'elevated' ? 2 : 0,
                  }
                : tile,
            ),
          },
        }
      const result = executeCombatAction(
        state,
        displace('push', 3),
        { kind: 'unit', combatantId: 'enemy' },
        PV1F_COMBAT_CONTENT,
      )
      expect(at(result.state, 'enemy')).toEqual({ x: obstacle === 'edge' ? 6 : 3, y: 1 })
      expect(hasStatus(result.state, 'enemy', 'displaced')).toBe(true)
    },
  )

  it('resolves area recipients in stable order against updated occupancy', () => {
    const state = combatEncounter({
      actor: { x: 0, y: 1 },
      enemy: { x: 2, y: 1 },
      blocker: { x: 4, y: 1 },
    })
    const base = displace('pull', 3)
    const action: CombatActionDefinition = {
      ...base,
      target: { ...base.target, shape: { kind: 'circle', radius: 3 } },
      effects: [{ type: 'displace', recipient: 'affected-units', direction: 'pull', distance: 3 }],
    }
    const selection = { kind: 'unit' as const, combatantId: 'enemy' }
    const result = executeCombatAction(state, action, selection, PV1F_COMBAT_CONTENT)
    expect(at(result.state, 'blocker')).toEqual({ x: 3, y: 1 })
    expect(at(result.state, 'enemy')).toEqual({ x: 1, y: 1 })
    const positions = result.state.tactical.placements.map(
      (row) => `${row.position.x},${row.position.y}`,
    )
    expect(new Set(positions).size).toBe(positions.length)
    expect(
      evaluateCombatAction(state, action, selection, PV1F_COMBAT_CONTENT).projectedEffects.map(
        (effect) => effect.after,
      ),
    ).toEqual(['3,1', '1,1'])
  })

  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects malformed distance %s before execution',
    (distance) => {
      expect(() =>
        executeCombatAction(
          combatEncounter(),
          displace('pull', distance),
          { kind: 'unit', combatantId: 'enemy' },
          PV1F_COMBAT_CONTENT,
        ),
      ).toThrow(/distance/i)
    },
  )
})

describe('movement AP floor and committed resources', () => {
  it.each([
    [1, -10, 10],
    [1, -20, 10],
    [2, -20, 20],
    [2, -50, 10],
    [1, 20, 40],
    [2, 0, 40],
  ])('charges terrain %i plus delta %i as %i AP', (traversal, delta, expected) => {
    expect(movementApCostForTile(traversal, delta)).toBe(expected)
  })
  it('charges the same Haste AP in preview and commit and preserves Movement consumption', () => {
    const state = withStatus(movementEncounter(), 'actor', 'haste')
    const before = JSON.stringify(state)
    const preview = evaluatePv1fMovement(state, path())
    const result = executePv1fMovement(state, path())
    expect(preview.economyCost).toBe(10)
    expect(readPv1fActionEconomy(result.state)?.current).toBe(90)
    expect(result.state.tactical.battle.currentTurn?.movementRemaining).toBe(3)
    expect(JSON.stringify(state)).toBe(before)
  })
})
