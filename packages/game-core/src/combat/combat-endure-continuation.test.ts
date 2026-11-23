import { expect, it } from 'vitest'
import {
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
} from './actions'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  preparePv1fTurnEconomy,
  evaluatePv1fMovement,
  executePv1fMovement,
  executePv1fAction,
  evaluatePv1fAction,
  finishPv1fTurn,
  PV1F_COMBAT_CONTENT,
  PV1F_RECOVER_ACTION_ID,
  PV1F_BASIC_ATTACK_ID,
} from './pv1f-action-economy'
import {
  createAiQualityResources,
  createPvpQualityResources,
  prepareAiQualityCombatant,
  resetAiMissedTurnStreak,
  resetPvpMissedTurnStreak,
  timeoutAiTurn,
  timeoutPvpTurn,
  surrenderPvpCombatant,
} from './pvp-quality'
import { chooseBuildAwareRecruitAiDecision } from './recruit-ai-build'
import { projectPublicCombat } from './public-combat-presentation'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

function enduring(hp = 1000, quality?: 'ai' | 'pvp'): StatDrivenCombatEncounterState {
  const base = preparePv1fTurnEconomy(percentageDotEncounter())
  const state = {
    ...base,
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor'
            ? {
                ...unit,
                hp,
                temporaryResources: [
                  ...unit.temporaryResources,
                  ...(quality
                    ? (quality === 'ai'
                        ? createAiQualityResources()
                        : createPvpQualityResources()
                      ).map((resource) => ({ ...resource, current: 1 }))
                    : []),
                ].sort((a, b) => a.key.localeCompare(b.key)),
              }
            : unit,
        ),
      },
    },
  }
  const action: CombatActionDefinition = {
    id: 'test.endure.continuation',
    version: 1,
    sourceType: 'test',
    tags: [],
    requirements: [],
    cost: { spendsAction: false, mp: 0 },
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
    effects: [
      {
        type: 'endure',
        recipient: 'actor',
        durationTurns: 3,
        releaseBasisPoints: 15000,
        radiusTiles: 3,
        targetTeams: 'enemies',
      },
    ],
  }
  return executeCombatAction(state, action, { kind: 'self' }, PV1F_COMBAT_CONTENT)
    .state as StatDrivenCombatEncounterState
}
function reload(state: StatDrivenCombatEncounterState) {
  const restored = JSON.parse(JSON.stringify(state)) as StatDrivenCombatEncounterState
  expect(validateStatDrivenCombatEncounterState(restored)).toEqual([])
  return restored
}

