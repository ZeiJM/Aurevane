import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { advanceCurrentPoisonMovement } from './combat-dots'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

function encounter(targetHp = 30): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-poison-movement',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 73,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 10,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 10,
          hp: targetHp,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state

  return {
    ...createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 6,
        height: 1,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 6 }, (_, x) => ({
          position: { x, y: 0 },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: [
          {
            combatantId: 'actor',
            position: { x: 0, y: 0 },
            facing: 'east',
            movementProfileId: 'ground',
          },
          {
            combatantId: 'target',
            position: { x: 1, y: 0 },
            facing: 'west',
            movementProfileId: 'ground',
          },
        ],
      }),
    ),
    effectState: {
      ongoingRecovery: [],
      poison: [
        {
          targetCombatantId: 'target',
          sourceCombatantId: 'actor',
          sourceActionId: 'test.poison-source',
          profileVersion: 1,
          movementRemainder: 4,
        },
      ],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    },
  }
}

function withTargetX(state: CombatEncounterState, x: number): CombatEncounterState {
  return {
    ...state,
    tactical: {
      ...state.tactical,
      placements: state.tactical.placements.map((placement) =>
        placement.combatantId === 'target'
          ? { ...placement, position: { x, y: placement.position.y } }
          : placement,
      ),
    },
  }
}

function displace(direction: 'push' | 'pull', distance: number): CombatActionDefinition {
  return {
    id: `test.${direction}.${distance}`,
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 5,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'displace', recipient: 'primary-unit', direction, distance }],
  }
}

function targetHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((row) => row.id === 'target')!.hp
}

function targetX(state: CombatEncounterState): number {
  return state.tactical.placements.find((row) => row.combatantId === 'target')!.position.x
}

describe('current Poison movement progress', () => {
  it('carries remainders and returns one trigger for every five traversed tiles', () => {
    const first = advanceCurrentPoisonMovement(encounter(), 'target', 1)
    expect(first.triggeredTicks).toBe(1)
    expect(first.state.effectState?.poison[0]?.movementRemainder).toBe(0)

    const ten = advanceCurrentPoisonMovement(
      {
        ...encounter(),
        effectState: {
          ...encounter().effectState!,
          poison: encounter().effectState!.poison.map((row) => ({ ...row, movementRemainder: 0 })),
        },
      },
      'target',
      10,
    )
    expect(ten.triggeredTicks).toBe(2)
    expect(ten.state.effectState?.poison[0]?.movementRemainder).toBe(0)
  })

  it('counts each successful Push tile and applies a normal Poison tick at the threshold', () => {
    const result = executeCombatAction(
      encounter(),
      displace('push', 2),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(targetX(result.state)).toBe(3)
    expect(targetHp(result.state)).toBe(28)
    expect(result.state.effectState?.poison[0]?.movementRemainder).toBe(1)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        actionId: 'status.poison.current.v1',
        targetCombatantId: 'target',
        amount: 2,
      }),
    )
  })

  it('counts each successful Pull tile and preserves the caster-tile stop rule', () => {
    const result = executeCombatAction(
      withTargetX(encounter(), 3),
      displace('pull', 3),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(targetX(result.state)).toBe(1)
    expect(targetHp(result.state)).toBe(28)
    expect(result.state.effectState?.poison[0]?.movementRemainder).toBe(1)
  })

  it('stops displacement immediately when a movement-triggered Poison tick defeats the unit', () => {
    const result = executeCombatAction(
      encounter(2),
      displace('push', 3),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(targetX(result.state)).toBe(2)
    expect(targetHp(result.state)).toBe(0)
  })

  it('preview projects displacement Poison without mutating the supplied state', () => {
    const state = encounter()
    const evaluation = evaluateCombatAction(
      state,
      displace('push', 2),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(evaluation.legal).toBe(true)
    expect(evaluation.projectedEvents).toContainEqual(
      expect.objectContaining({ event: 'damage_applied', actionId: 'status.poison.current.v1' }),
    )
    expect(targetHp(state)).toBe(30)
    expect(targetX(state)).toBe(1)
    expect(state.effectState?.poison[0]?.movementRemainder).toBe(4)
  })
})
