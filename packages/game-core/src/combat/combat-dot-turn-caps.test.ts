import {
  executeStatDrivenAttack,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatResolutionEvent,
} from './stat-driven-combat'
import {
  combatTurnCycle,
  claimCombatTurnTrigger,
  validateCombatTurnTriggers,
} from './combat-turn-trigger-state'
import { validateCurrentBurnEffect } from './combat-dots'
import { executeCombatAction as executeLegacyCombatAction } from './actions-legacy'
import { selectCurrentFinalFacing } from './board'
import { collectCommittedHostileCommandDamage } from './combat-committed-damage'
import { describe, expect, it } from 'vitest'
import {
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatResolutionEvent,
} from './actions'
import {
  advanceCurrentPoisonMovement,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  removeCurrentBurnState,
} from './combat-dots'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import { PHASE4_STATUSES } from './status-content'

const content = { statuses: PHASE4_STATUSES }
const selection = { kind: 'unit' as const, combatantId: 'enemy' }
function encounter() {
  return { ...percentageDotEncounter(), dotTriggerPolicyVersion: 1 as const }
}
function burn(state: CombatEncounterState) {
  return applyCurrentBurnState(state, 'enemy', 'actor', 'test.burn', true, undefined, 3, {
    capturedDamage: 100,
    profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
  })
}
function poison(state: CombatEncounterState, target = 'actor') {
  return applyCurrentPoisonState(state, 'enemy', target, 'test.poison', true, undefined, 3, {
    capturedDamage: 100,
    profile: { kind: 'attack-percentage', basisPoints: 2000 },
  })
}
function strike(amount = 23, extraAmounts: number[] = []): CombatActionDefinition {
  return {
    id: 'test.capped-attack',
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['attack'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [amount, ...extraAmounts].map((amount) => ({
      type: 'damage',
      recipient: 'primary-unit',
      amount,
    })),
  }
}
function backlash(events: readonly StatDrivenCombatResolutionEvent[]) {
  return events
    .filter(
      (event) =>
        event.event === 'damage_applied' &&
        event.targetCombatantId === 'actor' &&
        event.actionId.startsWith('status.burn.backlash'),
    )
    .reduce((total, event) => total + (event.event === 'damage_applied' ? event.amount : 0), 0)
}
function endTurn(state: CombatEncounterState) {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  return endCombatTurn({ ...state, tactical: faced.state }, content).state
}
function nextActorCycle(state: CombatEncounterState) {
  let next = endTurn(state)
  while (next.tactical.battle.currentTurn?.combatantId !== 'actor') next = endTurn(next)
  return next
}

describe('new percentage DoT trigger policy', () => {
  it('copies the authored backlash percentage without renewing the receiver’s allowance', () => {
    const initial = applyCurrentBurnState(
      encounter(),
      'enemy',
      'actor',
      'test.burn',
      true,
      undefined,
      3,
      {
        capturedDamage: 100,
        profile: { kind: 'attack-percentage', basisPoints: 2000, decayBasisPointsPerTick: 500 },
      },
      2500,
    )
    expect(backlash(executeCombatAction(initial, strike(), selection, content).events)).toBe(5)
    const reserved = claimCombatTurnTrigger(initial, 'enemy', 'burn.backlash').state
    const copied = executeCombatAction(
      reserved,
      {
        ...strike(),
        id: 'test.copy',
        tags: [],
        effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' }],
      },
      selection,
      content,
    )
    expect(
      copied.state.effectState!.burn.find((row) => row.targetCombatantId === 'enemy')!
        .backlashBasisPoints,
    ).toBe(2500)
    expect(claimCombatTurnTrigger(copied.state, 'enemy', 'burn.backlash').allowed).toBe(false)
  })
  it('does not trigger or spend an allowance on the stat-driven miss path', () => {
    const initial = burn(encounter()) as StatDrivenCombatEncounterState
    const inaccurate = {
      ...initial,
      statBridge: {
        ...initial.statBridge,
        combatants: initial.statBridge.combatants.map((row) =>
          row.combatantId === 'actor' ? { ...row, accuracy: 0 } : row,
        ),
      },
    } as StatDrivenCombatEncounterState
    const result = executeStatDrivenAttack(
      inaccurate,
      { ...strike(), sourceType: 'basic-attack', cost: { spendsAction: true, mp: 0 } },
      selection,
      content,
    )
    expect(
      result.events.find((event) => event.event === 'stat_driven_attack_resolved'),
    ).toMatchObject({ hit: false })
    expect(backlash(result.events)).toBe(0)
    expect(
      result.state.turnTriggerState?.combatants.flatMap((row) => row.usedKeys) ?? [],
    ).not.toContain('burn.backlash')
  })
  it('settles lethal multi-hit backlash once before the final no-winner verdict', () => {
    const initial = burn(encounter())
    const state = {
      ...initial,
      tactical: {
        ...initial.tactical,
        battle: {
          ...initial.tactical.battle,
          combatants: initial.tactical.battle.combatants.map((row) => ({
            ...row,
            hp: row.id === 'actor' ? 2 : row.id === 'enemy' ? 23 : 0,
          })),
        },
      },
    }
    const result = executeCombatAction(state, strike(8, [8, 7]), selection, content)
    expect(backlash(result.events)).toBe(2)
    expect(result.events.filter((event) => event.event === 'battle_completed')).toEqual([
      { event: 'battle_completed', winningTeamId: null },
    ])
    expect(
      result.events.filter((event) => event.event === 'damage_applied' && event.hpAfter === 0),
    ).toHaveLength(2)
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
  })
  it('validates exact percentages and persisted cycle claims, without mutating forecasts', () => {
    const initial = encounter()
    expect(combatTurnCycle(initial, 'actor')).toBe(1)
    expect(combatTurnCycle(initial, 'enemy')).toBe(0)
    expect(initial).not.toHaveProperty('turnTriggerState')
    const reserved = claimCombatTurnTrigger(initial, 'enemy', 'poison.movement').state
    expect(validateCombatTurnTriggers(JSON.parse(JSON.stringify(reserved)))).toEqual([])
    expect(validateCombatTurnTriggers({ ...reserved, dotTriggerPolicyVersion: undefined })).toEqual(
      [],
    )
    expect(
      validateCombatTurnTriggers({ ...reserved, percentageDotPolicyVersion: undefined }),
    ).not.toEqual([])
    expect(
      validateCombatTurnTriggers({
        ...reserved,
        turnTriggerState: { preparedTurnNumber: 2, combatants: [] },
      }),
    ).not.toEqual([])
    for (const value of [-1, 10001, 12.5, NaN])
      expect(() => validateCurrentBurnEffect({ backlashBasisPoints: value })).toThrow()
    for (const value of [0, 1234, 10000])
      expect(() => validateCurrentBurnEffect({ backlashBasisPoints: value })).not.toThrow()
  })
  it('uses actual outgoing hostile HP damage and allows only one backlash per actor cycle', () => {
    const initial = burn(encounter())
    const first = executeCombatAction(initial, strike(), selection, content)
    expect(backlash(first.events)).toBe(2)
    const repeated = executeCombatAction(first.state, strike(), selection, content)
    expect(backlash(repeated.events)).toBe(0)
    const renewed = executeCombatAction(
      nextActorCycle(repeated.state),
      strike(59),
      selection,
      content,
    )
    expect(backlash(renewed.events)).toBe(5)
  })
  it('does not claim the allowance for a miss, but a positive basis rounding to zero does claim it', () => {
    const initial = burn(encounter())
    const missed = executeLegacyCombatAction(
      initial,
      strike(),
      selection,
      content,
      undefined,
      new Set(['enemy']),
    )
    expect(backlash(missed.events)).toBe(0)
    expect(backlash(executeCombatAction(missed.state, strike(), selection, content).events)).toBe(2)
    const small = executeCombatAction(initial, strike(3), selection, content)
    expect(backlash(small.events)).toBe(0)
    expect(backlash(executeCombatAction(small.state, strike(59), selection, content).events)).toBe(
      0,
    )
  })
  it('sums all direct hits once and excludes friendly and self damage from the percentage basis', () => {
    const base = strike(8, [8, 7])
    const action: CombatActionDefinition = {
      ...base,
      target: { ...base.target, teamPolicy: 'any', friendlyFire: 'all-units' },
      effects: base.effects,
    }
    const initial = burn(encounter())
    const hit = executeCombatAction(initial, action, selection, content)
    expect(backlash(hit.events)).toBe(2)
    const selfReceipt: CombatResolutionEvent = {
      event: 'damage_applied',
      sourceCombatantId: 'actor',
      targetCombatantId: 'actor',
      actionId: action.id,
      amount: 75,
      hpBefore: 100,
      hpAfter: 25,
    }
    expect([
      ...collectCommittedHostileCommandDamage(initial, [...hit.events, selfReceipt], {
        sourceCombatantId: 'actor',
        actionId: action.id,
      }).values(),
    ]).toEqual([23])
    expect(
      backlash(
        executeCombatAction(initial, action, { kind: 'unit', combatantId: 'ally' }, content).events,
      ),
    ).toBe(0)
  })
  it('preserves the cap through JSON reload, removal and another Burn application', () => {
    const first = executeCombatAction(burn(encounter()), strike(), selection, content)
    const reloaded = JSON.parse(JSON.stringify(first.state)) as CombatEncounterState
    const replaced = burn(removeCurrentBurnState(reloaded, 'actor'))
    expect(backlash(executeCombatAction(replaced, strike(59), selection, content).events)).toBe(0)
  })
  it('limits Poison movement to one extra tick and discards excess thresholds without consuming scheduled ticks', () => {
    const initial = poison(encounter())
    const first = advanceCurrentPoisonMovement(initial, 'actor', 5)
    expect(first.triggeredTicks).toBe(1)
    const repeated = advanceCurrentPoisonMovement(first.state, 'actor', 12)
    expect(repeated.triggeredTicks).toBe(0)
    expect(repeated.state.effectState!.poison[0]).toMatchObject({
      movementRemainder: 2,
      remainingTicks: 3,
    })
    const next = advanceCurrentPoisonMovement(nextActorCycle(repeated.state), 'actor', 3)
    expect(next.triggeredTicks).toBe(1)
    expect(next.state.effectState!.poison[0]!.remainingTicks).toBe(2)
  })
  it('cannot reset the Poison allowance by reapplying or reloading the effect', () => {
    const first = advanceCurrentPoisonMovement(poison(encounter()), 'actor', 5)
    const replaced = poison(JSON.parse(JSON.stringify(first.state)) as CombatEncounterState)
    expect(advanceCurrentPoisonMovement(replaced, 'actor', 5).triggeredTicks).toBe(0)
  })
  it('uses a stable initial cycle for forced movement before the poisoned unit first acts', () => {
    const first = advanceCurrentPoisonMovement(poison(encounter(), 'enemy'), 'enemy', 5)
    expect(first.triggeredTicks).toBe(1)
    expect(advanceCurrentPoisonMovement(first.state, 'enemy', 5).triggeredTicks).toBe(0)
    const started = endTurn(first.state)
    expect(started.tactical.battle.currentTurn?.combatantId).toBe('enemy')
    expect(advanceCurrentPoisonMovement(started, 'enemy', 5).triggeredTicks).toBe(1)
  })
})
