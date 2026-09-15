import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionContext,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { normalizeCombatEffectState } from './combat-effect-state'
import {
  createCombatActionProvenance,
  createCombatTriggerGuard,
  type CombatEffectInstanceProvenance,
} from './combat-kernel-types'

const STATUS = {
  id: 'test.k3.status',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
} as const

const CONTENT: CombatContentCatalog = { statuses: [STATUS] }

const PERSISTENT_ACTION: CombatActionDefinition = {
  id: 'test.k3.persistent-provenance',
  version: 3,
  sourceType: 'test',
  tags: ['test'],
  target: {
    kind: 'unit',
    teamPolicy: 'enemy',
    shape: { kind: 'single' },
    minimumRange: 1,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: null,
    friendlyFire: 'enemies-only',
  },
  cost: { spendsAction: false, mp: 0 },
  requirements: [],
  effects: [
    {
      type: 'apply-status',
      recipient: 'primary-unit',
      statusId: STATUS.id,
      stacks: 1,
    },
    { type: 'poison', recipient: 'primary-unit' },
    { type: 'bleed', recipient: 'primary-unit', damagePerTick: 2, ticks: 2 },
    { type: 'burn', recipient: 'primary-unit' },
    { type: 'healing', recipient: 'primary-unit', amount: 3, ticks: 3 },
  ],
}

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k3-persistent-threading',
      rulesVersion: 2,
      contentVersion: 7,
      rngSeed: 73,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 20,
          maxHp: 20,
          mp: 10,
          maxMp: 10,
        },
        {
          id: 'target',
          teamId: 'enemies',
          initiative: 10,
          baseMovementBudget: 3,
          hp: 10,
          maxHp: 20,
          mp: 10,
          maxMp: 10,
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

function context(triggerChain: string): CombatResolutionContext {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: PERSISTENT_ACTION.id,
      actionVersion: PERSISTENT_ACTION.version,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: triggerChain,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: triggerChain }),
  }
}

function cast(state: CombatEncounterState, resolutionContext?: CombatResolutionContext) {
  return executeCombatAction(
    state,
    PERSISTENT_ACTION,
    { kind: 'unit', combatantId: 'target' },
    CONTENT,
    resolutionContext,
  )
}

function targetStatus(state: CombatEncounterState) {
  return state.statusState
    .find((row) => row.combatantId === 'target')
    ?.statuses.find((status) => status.statusId === STATUS.id)
}

function persistentProvenance(state: CombatEncounterState) {
  const effects = normalizeCombatEffectState(state.effectState)
  return {
    status: targetStatus(state)?.provenance,
    poison: effects.poison.find((row) => row.targetCombatantId === 'target')?.provenance,
    bleed: effects.bleed.find((row) => row.targetCombatantId === 'target')?.provenance,
    burn: effects.burn.find((row) => row.targetCombatantId === 'target')?.provenance,
    recovery: effects.ongoingRecovery.find(
      (row) =>
        row.targetCombatantId === 'target' &&
        row.kind === 'hp' &&
        row.sourceActionId === PERSISTENT_ACTION.id,
    )?.provenance,
  }
}

function expectProvenance(
  provenance: CombatEffectInstanceProvenance | undefined,
  triggerChain: string,
  effectOrdinal: number,
) {
  expect(provenance).toMatchObject({
    instanceId: `effect:${triggerChain}:${PERSISTENT_ACTION.id}:${effectOrdinal}:target`,
    targetCombatantId: 'target',
    effectOrdinal,
    createdRound: 1,
    createdTurn: 1,
    action: {
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: PERSISTENT_ACTION.id,
      actionVersion: PERSISTENT_ACTION.version,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: triggerChain,
    },
  })
}

describe('P4.K3 persistent provenance threading', () => {
  it('keeps the historical four-argument execution shape free of new provenance fields', () => {
    const transition = cast(encounter())

    expect(persistentProvenance(transition.state)).toEqual({
      status: undefined,
      poison: undefined,
      bleed: undefined,
      burn: undefined,
      recovery: undefined,
    })
  })

  it('threads deterministic effect-instance provenance into every newly created persistent family', () => {
    const transition = cast(encounter(), context('chain:k3:first'))
    const provenance = persistentProvenance(transition.state)

    expectProvenance(provenance.status, 'chain:k3:first', 0)
    expectProvenance(provenance.poison, 'chain:k3:first', 1)
    expectProvenance(provenance.bleed, 'chain:k3:first', 2)
    expectProvenance(provenance.burn, 'chain:k3:first', 3)
    expectProvenance(provenance.recovery, 'chain:k3:first', 4)
  })

  it('uses fresh causal provenance on persistent reapplication without mutating prior inputs', () => {
    const initialState = encounter()
    const initialSnapshot = structuredClone(initialState)
    const firstContext = context('chain:k3:first')
    const firstContextSnapshot = structuredClone(firstContext)
    const first = cast(initialState, firstContext)
    const firstPoison = persistentProvenance(first.state).poison

    expect(initialState).toEqual(initialSnapshot)
    expect(firstContext).toEqual(firstContextSnapshot)

    const secondContext = context('chain:k3:second')
    const secondContextSnapshot = structuredClone(secondContext)
    const second = cast(first.state, secondContext)
    const secondProvenance = persistentProvenance(second.state)

    expect(firstPoison?.instanceId).toBe(
      `effect:chain:k3:first:${PERSISTENT_ACTION.id}:1:target`,
    )
    expectProvenance(secondProvenance.status, 'chain:k3:second', 0)
    expectProvenance(secondProvenance.poison, 'chain:k3:second', 1)
    expectProvenance(secondProvenance.burn, 'chain:k3:second', 3)
    expectProvenance(secondProvenance.recovery, 'chain:k3:second', 4)
    expect(secondContext).toEqual(secondContextSnapshot)
  })
})
