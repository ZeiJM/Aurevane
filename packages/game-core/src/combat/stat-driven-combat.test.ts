import { describe, expect, it } from 'vitest'

import { createPendingBattle, startBattle } from './battle-state'
import {
  createCombatEncounterState,
  P2_3_COMBAT_CONTENT,
  P2_3_UNARMED_ATTACK_PROFILE,
  createBasicAttackDefinition,
} from './actions'
import { createTacticalBattleState } from './board'
import {
  calculateHitChanceBasisPoints,
  createStatDrivenCombatEncounterState,
  executeStatDrivenAttack,
  forecastStatDrivenAttack,
  mitigateDamageByDefense,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

const attack = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)

function profile(
  combatantId: string,
  overrides: Partial<
    Pick<StatDrivenCombatProfile, 'accuracy' | 'evasion' | 'armor' | 'ward' | 'jump'>
  > = {},
): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: combatantId === 'player' ? 'character-derived' : 'scenario',
      sourceId: combatantId === 'player' ? 'character:test-player' : 'scenario:test-recruit',
      sourceRulesVersion: 1,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
    ...overrides,
  }
}

function encounter(
  playerProfile = profile('player'),
  recruitProfile = profile('recruit', { armor: 23 }),
) {
  const pending = createPendingBattle({
    battleId: 'battle:stat-bridge-test',
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 123_456_789,
    combatants: [
      {
        id: 'player',
        teamId: 'players',
        initiative: 20,
        baseMovementBudget: 4,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: 10,
        baseMovementBudget: 4,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
      },
    ],
  })
  const active = startBattle(pending).state
  const tactical = createTacticalBattleState({
    battle: active,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: playerProfile.jump, terrainCostOverrides: [] },
      { id: 'recruit-ground', maxElevationStep: recruitProfile.jump, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'recruit',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'recruit-ground',
      },
    ],
  })

  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    playerProfile,
    recruitProfile,
  ])
}

describe('stat-driven Phase 2 combat bridge', () => {
  it('uses accuracy minus evasion as the versioned hit-chance forecast', () => {
    const actor = profile('player', { accuracy: 7_750 })
    const target = profile('recruit', { evasion: 1_120 })

    expect(calculateHitChanceBasisPoints(actor, target)).toBe(6_630)
  })

  it('uses the same deterministic mitigation grammar for Armor and Ward ratings', () => {
    expect(mitigateDamageByDefense(16, 23)).toBe(13)
    expect(mitigateDamageByDefense(16, 40)).toBe(11)
  })

  it('forecasts Armor mitigation without consuming authoritative RNG', () => {
    const state = encounter()
    const forecast = forecastStatDrivenAttack(
      state,
      attack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    )

    expect(forecast.hitChanceBasisPoints).toBe(10_000)
    expect(forecast.defenseKind).toBe('armor')
    expect(forecast.defenseRating).toBe(23)
    expect(forecast.mitigatedBaseDamage).toBe(13)
    expect(forecast.evaluation.projectedEffects).toEqual([
      { effectType: 'damage', combatantId: 'recruit', before: 50, after: 37 },
    ])
    expect(state.tactical.battle.rng.draws).toBe(0)
  })

  it('consumes one server RNG draw and applies the mitigated hit deterministically', () => {
    const state = encounter()
    const transition = executeStatDrivenAttack(
      state,
      attack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    )

    expect(transition.state.tactical.battle.rng.draws).toBe(1)
    expect(transition.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'stat_driven_attack_resolved',
          hit: true,
          hitChanceBasisPoints: 10_000,
          defenseRating: 23,
          rulesVersion: 1,
        }),
        expect.objectContaining({ event: 'damage_applied', amount: 13 }),
      ]),
    )
  })

  it('spends the Action but applies no damage on a deterministic zero-chance miss', () => {
    const state = encounter(
      profile('player', { accuracy: 0 }),
      profile('recruit', { evasion: 10_000, armor: 23 }),
    )
    const transition = executeStatDrivenAttack(
      state,
      attack,
      { kind: 'unit', combatantId: 'recruit' },
      P2_3_COMBAT_CONTENT,
    )

    expect(transition.state.tactical.battle.rng.draws).toBe(1)
    expect(
      transition.state.tactical.battle.combatants.find((row) => row.id === 'recruit')?.hp,
    ).toBe(50)
    expect(transition.state.tactical.battle.currentTurn?.actionState).toBe('spent')
    expect(transition.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'stat_driven_attack_resolved', hit: false }),
        expect.objectContaining({ event: 'action_spent', combatantId: 'player' }),
      ]),
    )
    expect(transition.events.some((event) => event.event === 'damage_applied')).toBe(false)
  })

  it('fails closed when a persisted stat profile is missing', () => {
    const state = encounter()
    const malformed = {
      ...state,
      statBridge: {
        ...state.statBridge,
        combatants: state.statBridge.combatants.filter((row) => row.combatantId !== 'recruit'),
      },
    }

    expect(validateStatDrivenCombatEncounterState(malformed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'statBridge.combatants' })]),
    )
  })
})
