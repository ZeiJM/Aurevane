import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatResolutionTransition,
  type CombatStatusDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { validateCombatStatusDefinition } from './combat-authoring-validation'

function absorbStatus(basisPoints = 2_500): CombatStatusDefinition {
  return {
    id: 'test.absorb-command',
    version: 1,
    maximumStacks: 3,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    reactionClass: 'reactive',
    absorbHpBasisPoints: basisPoints,
  } as unknown as CombatStatusDefinition
}

function encounter(status: CombatStatusDefinition, hp = 100, stacks = 1): CombatEncounterState {
  const ids = ['actor', 'target']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:absorb-command',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 41,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id,
        initiative: 20 - index,
        baseMovementBudget: 3,
        hp: id === 'target' ? hp : 100,
        maxHp: 100,
        mp: 30,
        maxMp: 30,
      })),
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: ids.map((_, x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
      placements: ids.map((combatantId, x) => ({
        combatantId,
        position: { x, y: 0 },
        facing: 'east',
        movementProfileId: 'ground',
      })),
    }),
    [
      {
        combatantId: 'target',
        statuses: [
          {
            statusId: status.id,
            statusVersion: status.version,
            stacks,
            remainingOwnerTurnStarts: 2,
            sourceCombatantId: 'target',
          },
        ],
      },
    ],
  )
}

function execute(
  state: CombatEncounterState,
  status: CombatStatusDefinition,
  effects: CombatActionDefinition['effects'],
): CombatResolutionTransition {
  return executeCombatAction(
    state,
    {
      id: 'test.absorb-command-hit',
      version: 1,
      sourceType: 'test',
      tags: [],
      target: {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'single' },
        minimumRange: 1,
        maximumRange: 1,
        requiresLineOfSight: false,
        maximumElevationDifference: 0,
        friendlyFire: 'enemies-only',
      },
      cost: { spendsAction: false, mp: 0 },
      requirements: [],
      effects,
    },
    { kind: 'unit', combatantId: 'target' },
    { statuses: [status] },
  )
}

function absorbEvents(result: CombatResolutionTransition) {
  return result.events.filter(
    (event) =>
      event.event === 'healing_applied' && event.actionId === 'status.absorb-hp.current.v1',
  )
}

function targetHp(result: CombatResolutionTransition): number {
  return result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')!.hp
}

describe('Absorb HP command boundaries', () => {
  it('aggregates multi-hit damage before applying the minimum once per target', () => {
    const status = absorbStatus(1_000)
    const result = execute(encounter(status), status, [
      { type: 'damage', recipient: 'primary-unit', amount: 1 },
      { type: 'damage', recipient: 'primary-unit', amount: 1 },
    ])

    expect(targetHp(result)).toBe(99)
    expect(absorbEvents(result)).toEqual([expect.objectContaining({ amount: 1 })])
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 2 },
    ])
  })

  it('does not heal between hits to rescue a later lethal hit or count overkill', () => {
    const status = absorbStatus(10_000)
    const result = execute(encounter(status, 3), status, [
      { type: 'damage', recipient: 'primary-unit', amount: 2 },
      { type: 'damage', recipient: 'primary-unit', amount: 2 },
    ])

    expect(targetHp(result)).toBe(0)
    expect(absorbEvents(result)).toEqual([])
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 3 },
    ])
  })

  it('includes active status stacks in the authored percentage', () => {
    const status = absorbStatus()
    const result = execute(encounter(status, 100, 2), status, [
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
    ])

    expect(targetHp(result)).toBe(90)
    expect(absorbEvents(result)).toEqual([expect.objectContaining({ amount: 10 })])
  })

  it('caps recovery at max HP after ordinary command healing has committed', () => {
    const status = absorbStatus()
    const result = execute(encounter(status), status, [
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
      { type: 'healing', recipient: 'primary-unit', amount: 17 },
    ])

    expect(targetHp(result)).toBe(100)
    expect(absorbEvents(result)).toEqual([
      expect.objectContaining({ amount: 3, hpBefore: 97, hpAfter: 100 }),
    ])
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 20 },
    ])
  })

  it('preserves input state and committed damage history when recovery changes HP', () => {
    const status = absorbStatus()
    const initial = encounter(status)
    const before = structuredClone(initial)
    const result = execute(initial, status, [
      { type: 'damage', recipient: 'primary-unit', amount: 20 },
    ])

    expect(initial).toEqual(before)
    expect(targetHp(result)).toBe(85)
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 20 },
    ])
    expect(result.events.filter((event) => event.event === 'damage_applied')).toEqual([
      expect.objectContaining({ amount: 20, hpBefore: 100, hpAfter: 80 }),
    ])
    expect(absorbEvents(result)).toHaveLength(1)
    expect(result.resolution).toBeUndefined()
  })

  it.each([0, -1, 0.5, 10_001, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid authored basis points %s',
    (basisPoints) => {
      expect(() => validateCombatStatusDefinition(absorbStatus(basisPoints))).toThrow(/Absorb HP/i)
    },
  )

  it.each([1, 10_000])('accepts the authored basis-point boundary %s', (basisPoints) => {
    expect(() => validateCombatStatusDefinition(absorbStatus(basisPoints))).not.toThrow()
  })
})
