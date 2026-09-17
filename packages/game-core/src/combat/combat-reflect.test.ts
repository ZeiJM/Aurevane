import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatResolutionContext,
  type CombatResolutionTransition,
  type CombatStatusDefinition,
} from './actions'
import * as legacy from './actions-legacy'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import { PHASE4_STATUSES } from './status-content'

type ReflectStatus = CombatStatusDefinition & { reflectBasisPoints: number }
function reflectStatus(
  rate = 2_500,
  overrides: Partial<CombatStatusDefinition> = {},
): ReflectStatus {
  return {
    id: 'test.reflect',
    version: 1,
    maximumStacks: 3,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    reactionClass: 'reactive',
    reflectBasisPoints: rate,
    ...overrides,
  }
}
const REFLECT = reflectStatus()
const ABSORB: CombatStatusDefinition = {
  id: 'test.absorb-both',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'positive',
  reactionClass: 'reactive',
  absorbHpBasisPoints: 2_500,
  absorbMpBasisPoints: 2_500,
}
function encounter(
  options: {
    actorHp?: number
    targetHp?: number
    targetFirst?: boolean
    duel?: boolean
    friendly?: boolean
    allyWitness?: boolean
    witnessReflects?: boolean
    stacks?: number
    targetStatuses?: readonly CombatStatusDefinition[]
    actorStatuses?: readonly CombatStatusDefinition[]
  } = {},
): CombatEncounterState {
  const ids = options.duel ? ['actor', 'target'] : ['actor', 'target', 'witness']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:reflect-contract',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 53,
      combatants: ids.map((id, index) => ({
        id,
        teamId:
          id === 'actor' ||
          (id === 'target' && options.friendly) ||
          (id === 'witness' && options.allyWitness)
            ? 'players'
            : 'enemies',
        initiative: id === 'target' && options.targetFirst ? 30 : 20 - index,
        baseMovementBudget: 3,
        hp:
          id === 'actor'
            ? (options.actorHp ?? 100)
            : id === 'target'
              ? (options.targetHp ?? 100)
              : 100,
        maxHp: 100,
        mp: 10,
        maxMp: 100,
      })),
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: ids.length,
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
    ids.map((combatantId) => ({
      combatantId,
      statuses: (combatantId === 'target'
        ? (options.targetStatuses ?? [REFLECT])
        : combatantId === 'actor'
          ? (options.actorStatuses ?? [])
          : options.witnessReflects
            ? [REFLECT]
            : []
      ).map((status) => ({
        statusId: status.id,
        statusVersion: status.version,
        stacks: combatantId === 'target' ? (options.stacks ?? 1) : 1,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: combatantId,
      })),
    })),
  )
}
function hit(amount = 20): CombatActionDefinition {
  return {
    id: 'test.reflect-hit',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 2,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }],
  }
}
function cast(
  state = encounter(),
  action = hit(),
  statuses: readonly CombatStatusDefinition[] = [REFLECT],
  context?: CombatResolutionContext,
): CombatResolutionTransition {
  return executeCombatAction(
    state,
    action,
    { kind: 'unit', combatantId: 'target' },
    { statuses },
    context,
  )
}
function unit(result: CombatResolutionTransition, id: string) {
  const combatant = result.state.tactical.battle.combatants.find((candidate) => candidate.id === id)
  if (!combatant) throw new Error(`Missing test combatant: ${id}`)
  return combatant
}
function reflected(result: CombatResolutionTransition) {
  return result.events.filter(
    (event) => event.event === 'damage_applied' && event.actionId === 'status.reflect.current.v1',
  )
}
function completion(result: CombatResolutionTransition) {
  return result.events.filter((event) => event.event === 'battle_completed')
}
function context(budget = 32): CombatResolutionContext {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: hit().id,
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'chain:reflect',
    }),
    triggerGuard: createCombatTriggerGuard({
      triggerChainId: 'chain:reflect',
      reactionBudget: budget,
    }),
  }
}

