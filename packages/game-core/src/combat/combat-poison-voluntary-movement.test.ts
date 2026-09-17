import { describe, expect, it } from 'vitest'
import { createCombatEncounterState, type CombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, type GridPosition } from './board'
import {
  createPv1fTemporaryResources,
  evaluatePv1fMovement,
  executePv1fMovement,
  readPv1fActionEconomy,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'

const PATH: readonly GridPosition[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 2, y: 0 },
  { x: 3, y: 0 },
]

function movementEncounter(actorHp = 30): StatDrivenCombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'poison-voluntary-movement',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 97,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 5,
          hp: actorHp,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(10),
        },
        {
          id: 'enemy',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 5,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
          temporaryResources: createPv1fTemporaryResources(10),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 6,
    height: 1,
    terrains: [{ id: 'open', traversalCost: 1 }],
    tiles: Array.from({ length: 6 }, (_, x) => ({
      position: { x, y: 0 },
      elevation: 0,
      terrainId: 'open',
    })),
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
        position: { x: 5, y: 0 },
        facing: 'west',
        movementProfileId: 'ground',
      },
    ],
  })
  const base = createStatDrivenCombatEncounterState(
    createCombatEncounterState(tactical),
    ['actor', 'enemy'].map((combatantId) => ({
      combatantId,
      provenance: {
        kind: 'scenario' as const,
        sourceId: 'scenario:poison-movement',
        sourceRulesVersion: 1,
      },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
    })),
  )
  return {
    ...base,
    effectState: {
      ongoingRecovery: [],
      poison: [
        {
          targetCombatantId: 'actor',
          sourceCombatantId: 'enemy',
          sourceActionId: 'test.poison-source',
          profileVersion: 1,
          movementRemainder: 4,
        },
      ],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    },
  }
}

function actorHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((row) => row.id === 'actor')!.hp
}

function actorX(state: CombatEncounterState): number {
  return state.tactical.placements.find((row) => row.combatantId === 'actor')!.position.x
}

describe('current Poison voluntary movement', () => {
  it('counts every entered tile, deals threshold damage and charges AP for the traversed path', () => {
    const result = executePv1fMovement(movementEncounter(), PATH)

    expect(actorX(result.state)).toBe(3)
    expect(actorHp(result.state)).toBe(28)
    expect(result.state.effectState?.poison[0]?.movementRemainder).toBe(2)
    expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(40)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        actionId: 'status.poison.current.v1',
        targetCombatantId: 'actor',
        amount: 2,
      }),
    )
  })

  it('stops on the lethal threshold tile, charges only entered-tile AP and completes the battle', () => {
    const result = executePv1fMovement(movementEncounter(2), PATH)

    expect(actorX(result.state)).toBe(1)
    expect(actorHp(result.state)).toBe(0)
    expect(result.state.effectState?.poison[0]?.movementRemainder).toBe(0)
    expect(readPv1fActionEconomy(result.state, 'actor')?.current).toBe(80)
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
    expect(result.state.tactical.battle.currentTurn).toBeNull()
    expect(result.events).toContainEqual({ event: 'battle_completed', winningTeamId: 'enemies' })
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'combatant_moved',
        combatantId: 'actor',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
      }),
    )
  })

  it('previews the deterministic Poison stop and AP cost without mutating encounter state', () => {
    const state = movementEncounter(2)
    const preview = evaluatePv1fMovement(state, PATH)

    expect(preview.movement.legal).toBe(true)
    expect(preview.movement.destination).toEqual({ x: 1, y: 0 })
    expect(preview.economyCost).toBe(20)
    expect(preview.poisonForecast).toEqual({
      traversedTiles: 1,
      triggeredTicks: 1,
      damage: 2,
      willDefeat: true,
    })
    expect(actorX(state)).toBe(0)
    expect(actorHp(state)).toBe(2)
    expect(state.effectState?.poison[0]?.movementRemainder).toBe(4)
  })
})
