import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  COMBAT_CRITICAL_DAMAGE_BASIS_POINTS,
  forecastCombatCritical,
  rollCombatCritical,
} from './combat-critical'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(combatantId: string, criticalChance: number): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: combatantId === 'actor' ? 'character-derived' : 'scenario',
      sourceId: combatantId === 'actor' ? 'character:critical-actor' : `scenario:${combatantId}`,
      sourceRulesVersion: 3,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 0,
    level: 50,
    physicalPower: 40,
    mysticPower: 40,
    criticalChance,
  }
}

function encounter(
  criticalChance: number,
  targets: readonly string[] = ['target-a'],
): StatDrivenCombatEncounterState {
  const combatants = [
    {
      id: 'actor',
      teamId: 'players',
      initiative: 30,
      baseMovementBudget: 4,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
    },
    ...targets.map((id, index) => ({
      id,
      teamId: 'opponents',
      initiative: 20 - index,
      baseMovementBudget: 4,
      hp: 100,
      maxHp: 100,
      mp: 30,
      maxMp: 30,
    })),
  ]
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:a03-critical',
      rulesVersion: 3,
      contentVersion: 3,
      rngSeed: 123_456_789,
      combatants,
    }),
  ).state
  const tiles = combatants.map((_, index) => ({
    position: { x: index, y: 0 },
    elevation: 0,
    terrainId: 'open',
  }))
  const profiles = [
    profile('actor', criticalChance),
    ...targets.map((id) => profile(id, 0)),
  ]
  const tactical = createTacticalBattleState({
    battle,
    width: combatants.length,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles,
    movementProfiles: profiles.map((row) => ({
      id: `ground:${row.combatantId}`,
      maxElevationStep: 0,
      terrainCostOverrides: [],
    })),
    placements: combatants.map((row, index) => ({
      combatantId: row.id,
      position: { x: index, y: 0 },
      facing: index === 0 ? ('east' as const) : ('west' as const),
      movementProfileId: `ground:${row.id}`,
    })),
  })
  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), profiles)
}

function action(
  effects: CombatActionDefinition['effects'],
  target: CombatActionDefinition['target'] = {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 1,
    maximumRange: 3,
    requiresLineOfSight: false,
    maximumElevationDifference: 1,
    friendlyFire: 'enemies-only',
  },
): CombatActionDefinition {
  return {
    id: 'test.a03-critical',
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['attack'],
    target,
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
    accuracyMode: 'automatic',
  }
}