describe('Reflect committed-command contract', () => {
  it('returns fixed damage to the attacker with defender attribution', () => {
    const result = cast()
    expect(unit(result, 'actor').hp).toBe(95)
    expect(unit(result, 'target').hp).toBe(80)
    expect(reflected(result)).toEqual([
      {
        event: 'damage_applied',
        actionId: 'status.reflect.current.v1',
        sourceCombatantId: 'target',
        targetCombatantId: 'actor',
        amount: 5,
        hpBefore: 100,
        hpAfter: 95,
      },
    ])
  })
  it('floors fractional reflection without borrowing the Absorb minimum-1 rule', () => {
    expect(unit(cast(encounter(), hit(7)), 'actor').hp).toBe(99)
    expect(reflected(cast(encounter(), hit(1)))).toEqual([])
  })
  it('aggregates multi-hit damage before rounding once', () => {
    const action = hit(2)
    action.effects = [...action.effects, ...action.effects]
    const result = cast(encounter(), action)
    expect(unit(result, 'actor').hp).toBe(99)
    expect(reflected(result)).toHaveLength(1)
  })
  it('uses only actual post-Barrier HP loss', () => {
    const barrier = hit()
    barrier.effects = [{ type: 'barrier-change', recipient: 'primary-unit', amount: 8 }]
    const result = cast(cast(encounter(), barrier).state)
    expect(unit(result, 'target').hp).toBe(88)
    expect(unit(result, 'actor').hp).toBe(97)
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 12 },
    ])
  })
  it('does not fire when Barrier prevents all incoming HP loss', () => {
    const barrier = hit()
    barrier.effects = [{ type: 'barrier-change', recipient: 'primary-unit', amount: 20 }]
    const result = cast(cast(encounter(), barrier).state)
    expect(reflected(result)).toEqual([])
  })
  it('ignores attacker Armor and incoming damage modifiers on its fixed output', () => {
    const guarded: CombatStatusDefinition = {
      ...ABSORB,
      id: 'test.guarded',
      absorbHpBasisPoints: undefined,
      absorbMpBasisPoints: undefined,
      damageTakenMultiplierBasisPoints: 5_000,
    }
    const initial = encounter({ actorStatuses: [guarded] })
    const state = {
      ...initial,
      statBridge: {
        combatants: initial.tactical.battle.combatants.map((combatant) => ({
          combatantId: combatant.id,
          armor: 9_999,
          ward: 9_999,
        })),
      },
    }
    const result = cast(state, hit(), [REFLECT, guarded])
    expect(unit(result, 'actor').hp).toBe(95)
  })
  it('uses mitigated damage when the incoming command explicitly applies Armor', () => {
    const initial = encounter()
    const state = {
      ...initial,
      statBridge: {
        combatants: initial.tactical.battle.combatants.map((combatant) => ({
          combatantId: combatant.id,
          armor: 100,
          ward: 100,
        })),
      },
    }
    const action = hit()
    action.effects = [
      { type: 'damage', recipient: 'primary-unit', amount: 20, defenseKind: 'armor' },
    ]
    const result = cast(state, action)
    expect(unit(result, 'target').hp).toBe(90)
    expect(unit(result, 'actor').hp).toBe(98)
  })
  it('does not extend the existing direct-only Barrier scope to reactive output', () => {
    const barrier = hit()
    barrier.effects = [{ type: 'barrier-change', recipient: 'actor', amount: 10 }]
    const protectedState = cast(encounter(), barrier).state
    const before = JSON.stringify(protectedState.effectState?.barriers)
    const result = cast(protectedState)
    expect(unit(result, 'actor').hp).toBe(95)
    expect(JSON.stringify(result.state.effectState?.barriers)).toBe(before)
  })
  it('coexists with HP and MP Absorb without reducing reflected damage', () => {
    const statuses = [REFLECT, ABSORB]
    const result = cast(encounter({ targetStatuses: statuses }), hit(), statuses)
    expect(unit(result, 'target')).toMatchObject({ hp: 85, mp: 15 })
    expect(unit(result, 'actor').hp).toBe(95)
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 20 },
    ])
  })
  it('does not trigger attacker Reflect or either Absorb from reflected damage', () => {
    const statuses = [REFLECT, ABSORB]
    const result = cast(encounter({ actorStatuses: statuses }), hit(), statuses)
    expect(unit(result, 'actor')).toMatchObject({ hp: 95, mp: 10 })
    expect(unit(result, 'target').hp).toBe(80)
    expect(reflected(result)).toHaveLength(1)
    expect(
      result.events.filter(
        (event) => event.event === 'healing_applied' || event.event === 'resource_changed',
      ),
    ).toEqual([])
  })
  it('can defeat the attacker and emits one correct terminal result', () => {
    const result = cast(encounter({ actorHp: 3, duel: true }))
    expect(unit(result, 'actor').hp).toBe(0)
    expect(completion(result)).toEqual([{ event: 'battle_completed', winningTeamId: 'enemies' }])
    expect(reflected(result)).toEqual([
      expect.objectContaining({ amount: 3, hpBefore: 3, hpAfter: 0 }),
    ])
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('allows a defeated defender to cause mutual KO before victory is finalized', () => {
    const result = cast(encounter({ actorHp: 5, targetHp: 20, duel: true }), hit(40))
    expect(unit(result, 'target').hp).toBe(0)
    expect(unit(result, 'actor').hp).toBe(0)
    expect(completion(result)).toEqual([{ event: 'battle_completed', winningTeamId: null }])
    expect(result.state.tactical.battle).toMatchObject({
      lifecycle: 'completed',
      currentTurn: null,
    })
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('records completion after reflection even when the attacker survives the final kill', () => {
    const result = cast(encounter({ targetHp: 20, duel: true }))
    expect(unit(result, 'actor').hp).toBe(95)
    expect(completion(result)).toEqual([{ event: 'battle_completed', winningTeamId: 'players' }])
    const index = result.events.findIndex(
      (event) => event.event === 'damage_applied' && event.actionId === 'status.reflect.current.v1',
    )
    expect(index).toBeGreaterThan(-1)
    expect(result.events.findIndex((event) => event.event === 'battle_completed')).toBeGreaterThan(
      index,
    )
  })
  it('excludes overkill from a defeated defender reflection basis', () => {
    const definition = reflectStatus(10_000)
    const result = cast(encounter({ targetHp: 2, targetStatuses: [definition] }), hit(100), [
      definition,
    ])
    expect(unit(result, 'actor').hp).toBe(98)
    expect(reflected(result)).toEqual([expect.objectContaining({ amount: 2 })])
  })
  it('ends a defeated actor turn and selects a living successor when both teams remain', () => {
    const result = cast(encounter({ actorHp: 3, allyWitness: true }))
    expect(unit(result, 'actor').hp).toBe(0)
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('target')
    expect(completion(result)).toEqual([])
    expect(result.events.filter((event) => event.event === 'turn_ended')).toHaveLength(1)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('resolves area defenders once each in stable order', () => {
    const action = hit()
    action.target = { ...action.target, shape: { kind: 'circle', radius: 1 } }
    action.effects = [{ type: 'damage', recipient: 'affected-units', amount: 20 }]
    const result = cast(encounter({ witnessReflects: true }), action)
    expect(unit(result, 'actor').hp).toBe(90)
    expect(reflected(result)).toEqual([
      expect.objectContaining({ sourceCombatantId: 'target', hpBefore: 100, hpAfter: 95 }),
      expect.objectContaining({ sourceCombatantId: 'witness', hpBefore: 95, hpAfter: 90 }),
    ])
  })
  it('does not damage an already-defeated attacker again for later area defenders', () => {
    const action = hit()
    action.target = { ...action.target, shape: { kind: 'circle', radius: 1 } }
    action.effects = [{ type: 'damage', recipient: 'affected-units', amount: 20 }]
    const result = cast(encounter({ actorHp: 3, witnessReflects: true }), action)
    expect(reflected(result)).toHaveLength(1)
    expect(completion(result)).toHaveLength(1)
  })
  it('caps combined authored stacks and statuses at 100 percent', () => {
    const first = reflectStatus(6_000)
    const second = reflectStatus(6_000, { id: 'test.reflect-second' })
    const result = cast(encounter({ targetStatuses: [first, second], stacks: 2 }), hit(), [
      first,
      second,
    ])
    expect(unit(result, 'actor').hp).toBe(80)
    expect(reflected(result)).toHaveLength(1)
  })
  it('does not reflect friendly fire', () => {
    const action = hit()
    action.target = { ...action.target, teamPolicy: 'any', friendlyFire: 'all-units' }
    expect(reflected(cast(encounter({ friendly: true }), action))).toEqual([])
  })
  it('preserves the existing rejection of unsupported generic self-damage', () => {
    const action = hit()
    action.effects = [{ type: 'damage', recipient: 'actor', amount: 5 }, ...action.effects]
    const initial = encounter({ actorStatuses: [REFLECT] })
    const snapshot = JSON.stringify(initial)
    expect(() => cast(initial, action)).toThrow(/self-damage-deferred/)
    expect(JSON.stringify(initial)).toBe(snapshot)
  })
  it('clears ongoing recovery when reflected damage defeats the attacker', () => {
    const initial = encounter({ actorHp: 3, allyWitness: true })
    initial.effectState = {
      ongoingRecovery: [
        {
          kind: 'hp',
          sourceCombatantId: 'actor',
          targetCombatantId: 'actor',
          sourceActionId: 'test.recovery',
          amountPerTick: 5,
          remainingFutureTicks: 2,
        },
      ],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    }
    const result = cast(initial)
    expect(unit(result, 'actor').hp).toBe(0)
    expect(result.state.effectState?.ongoingRecovery).toEqual([])
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('breaks concealment granted to the attacker after the ordinary damage block', () => {
    const invisible: CombatStatusDefinition = {
      id: 'test.invisible',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10_000,
      gameplayTags: ['Invisible'],
    }
    const action = hit()
    action.effects = [
      ...action.effects,
      { type: 'apply-status', recipient: 'actor', statusId: invisible.id, stacks: 1 },
    ]
    const result = cast(encounter(), action, [REFLECT, invisible])
    expect(unit(result, 'actor').hp).toBe(95)
    expect(result.state.statusState.find((row) => row.combatantId === 'actor')?.statuses).toEqual(
      [],
    )
  })
  it('excludes Burn backlash from the reflection basis', () => {
    const statuses = [...PHASE4_STATUSES, REFLECT]
    const burn = hit()
    burn.effects = [{ type: 'burn', recipient: 'actor' }]
    const initial = cast(encounter({ actorStatuses: [REFLECT] }), burn, statuses).state
    const result = cast(initial, hit(), statuses)
    expect(unit(result, 'actor').hp).toBe(93)
    expect(reflected(result)).toEqual([expect.objectContaining({ amount: 5 })])
  })
  it('does not reflect into an attacker already defeated by Burn backlash', () => {
    const statuses = [...PHASE4_STATUSES, REFLECT]
    const burn = hit()
    burn.effects = [{ type: 'burn', recipient: 'actor' }]
    const initial = cast(encounter({ actorHp: 2 }), burn, statuses).state
    const result = cast(initial, hit(), statuses)
    expect(unit(result, 'actor').hp).toBe(0)
    expect(reflected(result)).toEqual([])
    expect(completion(result)).toHaveLength(1)
  })
  it('does not reflect periodic turn-end damage', () => {
    const periodic: CombatStatusDefinition = {
      ...ABSORB,
      id: 'test.periodic',
      absorbHpBasisPoints: undefined,
      absorbMpBasisPoints: undefined,
      endOfTurn: { type: 'damage', amount: 4 },
    }
    const statuses = [REFLECT, periodic]
    const initial = encounter({ targetFirst: true, targetStatuses: statuses })
    const tactical = selectCurrentFinalFacing(initial.tactical, 'east').state
    const result = endCombatTurn({ ...initial, tactical }, { statuses })
    expect(unit(result, 'target').hp).toBe(96)
    expect(reflected(result)).toEqual([])
  })
  it('does not reflect zero damage or absent Reflect metadata', () => {
    expect(reflected(cast(encounter(), hit(0)))).toEqual([])
    expect(reflected(cast(encounter({ targetStatuses: [] }), hit(), []))).toEqual([])
  })
  it('leaves evaluation RNG-pure and committed input state immutable', () => {
    const initial = encounter()
    const before = JSON.stringify(initial)
    expect(
      evaluateCombatAction(
        initial,
        hit(),
        { kind: 'unit', combatantId: 'target' },
        { statuses: [REFLECT] },
      ).legal,
    ).toBe(true)
    const result = cast(initial)
    expect(JSON.stringify(initial)).toBe(before)
    expect(result.state.tactical.battle.rng).toEqual(initial.tactical.battle.rng)
    expect(unit(result, 'actor').hp).toBe(95)
    expect(result.resolution).toBeUndefined()
  })
  it('preserves ordinary legacy execution when no reactive status is authored', () => {
    const initial = encounter({ targetStatuses: [] })
    const action = hit()
    const previous = legacy.executeCombatAction(
      initial,
      action,
      { kind: 'unit', combatantId: 'target' },
      { statuses: [] },
    )
    const current = cast(initial, action, [])
    expect(current.state.tactical).toEqual(previous.state.tactical)
    expect(current.events).toEqual(previous.events)
  })
  it('consumes one K3 trigger budget per reflecting defender without mutating context', () => {
    const original = context()
    const snapshot = JSON.stringify(original)
    const result = cast(encounter(), hit(), [REFLECT], original)
    expect(unit(result, 'actor').hp).toBe(95)
    expect(result.resolution?.provenance).toEqual(original.provenance)
    expect(result.resolution?.triggerGuard.remainingReactionBudget).toBe(31)
    expect(result.resolution?.triggerGuard.executedInstanceIds).toHaveLength(1)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
  it('honors an exhausted K3 budget without cancelling the ordinary command', () => {
    const result = cast(encounter(), hit(), [REFLECT], context(0))
    expect(unit(result, 'target').hp).toBe(80)
    expect(unit(result, 'actor').hp).toBe(100)
    expect(reflected(result)).toEqual([])
    expect(result.resolution?.triggerGuard.remainingReactionBudget).toBe(0)
  })
  it('enforces the shared K3 budget across area defenders', () => {
    const action = hit()
    action.target = { ...action.target, shape: { kind: 'circle', radius: 1 } }
    action.effects = [{ type: 'damage', recipient: 'affected-units', amount: 20 }]
    const result = cast(encounter({ witnessReflects: true }), action, [REFLECT], context(1))
    expect(unit(result, 'actor').hp).toBe(95)
    expect(reflected(result)).toHaveLength(1)
    expect(result.resolution?.triggerGuard.remainingReactionBudget).toBe(0)
  })
  it('does not repeat an already-executed Reflect relationship within the same trigger chain', () => {
    const initial = context()
    const first = cast(encounter(), hit(), [REFLECT], initial)
    if (!first.resolution) throw new Error('Missing K3 resolution')
    const second = cast(encounter(), hit(), [REFLECT], {
      ...initial,
      triggerGuard: first.resolution.triggerGuard,
    })
    expect(reflected(first)).toHaveLength(1)
    expect(reflected(second)).toEqual([])
  })
  it.each([0, -1, 0.5, 10_001, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid reflection percentage %s',
    (rate) => {
      expect(() => validateCombatStatusDefinition(reflectStatus(rate))).toThrow(/Reflect/)
    },
  )
  it.each([1, 10_000])('accepts bounded reflection percentage %s', (rate) => {
    expect(() => validateCombatStatusDefinition(reflectStatus(rate))).not.toThrow()
  })
  it.each<Partial<CombatStatusDefinition>>([
    { polarity: 'negative' },
    { polarity: 'neutral' },
    { polarity: 'mixed' },
    { polarity: undefined },
    { reactionClass: 'ordinary' },
    { reactionClass: 'periodic' },
    { reactionClass: 'self-cost' },
    { reactionClass: 'system' },
    { reactionClass: undefined },
  ])('requires positive reactive Reflect metadata %j', (overrides) => {
    expect(() => validateCombatStatusDefinition(reflectStatus(2_500, overrides))).toThrow(/Reflect/)
  })
})

import { setTerrainOverlay, terrainOverlayAt } from './terrain-overlays'

function roundEndReflectEncounter(): CombatEncounterState {
  const initial = encounter({ actorHp: 3, allyWitness: true })
  const turn = initial.tactical.battle.currentTurn
  if (!turn) throw new Error('Missing fixture turn')
  return {
    ...initial,
    tactical: createTacticalBattleState({
      ...initial.tactical,
      battle: {
        ...initial.tactical.battle,
        combatants: initial.tactical.battle.combatants.map((combatant) => ({
          ...combatant,
          initiative: combatant.id === 'actor' ? 10 : combatant.id === 'target' ? 30 : 20,
        })),
        initiativeOrder: ['target', 'witness', 'actor'],
        turnNumber: 3,
        currentTurn: { ...turn, initiativeIndex: 2 },
      },
    }),
  }
}

describe('Reflect successor lifecycle regression', () => {
  it('decrements the surviving successor status exactly once after attacker defeat', () => {
    const initial = encounter({ actorHp: 3, allyWitness: true })
    const result = cast(initial)
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('target')
    expect(
      result.state.statusState.find((row) => row.combatantId === 'target')?.statuses[0]
        ?.remainingOwnerTurnStarts,
    ).toBe(1)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('expires the successor final status tick only after its earned reflection', () => {
    const initial = encounter({ actorHp: 3, allyWitness: true })
    initial.statusState = initial.statusState.map((row) => ({
      ...row,
      statuses: row.statuses.map((status) => ({ ...status, remainingOwnerTurnStarts: 1 })),
    }))
    const result = cast(initial)
    expect(reflected(result)).toEqual([expect.objectContaining({ amount: 3 })])
    expect(result.state.statusState.find((row) => row.combatantId === 'target')?.statuses).toEqual(
      [],
    )
    expect(result.events.filter((event) => event.event === 'status_expired')).toEqual([
      { event: 'status_expired', combatantId: 'target', statusId: REFLECT.id },
    ])
  })
  it('preserves durations when reflection does not advance the turn', () => {
    const result = cast(encounter({ allyWitness: true }))
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('actor')
    expect(
      result.state.statusState.find((row) => row.combatantId === 'target')?.statuses[0]
        ?.remainingOwnerTurnStarts,
    ).toBe(2)
    expect(result.events.filter((event) => event.event === 'status_expired')).toEqual([])
  })
  it('applies and consumes scheduled tempo when reflected defeat wraps the round', () => {
    const initial = roundEndReflectEncounter()
    const tempo: CombatStatusDefinition = {
      id: 'test.reflect-successor-tempo',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10_000,
      nextRoundInitiative: 20,
    }
    initial.statusState = initial.statusState.map((row) =>
      row.combatantId !== 'witness'
        ? row
        : {
            ...row,
            statuses: [
              {
                statusId: tempo.id,
                statusVersion: 1,
                stacks: 1,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'witness',
              },
            ],
          },
    )
    expect(validateCombatEncounterState(initial)).toEqual([])
    const result = cast(initial, hit(), [REFLECT, tempo])
    expect(result.state.tactical.battle.round).toBe(2)
    expect(result.state.tactical.battle.currentTurn?.combatantId).toBe('witness')
    expect(result.state.tactical.battle.roundInitiativeModifiers).toEqual([
      { combatantId: 'witness', amount: 20 },
    ])
    expect(result.state.statusState.find((row) => row.combatantId === 'witness')?.statuses).toEqual(
      [],
    )
    expect(result.events).toContainEqual({
      event: 'status_expired',
      combatantId: 'witness',
      statusId: tempo.id,
    })
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
  it('advances temporary terrain lifetime on a reflected round boundary', () => {
    const initial = setTerrainOverlay(
      roundEndReflectEncounter(),
      { x: 0, y: 0 },
      'frozen',
      'actor',
      'test.reflect-terrain',
    ).state
    const result = cast(initial)
    expect(result.state.tactical.battle.round).toBe(2)
    expect(terrainOverlayAt(result.state, { x: 0, y: 0 })?.remainingRoundBoundaries).toBe(1)
    expect(validateCombatEncounterState(result.state)).toEqual([])
  })
})
