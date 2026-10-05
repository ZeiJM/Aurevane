import { describe, expect, it } from 'vitest'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createBasicAttackDefinition,
  createCombatEncounterState,
  P2_3_COMBAT_CONTENT,
  P2_3_UNARMED_ATTACK_PROFILE,
  type CombatActionDefinition,
} from './actions'
import {
  createStatBalancedCombatEncounterState,
  createStatDrivenCombatEncounterState,
  forecastStatDrivenAttack,
  executeStatDrivenAttack,
  reattachStatDrivenCombatBridge,
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatProfileV4,
} from './stat-driven-combat'
import { forecastCombatSkillAccuracyForTarget } from './combat-skill-accuracy'
import { terrainAdjustedDefense, terrainEvasionBonusBasisPoints } from './combat-stat-balance'

function fixture(height = 0, accuracy = 14_000, evasion = 5_500) {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:stat-balance',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 123456789,
      combatants: ['actor', 'target'].map((id, index) => ({
        id,
        teamId: id,
        initiative: 20 - index,
        baseMovementBudget: 4,
        hp: 200,
        maxHp: 200,
        mp: 48,
        maxMp: 48,
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'ground', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, terrainId: 'ground', elevation: Math.max(0, height - 1) },
        { position: { x: 1, y: 0 }, terrainId: 'ground', elevation: height },
      ],
      movementProfiles: [{ id: 'ground', maxElevationStep: 3, terrainCostOverrides: [] }],
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
  )
  const profiles: StatDrivenCombatProfileV4[] = ['actor', 'target'].map((id) => ({
    combatantId: id,
    provenance: { kind: 'scenario', sourceId: `scenario:${id}`, sourceRulesVersion: 4 },
    accuracy: id === 'actor' ? accuracy : 8500,
    evasion: id === 'target' ? evasion : 0,
    armor: 120,
    ward: 160,
    jump: 3,
    physicalPower: 120,
    mysticPower: 120,
    level: 1,
    criticalChance: 1500,
    statusResistance: 1000,
  }))
  return { base, profiles }
}
const attack = createBasicAttackDefinition(P2_3_UNARMED_ATTACK_PROFILE)
const skill: CombatActionDefinition = {
  ...attack,
  id: 'skill:test',
  sourceType: 'discipline-skill',
  accuracyMode: 'per-target',
  target: { ...attack.target, maximumElevationDifference: 3 },
}

describe('Owner stat balance policy', () => {
  it('pins ratings above100% and resistance without replacing bridge4', () => {
    const { base, profiles } = fixture()
    const state = createStatBalancedCombatEncounterState(base, profiles)
    expect(state.statBalancePolicyVersion).toBe(1)
    expect(state.statBridge.schemaVersion).toBe(4)
    expect(state.statBridge.combatants[0]?.statusResistance).toBe(1000)
    expect(
      forecastStatDrivenAttack(
        state,
        attack,
        { kind: 'unit', combatantId: 'target' },
        P2_3_COMBAT_CONTENT,
      ).hitChanceBasisPoints,
    ).toBe(8500)
    expect(
      forecastCombatSkillAccuracyForTarget(state, skill, 'actor', 'target', P2_3_COMBAT_CONTENT)
        ?.hitChanceBasisPoints,
    ).toBe(8500)
    const committed = executeStatDrivenAttack(
      state,
      attack,
      { kind: 'unit', combatantId: 'target' },
      P2_3_COMBAT_CONTENT,
    )
    expect(
      committed.events.find((event) => event.event === 'stat_driven_attack_resolved'),
    ).toMatchObject({ hitChanceBasisPoints: 8500 })
    expect(
      reattachStatDrivenCombatBridge(committed.state, state.statBridge).statBalancePolicyVersion,
    ).toBe(1)
  })
  it.each([
    [1, 1500],
    [2, 2000],
    [3, 2500],
  ])('derives height%s bonuses and reduces both defenses', (height, bonus) => {
    const { base, profiles } = fixture(height, 11000, 2500)
    const state = createStatBalancedCombatEncounterState(base, profiles)
    expect(terrainEvasionBonusBasisPoints(state, 'target')).toBe(bonus)
    expect(terrainEvasionBonusBasisPoints(state, 'target', height - 1)).toBe(bonus)
    expect(terrainEvasionBonusBasisPoints(state, 'target', height)).toBe(0)
    expect(terrainAdjustedDefense(state, 'target', 120)).toBe(96)
    expect(terrainAdjustedDefense(state, 'target', 160)).toBe(128)
    expect(
      forecastCombatSkillAccuracyForTarget(state, skill, 'actor', 'target', P2_3_COMBAT_CONTENT)
        ?.hitChanceBasisPoints,
    ).toBe(8500)
    const limited = {
      ...skill,
      target: { ...skill.target, maximumElevationDifference: height - 1 },
    }
    expect(
      forecastCombatSkillAccuracyForTarget(state, limited, 'actor', 'target', P2_3_COMBAT_CONTENT)
        ?.hitChanceBasisPoints,
    ).toBe(8500 - bonus)
    if (height <= 1)
      expect(
        forecastStatDrivenAttack(
          state,
          attack,
          { kind: 'unit', combatantId: 'target' },
          P2_3_COMBAT_CONTENT,
        ).hitChanceBasisPoints,
      ).toBe(8500 - bonus)
  })
  it('removes terrain modifiers immediately on flat ground and preserves historical rules', () => {
    const { base, profiles } = fixture(2, 9000, 2500)
    const historical = createStatDrivenCombatEncounterState(base, profiles)
    expect(terrainAdjustedDefense(historical, 'target', 120)).toBe(120)
    expect(terrainEvasionBonusBasisPoints(historical, 'target')).toBe(0)
    const state = createStatBalancedCombatEncounterState(base, profiles)
    const flat = {
      ...state,
      tactical: {
        ...state.tactical,
        tiles: state.tactical.tiles.map((tile) => ({ ...tile, elevation: 0 })),
      },
    }
    expect(terrainAdjustedDefense(flat, 'target', 120)).toBe(120)
    expect(terrainEvasionBonusBasisPoints(flat, 'target')).toBe(0)
  })
  it('rejects out-of-policy ratings and missing resistance, while old bridge rejects >100%', () => {
    const { base, profiles } = fixture()
    expect(() => createStatDrivenCombatEncounterState(base, profiles)).toThrow(/accuracy/)
    const state = createStatBalancedCombatEncounterState(base, profiles)
    expect(
      validateStatDrivenCombatEncounterState({
        ...state,
        statBridge: {
          ...state.statBridge,
          combatants: state.statBridge.combatants.map((row) => ({ ...row, accuracy: 14001 })),
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'statBridge.combatants.0.accuracy' }),
      ]),
    )
    expect(
      validateStatDrivenCombatEncounterState({
        ...state,
        statBridge: {
          ...state.statBridge,
          combatants: state.statBridge.combatants.map((profile) => {
            const row = { ...profile }
            delete row.statusResistance
            return row
          }),
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'statBridge.combatants.0.statusResistance' }),
      ]),
    )
  })
})
