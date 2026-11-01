import { expect, it } from 'vitest'
import { executeCombatAction, type CombatActionDefinition } from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  preparePv1fTurnEconomy,
  spendPv1fActionEconomy,
  evaluatePv1fMovement,
  executePv1fMovement,
  readPv1fActionEconomy,
  PV1F_COMBAT_CONTENT,
} from './pv1f-action-economy'
import { chooseRecruitAiDecision } from './recruit-ai'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { movementApCostForTile } from './pv1f-skills'

function hasted(adjustment = 20) {
  const state = preparePv1fTurnEconomy(percentageDotEncounter())
  const action: CombatActionDefinition = {
    id: 'test.free-haste',
    version: 1,
    sourceType: 'test',
    tags: ['support'],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'all-units',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [
      {
        type: 'apply-status',
        recipient: 'actor',
        statusId: 'haste',
        stacks: 1,
        durationTurns: 99,
        movementApAdjustment: adjustment,
      },
    ],
  }
  const applied = executeCombatAction(state, action, { kind: 'self' }, PV1F_COMBAT_CONTENT)
  const restored = JSON.parse(JSON.stringify(applied.state)) as typeof state
  expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
  return spendPv1fActionEconomy(restored, 100)
}

it.each([20, 99])(
  'moves at AP0 with authored Haste %i without granting AP or Movement',
  (amount) => {
    const state = hasted(amount)
    const path = [
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ]
    const quote = evaluatePv1fMovement(state, path)
    expect(quote).toMatchObject({ economyCost: 0, movement: { legal: true, cost: 2 } })
    const moved = executePv1fMovement(state, path)
    expect(readPv1fActionEconomy(moved.state)?.current).toBe(0)
    expect(moved.state.tactical.battle.currentTurn?.movementRemaining).toBe(2)
    expect(moved.events).toContainEqual(
      expect.objectContaining({ event: 'action_economy_spent', amount: 0, remaining: 0 }),
    )
    expect(moved.events).toContainEqual(
      expect.objectContaining({ event: 'combatant_moved', to: { x: 0, y: 0 }, movementCost: 2 }),
    )
    const exhausted = executePv1fMovement(moved.state, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ])
    expect(exhausted.state.tactical.battle.currentTurn?.movementRemaining).toBe(0)
    expect(
      evaluatePv1fMovement(exhausted.state, [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]).movement.legal,
    ).toBe(false)
    expect(readPv1fActionEconomy(exhausted.state)?.current).toBe(0)
  },
)

it.each([
  [1, -20, 0],
  [1, -99, 0],
  [2, -20, 20],
  [2, -50, 0],
  [1, -20 + 10, 10],
  [2, -20 + 10 + 10, 40],
])(
  'prices traversal %i with signed Haste/Slow/Frozen delta %i at %i AP',
  (terrain, delta, expected) => {
    expect(movementApCostForTile(terrain!, delta!)).toBe(expected)
  },
)

it('retains positive authored base-price bounds even when the final price may be zero', () => {
  expect(() => movementApCostForTile(1, -20, 0)).toThrow(RangeError)
  expect(() => movementApCostForTile(1, -20, 9)).toThrow(RangeError)
  expect(() => movementApCostForTile(1, -20, 101)).toThrow(RangeError)
  expect(movementApCostForTile(1, -20, 10)).toBe(0)
})

it('lets an AI spend its finite Movement at AP0, then finish without a free-walk loop', () => {
  const base = hasted()
  let state: StatDrivenCombatEncounterState = {
    ...base,
    tactical: {
      ...base.tactical,
      placements: base.tactical.placements.map((row) =>
        row.combatantId === 'enemy'
          ? { ...row, position: { x: 4, y: 4 } }
          : row.combatantId === 'other'
            ? { ...row, position: { x: 4, y: 3 } }
            : row,
      ),
    },
  }
  let moves = 0
  for (; moves < 5; moves++) {
    const decision = chooseRecruitAiDecision({ state, tieBreakSeed: moves })
    if (decision.intent.kind === 'end-turn' || decision.intent.kind === 'face') break
    expect(decision.intent.kind).toBe('move')
    if (decision.intent.kind !== 'move') throw new Error('Expected free positioning.')
    state = executePv1fMovement(state, decision.intent.path).state
    expect(readPv1fActionEconomy(state)?.current).toBe(0)
  }
  expect(moves).toBe(4)
  expect(state.tactical.battle.currentTurn?.movementRemaining).toBe(0)
})
