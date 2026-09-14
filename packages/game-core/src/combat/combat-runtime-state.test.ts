import { describe, expect, expectTypeOf, it } from 'vitest'

import { createCombatEncounterState, type CombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  normalizeCombatRuntimeEncounterState,
  type CombatRuntimeEncounterState,
} from './combat-runtime-state'

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'kernel-runtime-normalization',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 2,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'enemy',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 2,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state

  return createCombatEncounterState(
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
          combatantId: 'enemy',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

describe('combat runtime encounter normalization', () => {
  it('upgrades historical-compatible optional slices into a complete internal runtime shape', () => {
    const persisted = encounter()

    expect(persisted.effectState).toBeUndefined()
    expect(persisted.terrainOverlays).toBeUndefined()
    expect(persisted.statBridge).toBeUndefined()
    expect(persisted.turnOrigin).toBeUndefined()

    const runtime = normalizeCombatRuntimeEncounterState(persisted)

    expect(runtime.effectState).toEqual({
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    })
    expect(runtime.terrainOverlays).toEqual([])
    expect(runtime.statBridge).toBeNull()
    expect(runtime.turnOrigin).toBeNull()
    expect(runtime.tactical).toBe(persisted.tactical)
    expect(runtime.statusState).toBe(persisted.statusState)
    expectTypeOf(runtime).toEqualTypeOf<CombatRuntimeEncounterState>()
  })

  it('preserves already-present valid runtime slices without mutating the persisted input', () => {
    const base = encounter()
    const persisted: CombatEncounterState = {
      ...base,
      statBridge: {
        combatants: [
          { combatantId: 'actor', armor: 12, ward: 7 },
          { combatantId: 'enemy', armor: 9, ward: 11 },
        ],
      },
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [],
      },
      terrainOverlays: [],
      turnOrigin: {
        combatantId: 'actor',
        turnNumber: base.tactical.battle.turnNumber,
        position: { x: 0, y: 0 },
      },
    }
    const before = JSON.stringify(persisted)

    const runtime = normalizeCombatRuntimeEncounterState(persisted)

    expect(JSON.stringify(persisted)).toBe(before)
    expect(runtime.statBridge).toEqual(persisted.statBridge)
    expect(runtime.effectState).toEqual(persisted.effectState)
    expect(runtime.terrainOverlays).toEqual(persisted.terrainOverlays)
    expect(runtime.turnOrigin).toEqual(persisted.turnOrigin)
  })

  it('fails closed on malformed persisted encounter state instead of coercing it', () => {
    const persisted = encounter()
    const malformed = {
      ...persisted,
      statusState: [],
    } as CombatEncounterState

    expect(() => normalizeCombatRuntimeEncounterState(malformed)).toThrow(
      /Invalid combat encounter state: statusState:/,
    )
  })
})
