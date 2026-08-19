import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createPv1fTemporaryResources,
  executePv1fAction,
  PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  PV1F_BASIC_ATTACK_COST,
  PV1F_BASIC_ATTACK_ID,
} from './pv1f-action-economy'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(combatantId: string): StatDrivenCombatProfile {
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
  }
}

function lethalEncounter(actorId: 'player' | 'recruit'): StatDrivenCombatEncounterState {
  const playerProfile = profile('player')
  const recruitProfile = profile('recruit')
  const playerActsFirst = actorId === 'player'
  const pending = createPendingBattle({
    battleId: `battle:pv1f-lethal:${actorId}`,
    rulesVersion: 1,
    contentVersion: 1,
    rngSeed: 123_456_789,
    combatants: [
      {
        id: 'player',
        teamId: 'players',
        initiative: playerActsFirst ? 20 : 10,
        baseMovementBudget: 4,
        hp: playerActsFirst ? 50 : 1,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(50),
      },
      {
        id: 'recruit',
        teamId: 'opponents',
        initiative: playerActsFirst ? 10 : 20,
        baseMovementBudget: 4,
        hp: playerActsFirst ? 1 : 50,
        maxHp: 50,
        mp: 20,
        maxMp: 20,
        temporaryResources: createPv1fTemporaryResources(50),
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

function expectLethalResolution(actorId: 'player' | 'recruit', targetId: 'player' | 'recruit') {
  const transition = executePv1fAction(lethalEncounter(actorId), PV1F_BASIC_ATTACK_ID, {
    kind: 'unit',
    combatantId: targetId,
  })
  const battle = transition.state.tactical.battle
  const actor = battle.combatants.find((combatant) => combatant.id === actorId)
  const target = battle.combatants.find((combatant) => combatant.id === targetId)
  const economy = actor?.temporaryResources.find(
    (resource) => resource.key === PV1F_ACTION_ECONOMY_RESOURCE_KEY,
  )

  expect(target?.hp).toBe(0)
  expect(battle.lifecycle).toBe('completed')
  expect(battle.currentTurn).toBeNull()
  expect(economy?.current).toBe(100 - PV1F_BASIC_ATTACK_COST)
  expect(transition.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ event: 'battle_completed' }),
      expect.objectContaining({
        event: 'action_economy_spent',
        combatantId: actorId,
        amount: PV1F_BASIC_ATTACK_COST,
        remaining: 100 - PV1F_BASIC_ATTACK_COST,
      }),
    ]),
  )
}

describe('PV-1F lethal Action Economy resolution', () => {
  it('commits a player lethal attack and completes the battle', () => {
    expectLethalResolution('player', 'recruit')
  })

  it('commits a Recruit lethal attack and completes the battle', () => {
    expectLethalResolution('recruit', 'player')
  })
})