describe('A03 authoritative Critical Chance', () => {
  it('keeps preview RNG-pure while exposing the committed critical chance', () => {
    const state = encounter(2_500)
    const definition = action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }])
    const evaluation = evaluateCombatAction(
      state,
      definition,
      { kind: 'unit', combatantId: 'target-a' },
      { statuses: [] },
    )
    const forecast = forecastCombatCritical(state, definition, evaluation, new Set())

    expect(forecast.targetCriticalChances).toEqual([
      { targetCombatantId: 'target-a', criticalChanceBasisPoints: 2_500 },
    ])
    expect(state.tactical.battle.rng.draws).toBe(0)
  })

  it('treats 0% and 100% as deterministic endpoints without consuming RNG', () => {
    for (const [chance, expectedCritical] of [
      [0, false],
      [10_000, true],
    ] as const) {
      const state = encounter(chance)
      const definition = action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }])
      const evaluation = evaluateCombatAction(
        state,
        definition,
        { kind: 'unit', combatantId: 'target-a' },
        { statuses: [] },
      )
      const rolled = rollCombatCritical(state, definition, evaluation, new Set())

      expect(rolled.state.tactical.battle.rng.draws).toBe(0)
      expect(rolled.events).toEqual([
        expect.objectContaining({
          targetCombatantId: 'target-a',
          criticalChanceBasisPoints: chance,
          rollBasisPoints: null,
          critical: expectedCritical,
        }),
      ])
    }
  })

  it('uses one RNG draw for an intermediate target chance', () => {
    const state = encounter(5_000)
    const definition = action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }])
    const evaluation = evaluateCombatAction(
      state,
      definition,
      { kind: 'unit', combatantId: 'target-a' },
      { statuses: [] },
    )
    const rolled = rollCombatCritical(state, definition, evaluation, new Set())
    const event = rolled.events[0]

    expect(rolled.state.tactical.battle.rng.draws).toBe(1)
    expect(event?.rollBasisPoints).toEqual(expect.any(Number))
    expect(event?.critical).toBe((event?.rollBasisPoints ?? 10_000) < 5_000)
  })

  it('shares one target-level critical result across every direct damage packet', () => {
    const state = encounter(10_000)
    const definition = action([
      { type: 'damage', recipient: 'primary-unit', amount: 4 },
      { type: 'damage', recipient: 'primary-unit', amount: 6 },
    ])
    const transition = executeCombatAction(
      state,
      definition,
      { kind: 'unit', combatantId: 'target-a' },
      { statuses: [] },
    )

    expect(COMBAT_CRITICAL_DAMAGE_BASIS_POINTS).toBe(15_000)
    expect(
      transition.events.filter(
        (event) =>
          typeof event === 'object' &&
          event !== null &&
          'event' in event &&
          event.event === 'combat_critical_resolved',
      ),
    ).toHaveLength(1)
    expect(
      transition.state.tactical.battle.combatants.find((row) => row.id === 'target-a')?.hp,
    ).toBe(85)
  })

  it('resolves multi-target critical events in stable target id order', () => {
    const state = encounter(10_000, ['target-b', 'target-a'])
    const definition = action(
      [{ type: 'damage', recipient: 'affected-units', amount: 10 }],
      {
        kind: 'unit',
        teamPolicy: 'enemy',
        shape: { kind: 'line', length: 3 },
        minimumRange: 1,
        maximumRange: 3,
        requiresLineOfSight: false,
        maximumElevationDifference: 1,
        friendlyFire: 'enemies-only',
      },
    )
    const evaluation = evaluateCombatAction(
      state,
      definition,
      { kind: 'unit', combatantId: 'target-b' },
      { statuses: [] },
    )
    const rolled = rollCombatCritical(state, definition, evaluation, new Set())

    expect(rolled.events.map((event) => event.targetCombatantId)).toEqual([
      'target-a',
      'target-b',
    ])
  })

  it('does not roll for an accuracy-missed target', () => {
    const state = encounter(5_000)
    const definition = action([{ type: 'damage', recipient: 'primary-unit', amount: 10 }])
    const evaluation = evaluateCombatAction(
      state,
      definition,
      { kind: 'unit', combatantId: 'target-a' },
      { statuses: [] },
    )
    const rolled = rollCombatCritical(state, definition, evaluation, new Set(['target-a']))

    expect(rolled.events).toEqual([])
    expect(rolled.state.tactical.battle.rng.draws).toBe(0)
  })

  it('excludes Vengeance and non-direct damage operations from critical eligibility', () => {
    const state = encounter(10_000)
    const definition = action([
      {
        type: 'damage',
        recipient: 'primary-unit',
        amount: 0,
        vengeance: { conversionBasisPoints: 10_000, maximumDamage: 50 },
      },
      { type: 'burn', recipient: 'primary-unit' },
      { type: 'bleed', recipient: 'primary-unit', damagePerTick: 3, ticks: 3 },
      { type: 'poison', recipient: 'primary-unit' },
    ])
    const evaluation = evaluateCombatAction(
      state,
      definition,
      { kind: 'unit', combatantId: 'target-a' },
      { statuses: [] },
    )
    const rolled = rollCombatCritical(state, definition, evaluation, new Set())

    expect(rolled.events).toEqual([])
    expect(rolled.criticalEffectOrdinalsByTarget.size).toBe(0)
  })
})
