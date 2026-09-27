import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatStatusDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  applyCurrentBleedState,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  currentBurnInstances,
  currentPoisonInstances,
} from './combat-dots'
import {
  createStatDrivenCombatEncounterState,
  STAT_DRIVEN_COMBAT_RULES_V4,
  type StatDrivenCombatEncounterState,
} from './stat-driven-combat'
import { usesUnboundedEffectApplications } from './effect-application-rules'

const STATUS: CombatStatusDefinition = {
  id: 'test.guard',
  version: 1,
  maximumStacks: 3,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 8_500,
}
const CONTENT: CombatContentCatalog = { statuses: [STATUS] }

function baseEncounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'effect-application-rules',
      rulesVersion: 1,
      contentVersion: 1,
      rngSeed: 71,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 4,
          hp: 50,
          maxHp: 100,
          mp: 20,
          maxMp: 30,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 4,
          hp: 100,
          maxHp: 100,
          mp: 20,
          maxMp: 30,
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
          combatantId: 'target',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

function currentEncounter(): StatDrivenCombatEncounterState {
  return createStatDrivenCombatEncounterState(
    baseEncounter(),
    ['actor', 'target'].map((combatantId) => ({
      combatantId,
      provenance: {
        kind: 'scenario' as const,
        sourceId: `scenario:${combatantId}`,
        sourceRulesVersion: 1,
      },
      accuracy: 10_000,
      evasion: 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 20,
      mysticPower: 20,
      level: 1,
      criticalChance: 0,
    })),
  )
}

function historicalV4(): StatDrivenCombatEncounterState {
  const state = currentEncounter()
  return {
    ...state,
    statBridge: {
      ...state.statBridge,
      rulesVersion: STAT_DRIVEN_COMBAT_RULES_V4,
    },
  }
}

function withGuarded(
  state: StatDrivenCombatEncounterState,
  stacks: number,
): StatDrivenCombatEncounterState {
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === 'actor'
        ? {
            ...row,
            statuses: [
              {
                statusId: STATUS.id,
                statusVersion: STATUS.version,
                stacks,
                remainingOwnerTurnStarts: 2,
                sourceCombatantId: 'actor',
              },
            ],
          }
        : row,
    ),
  }
}

const guardAction: CombatActionDefinition = {
  id: 'test.guard',
  version: 1,
  sourceType: 'test',
  tags: [],
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
  effects: [{ type: 'apply-status', recipient: 'actor', statusId: STATUS.id, stacks: 1 }],
}

const recoveryAction: CombatActionDefinition = {
  ...guardAction,
  id: 'test.recovery',
  effects: [{ type: 'healing', recipient: 'actor', amount: 2, ticks: 3 }],
}

function guardedCount(state: CombatEncounterState): number {
  return (
    state.statusState
      .find((row) => row.combatantId === 'actor')
      ?.statuses.find((status) => status.statusId === STATUS.id)?.stacks ?? 0
  )
}

describe('versioned repeated effect applications', () => {
  it('uses unbounded applications only for current rules v5', () => {
    expect(usesUnboundedEffectApplications(currentEncounter())).toBe(true)
    expect(usesUnboundedEffectApplications(historicalV4())).toBe(false)
  })

  it('lets current Guarded pass the old three-application cap without changing v4', () => {
    const current = executeCombatAction(
      withGuarded(currentEncounter(), 3),
      guardAction,
      { kind: 'self' },
      CONTENT,
    ).state
    const historical = executeCombatAction(
      withGuarded(historicalV4(), 3),
      guardAction,
      { kind: 'self' },
      CONTENT,
    ).state

    expect(guardedCount(current)).toBe(4)
    expect(guardedCount(historical)).toBe(3)
  })

  it('keeps every current Bleed application while v4 retains the historical three limit', () => {
    const applyFour = (initial: CombatEncounterState) => {
      let state = initial
      for (let index = 1; index <= 4; index += 1) {
        state = applyCurrentBleedState(
          state,
          'actor',
          'target',
          `test.bleed.${index}`,
          2,
          2,
        )
      }
      return state
    }

    expect(applyFour(currentEncounter()).effectState?.bleed).toHaveLength(4)
    expect(applyFour(historicalV4()).effectState?.bleed).toHaveLength(3)
  })

  it('keeps independent current Poison and Burn applications while v4 still replaces', () => {
    const repeatDots = (initial: CombatEncounterState) => {
      let state = applyCurrentPoisonState(initial, 'actor', 'target', 'test.poison.1')
      state = applyCurrentPoisonState(state, 'actor', 'target', 'test.poison.2')
      state = applyCurrentBurnState(state, 'actor', 'target', 'test.burn.1')
      state = applyCurrentBurnState(state, 'actor', 'target', 'test.burn.2')
      return state
    }

    const current = repeatDots(currentEncounter())
    const historical = repeatDots(historicalV4())
    expect(currentPoisonInstances(current, 'target')).toHaveLength(2)
    expect(currentBurnInstances(current, 'target')).toHaveLength(2)
    expect(currentPoisonInstances(historical, 'target')).toHaveLength(1)
    expect(currentBurnInstances(historical, 'target')).toHaveLength(1)
  })

  it('keeps repeated current recovery schedules independent while v4 still refreshes one schedule', () => {
    const repeatRecovery = (initial: StatDrivenCombatEncounterState) => {
      const first = executeCombatAction(initial, recoveryAction, { kind: 'self' }, CONTENT)
      return executeCombatAction(first.state, recoveryAction, { kind: 'self' }, CONTENT).state
    }

    expect(repeatRecovery(currentEncounter()).effectState?.ongoingRecovery).toHaveLength(2)
    expect(repeatRecovery(historicalV4()).effectState?.ongoingRecovery).toHaveLength(1)
  })
})
