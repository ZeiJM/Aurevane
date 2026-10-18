import { expect, it } from 'vitest'
import { endCombatTurn, applyCurrentBurnBacklash, type CombatEncounterState } from './actions'
import { selectCurrentFinalFacing } from './board'
import { percentageDotEncounter } from './combat-percentage-dots.test-utils'
import {
  applyCurrentPoisonState,
  applyCurrentBurnState,
  applyCurrentBleedState,
} from './combat-dots'
import { grantBarrier, currentBarrierAmount } from './combat-barrier'
import {
  PV1F_COMBAT_CONTENT,
  preparePv1fTurnEconomy,
  evaluatePv1fMovement,
  executePv1fMovement,
} from './pv1f-action-economy'
import { applyCommittedReflect } from './combat-reflect'
import { reattachStatDrivenCombatBridge } from './stat-driven-combat'

function protectedActor(current = true) {
  const base = percentageDotEncounter()
  const initial = {
    ...base,
    ...(current ? { modularSkillPolicyVersion: 1 as const } : {}),
    dotTriggerPolicyVersion: 2 as const,
    tactical: {
      ...base.tactical,
      battle: {
        ...base.tactical.battle,
        combatants: base.tactical.battle.combatants.map((unit) =>
          unit.id === 'actor' ? { ...unit, hp: 5 } : unit,
        ),
      },
    },
  }
  return grantBarrier(initial, 'actor', 'actor', 'test.shield', 20).state
}
const hp = (state: CombatEncounterState) =>
  state.tactical.battle.combatants.find((unit) => unit.id === 'actor')!.hp
it('absorbs movement-triggered Poison consistently in walking forecast and commit', () => {
  const initial = { ...protectedActor(), dotTriggerPolicyVersion: 1 as const }
  const poisoned = applyCurrentPoisonState(initial, 'enemy', 'actor', 'test.poison', true, 10, 2)
  const state = preparePv1fTurnEconomy(
    reattachStatDrivenCombatBridge(
      {
        ...poisoned,
        effectState: {
          ...poisoned.effectState!,
          poison: poisoned.effectState!.poison.map((row) => ({ ...row, movementRemainder: 4 })),
        },
      },
      percentageDotEncounter().statBridge,
    ),
  )
  const path = [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
  ]
  const quote = evaluatePv1fMovement(state, path)
  expect(quote.movement.legal).toBe(true)
  expect(quote.poisonForecast.damage).toBe(0)
  expect(quote.poisonForecast.willDefeat).toBe(false)
  const out = executePv1fMovement(state, path)
  expect(hp(out.state)).toBe(5)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(10)
})
it.each(['poison', 'burn', 'bleed'] as const)(
  'absorbs %s ticks before HP and keeps old captures unchanged',
  (kind) => {
    for (const current of [false, true]) {
      const base = protectedActor(current)
      const capturedDamage = {
        capturedDamage: 100,
        profile: { kind: 'attack-percentage' as const, basisPoints: 1000 },
      }
      const state =
        kind === 'poison'
          ? applyCurrentPoisonState(
              base,
              'enemy',
              'actor',
              'test.dot',
              true,
              undefined,
              2,
              capturedDamage,
            )
          : kind === 'burn'
            ? applyCurrentBurnState(base, 'enemy', 'actor', 'test.dot', true, undefined, 2, {
                ...capturedDamage,
                profile: { ...capturedDamage.profile, decayBasisPointsPerTick: 100 },
              })
            : applyCurrentBleedState(base, 'enemy', 'actor', 'test.dot', 0, 2, true, capturedDamage)
      const before = JSON.stringify(state)
      const out = endCombatTurn(
        { ...state, tactical: selectCurrentFinalFacing(state.tactical, 'west').state },
        PV1F_COMBAT_CONTENT,
      )
      expect(hp(out.state)).toBe(current ? 5 : 0)
      expect(currentBarrierAmount(out.state, 'actor')).toBe(current ? 10 : 20)
      expect(out.state.tactical.battle.currentTurn?.combatantId).toBe('enemy')
      if (current)
        expect(out.events).toContainEqual(
          expect.objectContaining({
            event: 'barrier_absorbed',
            targetCombatantId: 'actor',
            amount: 10,
          }),
        )
      expect(JSON.stringify(state)).toBe(before)
    }
  },
)
it('absorbs Burn backlash while retaining its once-per-turn trigger claim', () => {
  const out = applyCurrentBurnBacklash(protectedActor(), 'actor', 1, {
    hostileDamage: 100,
    basisPoints: 1000,
  })
  expect(hp(out.state)).toBe(5)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(10)
  const repeated = applyCurrentBurnBacklash(out.state, 'actor', 1, {
    hostileDamage: 100,
    basisPoints: 1000,
  })
  expect(hp(repeated.state)).toBe(5)
  expect(currentBarrierAmount(repeated.state, 'actor')).toBe(10)
})
it('absorbs reflected damage before HP without truncating its damage to the unshielded HP pool', () => {
  const initial = protectedActor()
  const status = {
    id: 'test.reflect',
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10000,
    polarity: 'positive' as const,
    reactionClass: 'reactive' as const,
    reflectBasisPoints: 2500,
  }
  const state = {
    ...initial,
    statusState: initial.statusState.map((row) =>
      row.combatantId === 'enemy'
        ? {
            ...row,
            statuses: [
              {
                statusId: status.id,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'enemy',
              },
            ],
          }
        : row,
    ),
  }
  const out = applyCommittedReflect(
    state,
    [
      {
        event: 'damage_applied',
        actionId: 'test.hit',
        sourceCombatantId: 'actor',
        targetCombatantId: 'enemy',
        amount: 40,
        hpBefore: 1000,
        hpAfter: 960,
      },
    ],
    { statuses: [...PV1F_COMBAT_CONTENT.statuses, status] },
    { sourceCombatantId: 'actor', actionId: 'test.hit' },
  )
  expect(hp(out.state)).toBe(5)
  expect(currentBarrierAmount(out.state, 'actor')).toBe(10)
  expect(out.events).toContainEqual(
    expect.objectContaining({ event: 'barrier_absorbed', amount: 10 }),
  )
})
