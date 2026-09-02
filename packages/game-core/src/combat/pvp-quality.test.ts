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

function loweredGuard(state: ReturnType<typeof encounter>, combatantId: string) {
  return state.statusState
    .find((row) => row.combatantId === combatantId)
    ?.statuses.find((status) => status.statusId === PVP_LOWERED_GUARD_STATUS_ID)
}

function expectLoweredGuardDamage(
  state: ReturnType<typeof encounter>,
  events: readonly unknown[],
  expectedEvent: string,
) {
  const playerStatus = loweredGuard(state, 'player')
  expect(playerStatus).toMatchObject({
    statusId: PVP_LOWERED_GUARD_STATUS_ID,
    stacks: 1,
  })
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
  expect(attacked.state.tactical.battle.combatants.find((row) => row.id === 'player')?.hp).toBe(75)
}

describe('battle turn quality rules', () => {
  it('applies one-turn Lowered Guard after every missed PvP turn', () => {
    const firstMiss = timeoutPvpTurn(encounter('pvp'))

    expectLoweredGuardDamage(firstMiss.state, firstMiss.events, 'pvp_lowered_guard_applied')
    expect(firstMiss.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'pvp_lowered_guard_applied',
          combatantId: 'player',
          remainingOwnerTurnStarts: 1,
        }),
      ]),
    )
    expect(loweredGuard(firstMiss.state, 'player')?.remainingOwnerTurnStarts).toBe(1)
  })

  it('expires Lowered Guard when the combatant returns, then reapplies on another timeout', () => {
    const firstPlayerMiss = timeoutPvpTurn(encounter('pvp')).state
    const opponentMiss = timeoutPvpTurn(firstPlayerMiss).state

    expect(opponentMiss.tactical.battle.currentTurn?.combatantId).toBe('player')
    expect(loweredGuard(opponentMiss, 'player')).toBeUndefined()

    const secondPlayerMiss = timeoutPvpTurn(opponentMiss)
    expect(loweredGuard(secondPlayerMiss.state, 'player')?.remainingOwnerTurnStarts).toBe(1)
    expect(secondPlayerMiss.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'pvp_lowered_guard_applied', combatantId: 'player' }),
      ]),
    )
  })

  it('adds a Lowered Guard stack when the timed-out combatant already has the debuff', () => {
    const firstMiss = timeoutPvpTurn(encounter('pvp')).state
    const stackedInput = {
      ...firstMiss,
      statusState: firstMiss.statusState.map((row) =>
        row.combatantId === 'opponent'
          ? {
              ...row,
              statuses: [
                {
                  statusId: PVP_LOWERED_GUARD_STATUS_ID,
                  statusVersion: 1,
                  stacks: 1,
                  remainingOwnerTurnStarts: 1,
                  sourceCombatantId: 'opponent',
                },
              ],
            }
          : row,
      ),
    }

    const secondApplication = timeoutPvpTurn(stackedInput)

    expect(loweredGuard(secondApplication.state, 'opponent')).toMatchObject({
      stacks: 2,
      remainingOwnerTurnStarts: 1,
    })
    expect(secondApplication.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'status_applied',
          statusId: PVP_LOWERED_GUARD_STATUS_ID,
          stacks: 2,
          refreshed: true,
        }),
      ]),
    )

    const attacked = executePv1fAction(secondApplication.state, PV1F_BASIC_ATTACK_ID, {
      kind: 'unit',
      combatantId: 'opponent',
    })
    expect(attacked.state.tactical.battle.combatants.find((row) => row.id === 'opponent')?.hp).toBe(
      38,
    )
  })

  it('applies one-turn Lowered Guard after all six forfeits across three no-action rounds', () => {
    let state = encounter('pvp')

    for (let timeoutIndex = 0; timeoutIndex < 6; timeoutIndex += 1) {
      const timedOutCombatantId = state.tactical.battle.currentTurn?.combatantId
      expect(timedOutCombatantId).toBeDefined()
      expect(state.tactical.battle.round).toBe(Math.floor(timeoutIndex / 2) + 1)

      const previousHp = state.tactical.battle.combatants.find(
        (combatant) => combatant.id === timedOutCombatantId,
      )?.hp
      const timedOut = timeoutPvpTurn(state)
      const nextCombatantId = timedOut.state.tactical.battle.currentTurn?.combatantId

      expect(timedOut.events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'pvp_turn_timed_out',
            combatantId: timedOutCombatantId,
          }),
          expect.objectContaining({
            event: 'pvp_lowered_guard_applied',
            combatantId: timedOutCombatantId,
            remainingOwnerTurnStarts: 1,
            damageTakenMultiplierBasisPoints: 25_000,
          }),
        ]),
      )
      expect(loweredGuard(timedOut.state, timedOutCombatantId ?? '')).toMatchObject({
        stacks: 1,
        remainingOwnerTurnStarts: 1,
      })
      expect(loweredGuard(timedOut.state, nextCombatantId ?? '')).toBeUndefined()

      const attacked = executePv1fAction(timedOut.state, PV1F_BASIC_ATTACK_ID, {
        kind: 'unit',
        combatantId: timedOutCombatantId ?? '',
      })
      expect(
        attacked.state.tactical.battle.combatants.find(
          (combatant) => combatant.id === timedOutCombatantId,
        )?.hp,
      ).toBe((previousHp ?? 0) - 25)

      state = timedOut.state
    }

    expect(state.tactical.battle.round).toBe(4)
  })

  it('keeps the two-miss AI rule while limiting Lowered Guard to one turn', () => {
    const firstPlayerMiss = timeoutAiTurn(encounter('ai')).state
    expect(loweredGuard(firstPlayerMiss, 'player')).toBeUndefined()

    const opponentTurn = timeoutAiTurn(firstPlayerMiss).state
    const secondPlayerMiss = timeoutAiTurn(opponentTurn)

    expectLoweredGuardDamage(
      secondPlayerMiss.state,
      secondPlayerMiss.events,
      'ai_lowered_guard_applied',
    )
    expect(loweredGuard(secondPlayerMiss.state, 'player')?.remainingOwnerTurnStarts).toBe(1)
    expect(secondPlayerMiss.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'ai_lowered_guard_applied',
          combatantId: 'player',
          remainingOwnerTurnStarts: 1,
        }),
      ]),
    )

    const playerReturns = timeoutAiTurn(secondPlayerMiss.state).state
    expect(playerReturns.tactical.battle.currentTurn?.combatantId).toBe('player')
    expect(loweredGuard(playerReturns, 'player')).toBeUndefined()

    const nextPlayerMiss = timeoutAiTurn(playerReturns)
    expect(loweredGuard(nextPlayerMiss.state, 'player')?.remainingOwnerTurnStarts).toBe(1)
  })
})
