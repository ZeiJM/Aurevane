import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'

export function percentageDotEncounter() {
  const ids = ['actor', 'enemy', 'other', 'ally']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'percentage-dots',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 42,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || id === 'ally' ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 4,
        hp: 1000,
        maxHp: 1000,
        mp: 20,
        maxMp: 20,
      })),
    }),
  ).state
  const positions = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 1, y: 2 },
  ]
  const state = createStatDrivenCombatEncounterState(
    createCombatEncounterState(
      createTacticalBattleState({
        battle,
        width: 5,
        height: 5,
        terrains: [{ id: 'open', traversalCost: 1 }],
        tiles: Array.from({ length: 25 }, (_, i) => ({
          position: { x: i % 5, y: Math.floor(i / 5) },
          elevation: 0,
          terrainId: 'open',
        })),
        movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
        placements: ids.map((combatantId, i) => ({
          combatantId,
          position: positions[i]!,
          facing: 'west',
          movementProfileId: 'ground',
        })),
      }),
    ),
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: 'scenario:percentage-dots', sourceRulesVersion: 1 },
      accuracy: 10000,
      evasion: 0,
      armor: 0,
      ward: 0,
      physicalPower: 20,
      mysticPower: 20,
      jump: 0,
    })),
  )
  return {
    ...state,
    percentageDotPolicyVersion: 1 as const,
    effectStackingPolicyVersion: 1 as const,
  }
}
