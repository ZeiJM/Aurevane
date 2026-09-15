import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEffectDefinition,
  type CombatEncounterState,
  type CombatStatusDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { recentCombatDamageSuffered } from './combat-damage-history'
import { PHASE4_STATUSES } from './status-content'

const LEGACY_PERIODIC_STATUS: CombatStatusDefinition = {
  id: 'test.damage-history.periodic',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  endOfTurn: { type: 'damage', amount: 1 },
}

const CONTENT: CombatContentCatalog = {
  statuses: [...PHASE4_STATUSES, LEGACY_PERIODIC_STATUS],
}

function encounter({ targetHp = 30 }: { targetHp?: number } = {}): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k4-damage-history-runtime',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 41,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 30,
          baseMovementBudget: 3,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'ally',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 30,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
        },
        {
          id: 'target',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 3,
          hp: targetHp,
          maxHp: 30,
          mp: 20,
          maxMp: 20,
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
      tiles: Array.from({ length: 3 }, (_, x) => ({
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
          combatantId: 'ally',
          position: { x: 1, y: 0 },
          facing: 'east',
          movementProfileId: 'ground',
        },
        {
          combatantId: 'target',
          position: { x: 2, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

function action({
  id,
  effects,
  teamPolicy = 'enemy',
  friendlyFire = 'enemies-only',
}: {
  id: string
  effects: readonly CombatEffectDefinition[]
  teamPolicy?: 'ally' | 'enemy'
  friendlyFire?: 'allies-only' | 'enemies-only' | 'all-units'
}): CombatActionDefinition {
  return {
    id,
    version: 1,
    sourceType: 'test',
    tags: ['test'],
    target: {
      kind: 'unit',
      teamPolicy,
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 2,
      requiresLineOfSight: false,
      maximumElevationDifference: null,
      friendlyFire,
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects,
  }
}

function finishTurn(state: CombatEncounterState): ReturnType<typeof endCombatTurn> {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  return endCombatTurn({ ...state, tactical: faced.state }, CONTENT)
}

function burnActor(state: CombatEncounterState): CombatEncounterState {
  const burnSelf: CombatActionDefinition = {
    id: 'test.damage-history.burn-self',
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
    effects: [{ type: 'burn', recipient: 'actor' }],
  }

  return executeCombatAction(state, burnSelf, { kind: 'self' }, CONTENT).state
}

describe('P4.K4 authoritative damage-history resolver wiring', () => {
  it('records actual overkill-clamped direct hostile HP loss', () => {
    const result = executeCombatAction(
      encounter({ targetHp: 2 }),
      action({
        id: 'test.damage-history.direct',
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(recentCombatDamageSuffered(result.state, 'target')).toBe(2)
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 2 },
    ])
  })

  it('aggregates legacy periodic plus current Poison, Bleed and Burn hostile ticks', () => {
    const afflicted = executeCombatAction(
      encounter(),
      action({
        id: 'test.damage-history.dots',
        effects: [
          {
            type: 'apply-status',
            recipient: 'primary-unit',
            statusId: LEGACY_PERIODIC_STATUS.id,
            stacks: 1,
          },
          { type: 'poison', recipient: 'primary-unit' },
          { type: 'bleed', recipient: 'primary-unit', damagePerTick: 3, ticks: 2 },
          { type: 'burn', recipient: 'primary-unit' },
        ],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    const allyTurn = finishTurn(afflicted.state)
    const targetTurn = finishTurn(allyTurn.state)
    expect(targetTurn.state.tactical.battle.currentTurn?.combatantId).toBe('target')
    const tick = finishTurn(targetTurn.state)

    const periodicDamage = tick.events
      .flatMap((event) =>
        event.event === 'damage_applied' && event.targetCombatantId === 'target'
          ? [event.amount]
          : [],
      )
      .reduce((sum, amount) => sum + amount, 0)

    expect(periodicDamage).toBe(10)
    expect(recentCombatDamageSuffered(tick.state, 'target')).toBe(periodicDamage)
    expect(tick.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 10 },
    ])
  })

  it('records the hostile command damage but excludes Burn backlash self-cost', () => {
    const burned = burnActor(encounter())
    const result = executeCombatAction(
      burned,
      action({
        id: 'test.damage-history.backlash-command',
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 3 }],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(recentCombatDamageSuffered(result.state, 'target')).toBe(3)
    expect(recentCombatDamageSuffered(result.state, 'actor')).toBe(0)
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 3 },
    ])
  })

  it('does not record same-team direct damage even when friendly fire is explicitly legal', () => {
    const result = executeCombatAction(
      encounter(),
      action({
        id: 'test.damage-history.friendly-fire',
        teamPolicy: 'ally',
        friendlyFire: 'all-units',
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 4 }],
      }),
      { kind: 'unit', combatantId: 'ally' },
      CONTENT,
    )

    expect(recentCombatDamageSuffered(result.state, 'ally')).toBe(0)
    expect(result.state.effectState?.damageHistory ?? []).toEqual([])
  })
})
