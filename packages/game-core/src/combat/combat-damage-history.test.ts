import { describe, expect, it } from 'vitest'

import { createCombatEncounterState, type CombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { recentCombatDamageSuffered, recordCombatDamageHistory } from './combat-damage-history'
import type { DamageProvenance } from './combat-effect-state'

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k4-damage-history',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 37,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 30,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'ally',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 40,
          maxMp: 40,
        },
        {
          id: 'foe',
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

  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open' },
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
          combatantId: 'ally',
          position: { x: 1, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        },
        {
          combatantId: 'foe',
          position: { x: 2, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

function provenance(
  kind: DamageProvenance['kind'],
  sourceCombatantId: string | null = 'actor',
): DamageProvenance {
  return {
    kind,
    sourceCombatantId,
    sourceActionId: 'test.damage-history',
    commandExecutionId: 'command:damage-history',
  }
}

describe('P4.K4 bounded combat damage history', () => {
  it('records and aggregates hostile direct and periodic actual HP damage by victim and round', () => {
    const initial = encounter()
    const direct = recordCombatDamageHistory(initial, {
      targetCombatantId: 'foe',
      amount: 7,
      provenance: provenance('direct-hostile'),
    })
    const periodic = recordCombatDamageHistory(direct, {
      targetCombatantId: 'foe',
      amount: 5,
      provenance: provenance('periodic-hostile'),
    })

    expect(periodic.effectState?.damageHistory).toEqual([
      { combatantId: 'foe', round: 1, amount: 12 },
    ])
    expect(recentCombatDamageSuffered(periodic, 'foe')).toBe(12)
    expect(initial.effectState?.damageHistory ?? []).toEqual([])
  })

  it.each([
    ['reactive', 'foe', 'actor'],
    ['self-cost', 'actor', 'actor'],
    ['system', 'foe', null],
    ['direct-hostile', 'actor', 'actor'],
    ['direct-hostile', 'ally', 'actor'],
  ] as const)('does not record excluded %s damage to %s', (kind, targetCombatantId, sourceId) => {
    const initial = encounter()
    const next = recordCombatDamageHistory(initial, {
      targetCombatantId,
      amount: 9,
      provenance: provenance(kind, sourceId),
    })

    expect(next.effectState?.damageHistory ?? []).toEqual([])
    expect(initial.effectState?.damageHistory ?? []).toEqual([])
  })

  it('prunes entries older than the current plus previous two rounds when recording', () => {
    const base = encounter()
    const state: CombatEncounterState = {
      ...base,
      tactical: {
        ...base.tactical,
        battle: { ...base.tactical.battle, round: 4 },
      },
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [
          { combatantId: 'foe', round: 1, amount: 3 },
          { combatantId: 'foe', round: 2, amount: 4 },
          { combatantId: 'foe', round: 3, amount: 5 },
        ],
      },
    }

    const next = recordCombatDamageHistory(state, {
      targetCombatantId: 'foe',
      amount: 6,
      provenance: provenance('direct-hostile'),
    })

    expect(next.effectState?.damageHistory).toEqual([
      { combatantId: 'foe', round: 2, amount: 4 },
      { combatantId: 'foe', round: 3, amount: 5 },
      { combatantId: 'foe', round: 4, amount: 6 },
    ])
    expect(state.effectState?.damageHistory).toHaveLength(3)
  })

  it('ignores stale historical entries when reading the three-round sliding window', () => {
    const base = encounter()
    const state: CombatEncounterState = {
      ...base,
      tactical: {
        ...base.tactical,
        battle: { ...base.tactical.battle, round: 5 },
      },
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [
          { combatantId: 'foe', round: 1, amount: 50 },
          { combatantId: 'foe', round: 3, amount: 7 },
          { combatantId: 'foe', round: 4, amount: 8 },
          { combatantId: 'foe', round: 5, amount: 9 },
        ],
      },
    }

    expect(recentCombatDamageSuffered(state, 'foe')).toBe(24)
  })
})
