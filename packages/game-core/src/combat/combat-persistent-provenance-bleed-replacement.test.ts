import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatResolutionContext,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { normalizeCombatEffectState } from './combat-effect-state'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import { PHASE4_STATUSES } from './status-content'

const CONTENT = { statuses: PHASE4_STATUSES }

const APPLY_BLEED: CombatActionDefinition = {
  id: 'test.k3.prior-bleed',
  version: 1,
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
  effects: [{ type: 'bleed', recipient: 'primary-unit', damagePerTick: 2, ticks: 2 }],
}

const REMOVE_THEN_REAPPLY_BLEED: CombatActionDefinition = {
  ...APPLY_BLEED,
  id: 'test.k3.remove-reapply-bleed',
  effects: [
    { type: 'remove-status', recipient: 'primary-unit', statusIds: ['bleed'] },
    { type: 'bleed', recipient: 'primary-unit', damagePerTick: 2, ticks: 2 },
  ],
}

function encounter() {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k3-bleed-replacement-provenance',
      rulesVersion: 2,
      contentVersion: 1,
      rngSeed: 19,
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
          hp: 20,
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

function context(): CombatResolutionContext {
  const triggerChainId = 'chain:k3:remove-reapply-bleed'
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: REMOVE_THEN_REAPPLY_BLEED.id,
      actionVersion: REMOVE_THEN_REAPPLY_BLEED.version,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId }),
  }
}

// Regression: removing Bleed can reset application order without erasing the new effect's cause.
describe('P4.K3 Bleed replacement provenance', () => {
  it('tags the new Bleed when an earlier effect in the same command removes the prior stack', () => {
    const seeded = executeCombatAction(
      encounter(),
      APPLY_BLEED,
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
    ).state
    const seededBleed = normalizeCombatEffectState(seeded.effectState).bleed
    expect(seededBleed).toHaveLength(1)
    expect(seededBleed[0]).toMatchObject({ targetCombatantId: 'target', applicationOrder: 1 })
    expect(seededBleed[0]?.provenance).toBeUndefined()

    const transition = executeCombatAction(
      seeded,
      REMOVE_THEN_REAPPLY_BLEED,
      { kind: 'unit', combatantId: 'target' },
      CONTENT,
      context(),
    )
    const bleed = normalizeCombatEffectState(transition.state.effectState).bleed

    expect(bleed).toHaveLength(1)
    expect(bleed[0]).toMatchObject({
      targetCombatantId: 'target',
      applicationOrder: 1,
      provenance: {
        instanceId: 'effect:chain:k3:remove-reapply-bleed:test.k3.remove-reapply-bleed:1:target',
        effectOrdinal: 1,
        targetCombatantId: 'target',
      },
    })
  })
})
