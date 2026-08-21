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
  createAiQualityResources,
  createPvpQualityResources,
  PVP_LOWERED_GUARD_STATUS_ID,
  timeoutAiTurn,
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

function encounter(kind: 'pvp' | 'ai' = 'pvp') {
  const player = profile('player')
  const opponent = profile('opponent')
  const quality = kind === 'pvp' ? createPvpQualityResources : createAiQualityResources
  const resources = () =>
    [...createPv1fTemporaryResources(10), ...quality()].sort((left, right) =>
      left.key.localeCompare(right.key),
    )
  const battle = startBattle(
    createPendingBattle({
      battleId: `battle:${kind}-quality-test`,
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

function expectLoweredGuardDamage(
  state: ReturnType<typeof encounter>,
  events: readonly unknown[],
  expectedEvent: string,
) {
  const playerStatuses = state.statusState.find((row) => row.combatantId === 'player')
  expect(playerStatuses?.statuses).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ statusId: PVP_LOWERED_GUARD_STATUS_ID, stacks: 1 }),
    ]),
  )
  expect(events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: expectedEvent,
        combatantId: 'player',
        damageTakenMultiplierBasisPoints: 25_000,
      }),
    ]),
  )

  const attacked = executePv1fAction(state, PV1F_BASIC_ATTACK_ID, {
    kind: 'unit',
    combatantId: 'player',
  })
  expect(attacked.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(
    75,
  )
}

describe('battle turn quality rules', () => {
  it('applies Lowered Guard after two missed PvP turns', () => {
    const firstPlayerMiss = timeoutPvpTurn(encounter('pvp')).state
    const opponentTurn = timeoutPvpTurn(firstPlayerMiss).state
    const secondPlayerMiss = timeoutPvpTurn(opponentTurn)

    expectLoweredGuardDamage(
      secondPlayerMiss.state,
      secondPlayerMiss.events,
      'pvp_lowered_guard_applied',
    )
  })

  it('applies the same 250% Lowered Guard rule after two missed AI-battle turns', () => {
    const firstPlayerMiss = timeoutAiTurn(encounter('ai')).state
    const opponentTurn = timeoutAiTurn(firstPlayerMiss).state
    const secondPlayerMiss = timeoutAiTurn(opponentTurn)

    expectLoweredGuardDamage(
      secondPlayerMiss.state,
      secondPlayerMiss.events,
      'ai_lowered_guard_applied',
    )
  })
})
