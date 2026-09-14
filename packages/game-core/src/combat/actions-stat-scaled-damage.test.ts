import { describe, expect, it } from 'vitest'

import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createCombatEncounterState,
  executeCombatAction,
  P2_3_COMBAT_CONTENT,
  type CombatActionDefinition,
} from './actions'
import {
  STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1,
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

function action(
  effect: CombatActionDefinition['effects'][number],
): CombatActionDefinition {
  return {
    id: 'test.stat-scaled-damage',
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
      maximumElevationDifference: 1,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: true, mp: 0 },
    requirements: [],
    effects: [effect],
  }
}

function encounter(options?: {
  recruitFacing?: 'north' | 'east' | 'south' | 'west'
  armor?: number
  ward?: number
  physicalPower?: number
  mysticPower?: number
}): StatDrivenCombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:stat-scaled-damage',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 12345,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 30,
          maxMp: 30,
        },
      ],
    }),
  ).state

  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 2,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
      ],
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
      placements: [
        {
          combatantId: 'actor',
          position: { x: 0, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        },
        {
          combatantId: 'recruit',
          position: { x: 1, y: 0 },
          facing: options?.recruitFacing ?? 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )

  return createStatDrivenCombatEncounterState(base, [
    {
      combatantId: 'actor',
      provenance: { kind: 'character-derived', sourceId: 'character:actor', sourceRulesVersion: 2 },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: options?.physicalPower ?? 40,
      mysticPower: options?.mysticPower ?? 30,
    },
    {
      combatantId: 'recruit',
      provenance: { kind: 'scenario', sourceId: 'scenario:recruit', sourceRulesVersion: 2 },
      accuracy: 10_000,
      evasion: 0,
      armor: options?.armor ?? 100,
      ward: options?.ward ?? 100,
      jump: 0,
      physicalPower: 20,
      mysticPower: 20,
    },
  ])
}

function damageAppliedAmount(
  state: StatDrivenCombatEncounterState,
  combatAction: CombatActionDefinition,
): number {
  const transition = executeCombatAction(
    state,
    combatAction,
    { kind: 'unit', combatantId: 'recruit' },
    P2_3_COMBAT_CONTENT,
  )
  const damage = transition.events.find((event) => event.event === 'damage_applied')
  if (!damage || damage.event !== 'damage_applied') throw new Error('Expected damage event.')
  return damage.amount
}

describe('stat-scaled damage resolution', () => {
  it('adds Physical Power scaling before Armor mitigation', () => {
    const scaled = action({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 12,
      scaling: { source: 'physical-power', coefficientBasisPoints: 5_000 },
      defenseKind: 'armor',
    })

    // 12 + floor(40 * 0.5) = 32 raw; Armor 100 halves it to 16.
    expect(damageAppliedAmount(encounter(), scaled)).toBe(16)
  })

  it('supports explicit Mystic Power scaling through Ward', () => {
    const scaled = action({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 10,
      scaling: { source: 'mystic-power', coefficientBasisPoints: 5_000 },
      defenseKind: 'ward',
    })

    // 10 + floor(30 * 0.5) = 25 raw; Ward 100 floors 12.5 to 12.
    expect(damageAppliedAmount(encounter(), scaled)).toBe(12)
  })

  it('applies facing after scaling and defense mitigation', () => {
    const scaledRear = action({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 12,
      scaling: { source: 'physical-power', coefficientBasisPoints: 5_000 },
      defenseKind: 'armor',
      facingModifiersBasisPoints: { front: 10_000, side: 11_000, rear: 12_500 },
    })

    // 32 raw -> 16 after Armor 100 -> 20 from rear 1.25x.
    expect(damageAppliedAmount(encounter({ recruitFacing: 'east' }), scaledRear)).toBe(20)
  })

  it('preserves the old pipeline exactly when scaling metadata is absent', () => {
    const unscaled = action({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 12,
      defenseKind: 'armor',
    })

    expect(damageAppliedAmount(encounter({ physicalPower: 999, mysticPower: 999 }), unscaled)).toBe(6)
  })

  it('fails closed instead of treating missing historical offensive power as zero', () => {
    const current = encounter()
    const legacy: StatDrivenCombatEncounterState = {
      ...current,
      statBridge: {
        schemaVersion: STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1,
        rulesVersion: 1,
        combatants: current.statBridge.combatants.map(
          ({ physicalPower: _physicalPower, mysticPower: _mysticPower, ...profile }) => profile,
        ),
      },
    }
    const scaled = action({
      type: 'damage',
      recipient: 'primary-unit',
      amount: 12,
      scaling: { source: 'physical-power', coefficientBasisPoints: 5_000 },
      defenseKind: 'armor',
    })

    expect(() => damageAppliedAmount(legacy, scaled)).toThrow(
      'Scaled Skill damage requires attacker offensive power.',
    )
  })
})
