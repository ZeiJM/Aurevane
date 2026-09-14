import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, type GridPosition } from './board'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMovement,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

const OPEN = 'open'
const ROUGH = 'rough'

// prettier-ignore
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

// prettier-ignore
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

// prettier-ignore
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

// prettier-ignore
function placement(combatantId: string, position: GridPosition) {
  return {
    combatantId,
    position,
    facing: 'east' as const,
    movementProfileId: 'ground',
  }
}

// prettier-ignore
function displace(direction: 'push' | 'pull' | undefined, distance: number): CombatActionDefinition {
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

// prettier-ignore
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

// prettier-ignore
function at(state: CombatEncounterState, combatantId: string): GridPosition {
  return state.tactical.placements.find((row) => row.combatantId === combatantId)!.position
}

// prettier-ignore
function hasStatus(state: CombatEncounterState, combatantId: string, statusId: string): boolean {
  return Boolean(
    state.statusState
      .find((row) => row.combatantId === combatantId)
      ?.statuses.some((status) => status.statusId === statusId),
  )
}

// prettier-ignore
function path(): readonly GridPosition[] {
  return [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
}

// prettier-ignore
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

// prettier-ignore
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

// prettier-ignore
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
