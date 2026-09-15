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

function history(state: CombatEncounterState, combatantId: string) {
  return (state.effectState?.damageHistory ?? []).filter(
    (entry) => entry.combatantId === combatantId,
  )
}

describe('P4.K4 authoritative damage-history resolver wiring', () => {
  it('records post-Barrier actual hostile HP loss rather than pre-Barrier resolved damage', () => {
    const initial = encounter()
    const protectedTarget = executeCombatAction(
      initial,
      action({
        id: 'test.damage-history.barrier',
        effects: [{ type: 'barrier-change', recipient: 'primary-unit', amount: 8 }],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )
    const hit = executeCombatAction(
      protectedTarget.state,
      action({
        id: 'test.damage-history.direct-after-barrier',
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    const damage = hit.events.find(
      (event) => event.event === 'damage_applied' && event.targetCombatantId === 'target',
    )
    expect(damage).toMatchObject({ event: 'damage_applied', amount: 12 })
    expect(history(hit.state, 'target')).toEqual([{ combatantId: 'target', round: 1, amount: 12 }])
    expect(initial.effectState?.damageHistory ?? []).toEqual([])
  })

  it('records overkill-clamped direct hostile HP loss', () => {
    const result = executeCombatAction(
      encounter({ targetHp: 2 }),
      action({
        id: 'test.damage-history.direct-overkill',
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 5 }],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(history(result.state, 'target')).toEqual([
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
    expect(history(tick.state, 'target')).toEqual([
      { combatantId: 'target', round: 1, amount: periodicDamage },
    ])
  })

  it('records hostile command damage but excludes Burn backlash self-cost', () => {
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

    expect(history(result.state, 'target')).toEqual([
      { combatantId: 'target', round: 1, amount: 3 },
    ])
    expect(history(result.state, 'actor')).toEqual([])
  })

  it('does not record same-team direct damage even when friendly fire is legal', () => {
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

    expect(history(result.state, 'ally')).toEqual([])
  })

  it('prunes damage history to the current round plus previous two rounds on new qualifying damage', () => {
    const base = encounter()
    const state: CombatEncounterState = {
      ...base,
      tactical: {
        ...base.tactical,
        battle: { ...base.tactical.battle, round: 4 },
      },
      effectState: {
        ongoingRecovery: [],
        poison: [],
        bleed: [],
        burn: [],
        temporarySkills: [],
        damageHistory: [
          { combatantId: 'target', round: 1, amount: 3 },
          { combatantId: 'target', round: 2, amount: 4 },
          { combatantId: 'target', round: 3, amount: 5 },
        ],
      },
    }

    const result = executeCombatAction(
      state,
      action({
        id: 'test.damage-history.window',
        effects: [{ type: 'damage', recipient: 'primary-unit', amount: 6 }],
      }),
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    )

    expect(history(result.state, 'target')).toEqual([
      { combatantId: 'target', round: 2, amount: 4 },
      { combatantId: 'target', round: 3, amount: 5 },
      { combatantId: 'target', round: 4, amount: 6 },
    ])
  })
})
