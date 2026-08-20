import { describe, expect, it } from 'vitest'

import { createCombatEncounterState } from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  createPv1fTemporaryResources,
  executePv1fAction,
  PV1F_BASIC_ATTACK_ID,
} from './pv1f-action-economy'
import {
  createPvpQualityResources,
  PVP_LOWERED_GUARD_STATUS_ID,
  timeoutPvpTurn,
} from './pvp-quality'
import {
  createStatDrivenCombatEncounterState,
  type StatDrivenCombatProfile,
} from './stat-driven-combat'

function profile(combatantId: string): StatDrivenCombatProfile {
  return {
    combatantId,
    provenance: {
      kind: 'character-derived',
      sourceId: `character:${combatantId}`,
      sourceRulesVersion: 2,
    },
    accuracy: 10_000,
    evasion: 0,
    armor: 0,
    ward: 0,
    jump: 1,
  }
}

function encounter() {
  const player = profile('player')
  const opponent = profile('opponent')
  const resources = () =>
    [...createPv1fTemporaryResources(10), ...createPvpQualityResources()].sort((left, right) =>
      left.key.localeCompare(right.key),
    )
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:pvp-quality-test',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 123_456,
      combatants: [
        {
          id: 'player',
          teamId: 'team:0',
          initiative: 20,
          baseMovementBudget: 10,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
          temporaryResources: resources(),
        },
        {
          id: 'opponent',
          teamId: 'team:1',
          initiative: 10,
          baseMovementBudget: 10,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 20,
          temporaryResources: resources(),
        },
      ],
    }),
  ).state
  const tactical = createTacticalBattleState({
    battle,
    width: 2,
    height: 1,
    terrains: [{ id: 'open-ground', traversalCost: 1 }],
    tiles: [
      { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open-ground' },
      { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open-ground' },
    ],
    movementProfiles: [
      { id: 'player-ground', maxElevationStep: 1, terrainCostOverrides: [] },
      { id: 'opponent-ground', maxElevationStep: 1, terrainCostOverrides: [] },
    ],
    placements: [
      {
        combatantId: 'player',
        position: { x: 0, y: 0 },
        facing: 'east',
        movementProfileId: 'player-ground',
      },
      {
        combatantId: 'opponent',
        position: { x: 1, y: 0 },
        facing: 'west',
        movementProfileId: 'opponent-ground',
      },
    ],
  })
  return createStatDrivenCombatEncounterState(createCombatEncounterState(tactical), [
    player,
    opponent,
  ])
}

describe('PvP turn quality rules', () => {
  it('applies Lowered Guard after a combatant misses two of its turns', () => {
    const firstPlayerMiss = timeoutPvpTurn(encounter()).state
    const opponentTurn = timeoutPvpTurn(firstPlayerMiss).state
    const secondPlayerMiss = timeoutPvpTurn(opponentTurn)
    const playerStatuses = secondPlayerMiss.state.statusState.find(
      (row) => row.combatantId === 'player',
    )

    expect(playerStatuses?.statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ statusId: PVP_LOWERED_GUARD_STATUS_ID, stacks: 2 }),
      ]),
    )
    expect(secondPlayerMiss.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'pvp_lowered_guard_applied',
          combatantId: 'player',
          damageTakenMultiplierBasisPoints: 25_000,
        }),
      ]),
    )

    const attacked = executePv1fAction(secondPlayerMiss.state, PV1F_BASIC_ATTACK_ID, {
      kind: 'unit',
      combatantId: 'player',
    })
    expect(attacked.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(
      75,
    )
  })
})
