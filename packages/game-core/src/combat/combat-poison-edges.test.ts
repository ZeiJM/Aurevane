import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, moveCurrentCombatant, selectCurrentFinalFacing } from './board'
import { CLEANSE_STATUS_IDS, PHASE4_STATUSES } from './status-content'

const CONTENT = {
  statuses: [
    ...PHASE4_STATUSES,
    {
      id: 'exposed',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 10_000,
    },
  ],
}

function encounter(actorHp = 30): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'current-poison-edges',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 131,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 6,
          hp: actorHp,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'enemy',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 6,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
      ],
    }),
  ).state
  const state = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 5,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: Array.from({ length: 5 }, (_, x) => ({
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
          position: { x: 4, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
  return {
    ...state,
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

function selfAction(
  id: string,
  effects: CombatActionDefinition['effects'],
): CombatActionDefinition {
  return {
    id,
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'self',
      teamPolicy: 'self',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 0,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire: 'allies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
  }
}

function actorX(state: CombatEncounterState): number {
  return state.tactical.placements.find((row) => row.combatantId === 'actor')!.position.x
}

describe('current Poison edge rules', () => {
  it('real Cleanse clears Poison and a fresh application restarts movement progress at zero', () => {
    const cleansed = executeCombatAction(
      encounter(),
      selfAction('test.cleanse', [
        { type: 'remove-status', recipient: 'actor', statusIds: CLEANSE_STATUS_IDS },
      ]),
      { kind: 'self' },
      CONTENT,
    )
    expect(cleansed.state.effectState?.poison).toEqual([])

    const reapplied = executeCombatAction(
      cleansed.state,
      selfAction('test.fresh-poison', [{ type: 'poison', recipient: 'actor' }]),
      { kind: 'self' },
      CONTENT,
    )
    expect(reapplied.state.effectState?.poison[0]?.movementRemainder).toBe(0)
  })

  it('Revert relocates without counting Poison movement progress', () => {
    const initial = encounter()
    const staged = moveCurrentCombatant(initial.tactical, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    const displacedWithoutCombatHook: CombatEncounterState = {
      ...initial,
      tactical: staged.state,
      turnOrigin: {
        combatantId: 'actor',
        turnNumber: initial.tactical.battle.turnNumber,
        position: { x: 0, y: 0 },
      },
    }
    expect(actorX(displacedWithoutCombatHook)).toBe(2)

    const reverted = executeCombatAction(
      displacedWithoutCombatHook,
      selfAction('test.revert', [{ type: 'return-to-turn-start', recipient: 'actor' }]),
      { kind: 'self' },
      CONTENT,
    )

    expect(actorX(reverted.state)).toBe(0)
    expect(reverted.state.effectState?.poison[0]?.movementRemainder).toBe(4)
    expect(
      reverted.events.some(
        (event) =>
          event.event === 'damage_applied' && event.actionId === 'status.poison.current.v1',
      ),
    ).toBe(false)
  })

  it('a lethal end-turn Poison tick defeats the outgoing unit and completes the battle cleanly', () => {
    const state = encounter(2)
    const faced = selectCurrentFinalFacing(state.tactical, 'east')
    const result = endCombatTurn({ ...state, tactical: faced.state }, CONTENT)

    expect(result.state.tactical.battle.combatants.find((row) => row.id === 'actor')?.hp).toBe(0)
    expect(result.state.tactical.battle.lifecycle).toBe('completed')
    expect(result.state.tactical.battle.currentTurn).toBeNull()
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'damage_applied',
        actionId: 'status.poison.current.v1',
        targetCombatantId: 'actor',
        amount: 2,
      }),
    )
    expect(result.events).toContainEqual({ event: 'battle_completed', winningTeamId: 'enemies' })
  })
})