it('continues real movement after Endure without losing its private active ledger', () => {
  const state = reload(enduring())
  const ledger = structuredClone(state.endureState)
  const path = [
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
  expect(evaluatePv1fMovement(state, path).movement.legal).toBe(true)
  const moved = reload(executePv1fMovement(state, path).state)
  expect(moved.tactical.placements.find((row) => row.combatantId === 'actor')!.position).toEqual({
    x: 0,
    y: 1,
  })
  expect(moved.endureState).toEqual(ledger)
})

it.each(['ai', 'pvp'] as const)(
  'allows support and resets %s activity tracking while Endure remains active',
  (kind) => {
    const state = enduring(500, kind)
    expect(
      evaluatePv1fAction(state, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).evaluation.legal,
    ).toBe(true)
    expect(
      evaluatePv1fAction(state, PV1F_BASIC_ATTACK_ID, { kind: 'unit', combatantId: 'enemy' })
        .evaluation.issues,
    ).toContainEqual(expect.objectContaining({ code: 'endure-active' }))
    const support = executePv1fAction(state, PV1F_RECOVER_ACTION_ID, { kind: 'self' }).state
    const reset = reload(
      (kind === 'ai' ? resetAiMissedTurnStreak : resetPvpMissedTurnStreak)(support),
    )
    expect(reset.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBeGreaterThan(
      500,
    )
    expect(reset.endureState?.applications).toEqual(state.endureState?.applications)
  },
)

it.each(['ai', 'pvp'] as const)(
  'advances a %s timeout with an active Endure ledger instead of idling on reconstruction',
  (kind) => {
    const state = enduring(1000, kind)
    const next = reload((kind === 'ai' ? timeoutAiTurn : timeoutPvpTurn)(state).state)
    expect(next.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(next.endureState?.applications).toEqual(state.endureState?.applications)
  },
)

it('lets an Endure bearer AI choose and execute support', () => {
  const state = prepareAiQualityCombatant(enduring(500), 'actor')
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 42 })
  expect(decision.intent).toMatchObject({ kind: 'action', actionId: PV1F_RECOVER_ACTION_ID })
  if (decision.intent.kind !== 'action') throw new Error('Expected healing support.')
  const result = reload(
    executePv1fAction(state, decision.intent.actionId, decision.intent.target).state,
  )
  expect(result.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBeGreaterThan(
    500,
  )
  expect(result.endureState?.applications).toEqual(state.endureState?.applications)
})

it('lets an opponent AI act normally and records its damage against the Endure bearer', () => {
  const cast = enduring(500)
  const ended = finishPv1fTurn(cast, 'west').state
  const state = prepareAiQualityCombatant(reload(ended), 'enemy')
  const decision = chooseBuildAwareRecruitAiDecision({ state, tieBreakSeed: 42 })
  expect(decision.intent).toMatchObject({
    kind: 'action',
    actionId: PV1F_BASIC_ATTACK_ID,
    target: { kind: 'unit', combatantId: 'actor' },
  })
  if (decision.intent.kind !== 'action') throw new Error('Expected normal opponent attack.')
  const result = reload(
    executePv1fAction(state, decision.intent.actionId, decision.intent.target).state,
  )
  const loss = 500 - result.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp
  expect(loss).toBeGreaterThan(0)
  expect(result.endureState?.applications[0]?.receivedDamage).toBe(loss)
})

it('cancels Endure on surrender without releasing its private damage ledger', () => {
  const state = enduring()
  const result = reload(surrenderPvpCombatant(state, 'actor').state)
  expect(result.endureState?.applications).toEqual([])
  expect(
    result.statusState
      .find((row) => row.combatantId === 'actor')
      ?.statuses.some((row) => row.statusId === 'endure'),
  ).toBe(false)
  expect(result.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(1000)
})

it('cancels a charged final-tick Endure before surrender hands off the turn', () => {
  const state = enduring()
  const status = state.statusState
    .find((row) => row.combatantId === 'actor')!
    .statuses.find((row) => row.statusId === 'endure')!
  status.remainingOwnerTurnStarts = 1
  status.remainingOwnerTurnEnds = 1
  status.skipCurrentOwnerTurnEnd = undefined
  const charged = {
    ...state,
    endureState: {
      ...state.endureState!,
      applications: state.endureState!.applications.map((row) => ({ ...row, receivedDamage: 20 })),
    },
  }
  expect(validateStatDrivenCombatEncounterState(charged)).toEqual([])
  const result = surrenderPvpCombatant(charged, 'actor')
  expect(result.state.tactical.battle.combatants.find((row) => row.id === 'enemy')!.hp).toBe(1000)
  expect(result.events).not.toContainEqual(
    expect.objectContaining({ actionId: 'status.endure.release' }),
  )
  expect(result.state.endureState?.applications).toEqual([])
})

it('clears remaining Endure authority on terminal surrender without a burst', () => {
  let state = enduring()
  state = surrenderPvpCombatant(state, 'other').state
  state = reload(surrenderPvpCombatant(state, 'enemy').state)
  expect(state.tactical.battle.lifecycle).toBe('completed')
  expect(state.endureState?.applications).toEqual([])
  expect(state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp).toBe(1000)
})

it('keeps the ledger private and rejects stripped public snapshots as authoritative execution state', () => {
  const state = enduring()
  const visible = projectPublicCombat(state)
  expect(JSON.stringify(visible)).not.toContain('receivedDamage')
  expect(visible).not.toHaveProperty('endureState')
  expect(
    validateCombatEncounterState(visible as unknown as StatDrivenCombatEncounterState),
  ).toContainEqual(expect.objectContaining({ field: 'endureState' }))
  expect(validateCombatEncounterState(state)).toEqual([])
})
