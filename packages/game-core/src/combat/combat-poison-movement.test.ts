import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  endCombatTurn,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import {
  advanceCurrentPoisonMovement,
  advanceCurrentPoisonEndTurn,
  applyCurrentPoisonState,
} from './combat-dots'
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
      damageHistory: [],
    },
  }
}

function push(distance: number): CombatActionDefinition {
  return {
    id: `test.push.${distance}`,
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
    effects: [{ type: 'displace', recipient: 'primary-unit', direction: 'push', distance }],
  }
}

function targetHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((row) => row.id === 'target')!.hp
}

function targetX(state: CombatEncounterState): number {
  return state.tactical.placements.find((row) => row.combatantId === 'target')!.position.x
}

describe('current Poison movement progress', () => {
  function refreshPoison(): CombatEncounterState {
    const base = encounter()
    return applyCurrentPoisonState(
      {
        ...base,
        percentageDotPolicyVersion: 1,
        dotTriggerPolicyVersion: 2,
        effectState: { ...base.effectState!, poison: [] },
      } as CombatEncounterState,
      'actor',
      'target',
      'test.poison-source',
      true,
      undefined,
      3,
      { capturedDamage: 100, profile: { kind: 'attack-percentage', basisPoints: 2000 } },
    )
  }
  it('captures original duration and refreshes repeatedly at five tiles without extra damage ticks', () => {
    const initial = refreshPoison()
    expect(initial.effectState!.poison[0]).toHaveProperty('originalDurationTurns', 3)
    const aged = advanceCurrentPoisonEndTurn(initial, 'target')
    const partial = advanceCurrentPoisonMovement(aged, 'target', 4)
    expect(partial.triggeredTicks).toBe(0)
    expect(partial.state.effectState!.poison[0]).toMatchObject({
      remainingTicks: 2,
      movementRemainder: 4,
    })
    const refreshed = advanceCurrentPoisonMovement(partial.state, 'target', 1)
    expect(refreshed.triggeredTicks).toBe(0)
    expect(refreshed.state.effectState!.poison[0]).toMatchObject({
      remainingTicks: 3,
      movementRemainder: 0,
    })
    const repeated = advanceCurrentPoisonMovement(
      advanceCurrentPoisonEndTurn(refreshed.state, 'target'),
      'target',
      12,
    )
    expect(repeated.triggeredTicks).toBe(0)
    expect(repeated.state.effectState!.poison[0]).toMatchObject({
      remainingTicks: 3,
      movementRemainder: 2,
    })
    expect(validateCombatEncounterState(JSON.parse(JSON.stringify(repeated.state)))).toEqual([])
  })
  it.each(['push', 'pull'] as const)(
    'refreshes Poison from actual %s tiles without damage, in preview and commit',
    (direction) => {
      let state = advanceCurrentPoisonMovement(
        advanceCurrentPoisonEndTurn(refreshPoison(), 'target'),
        'target',
        4,
      ).state
      if (direction === 'pull')
        state = {
          ...state,
          tactical: {
            ...state.tactical,
            placements: state.tactical.placements.map((row) =>
              row.combatantId === 'target' ? { ...row, position: { x: 4, y: 0 } } : row,
            ),
          },
        }
      const action = {
        ...push(2),
        effects: [
          { type: 'displace' as const, recipient: 'primary-unit' as const, direction, distance: 2 },
        ],
      }
      const before = JSON.stringify(state)
      const preview = evaluateCombatAction(
        state,
        action,
        { kind: 'unit', combatantId: 'target' },
        CONTENT,
      )
      expect(preview.legal).toBe(true)
      expect(preview.projectedEvents?.filter((row) => row.event === 'damage_applied')).toEqual([])
      expect(JSON.stringify(state)).toBe(before)
      const result = executeCombatAction(
        state,
        action,
        { kind: 'unit', combatantId: 'target' },
        CONTENT,
      )
      expect(targetX(result.state)).toBe(direction === 'pull' ? 2 : 3)
      expect(targetHp(result.state)).toBe(30)
      expect(result.state.effectState!.poison[0]).toMatchObject({
        remainingTicks: 3,
        movementRemainder: 1,
      })
      expect(result.events.filter((row) => row.event === 'damage_applied')).toEqual([])
      expect(result.events).toContainEqual({
        event: 'poison_duration_refreshed',
        targetCombatantId: 'target',
        remainingOwnerTurnEnds: 3,
      })
    },
  )
  it('ticks percentage damage only once at the target turn end while carrying partial movement across turns', () => {
    let state = advanceCurrentPoisonMovement(refreshPoison(), 'target', 3).state
    state = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'east').state },
      CONTENT,
    ).state
    const ended = endCombatTurn(
      { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
      CONTENT,
    )
    expect(targetHp(ended.state)).toBe(10)
    expect(
      ended.events.filter(
        (row) => row.event === 'damage_applied' && row.targetCombatantId === 'target',
      ),
    ).toHaveLength(1)
    const refreshed = advanceCurrentPoisonMovement(ended.state, 'target', 2)
    expect(refreshed.triggeredTicks).toBe(0)
    expect(refreshed.state.effectState!.poison[0]).toMatchObject({
      remainingTicks: 3,
      movementRemainder: 0,
    })
  })
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
      push(2),
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

  it('stops displacement immediately when a movement-triggered Poison tick defeats the unit', () => {
    const result = executeCombatAction(
      encounter(2),
      push(3),
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
      push(2),
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
