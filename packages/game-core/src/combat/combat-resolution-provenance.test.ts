import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  executeCombatAction,
  P2_3_COMBAT_CONTENT,
  P2_3_GUARD_ACTION,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionTransition,
  type CombatTargetSelection,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import {
  COMBAT_RESOLUTION_PIPELINE_VERSION,
  createCombatActionProvenance,
  createCombatTriggerGuard,
  type CombatActionProvenance,
  type CombatTriggerGuard,
} from './combat-kernel-types'

interface ResolutionMetadata {
  pipelineVersion: typeof COMBAT_RESOLUTION_PIPELINE_VERSION
  provenance: CombatActionProvenance
  triggerGuard: CombatTriggerGuard
}

type ExecuteWithResolutionContext = (
  state: CombatEncounterState,
  action: typeof P2_3_GUARD_ACTION,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
  context: {
    provenance: CombatActionProvenance
    triggerGuard: CombatTriggerGuard
  },
) => CombatResolutionTransition & { resolution?: ResolutionMetadata }

function encounter(): CombatEncounterState {
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k3-provenance',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 17,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: 20,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'recruit',
          teamId: 'opponents',
          initiative: 10,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 30,
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
          combatantId: 'recruit',
          position: { x: 1, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
  )
}

describe('P4.K3 authoritative resolution provenance', () => {
  it('returns the exact command provenance and trigger guard used by an opted-in execution', () => {
    const provenance = createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'basic',
      actionDefinitionId: P2_3_GUARD_ACTION.id,
      actionVersion: P2_3_GUARD_ACTION.version,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'chain:k3-command-1',
    })
    const triggerGuard = createCombatTriggerGuard({
      triggerChainId: 'chain:k3-command-1',
      maxDepth: 4,
      reactionBudget: 6,
    })
    const executeWithContext = executeCombatAction as unknown as ExecuteWithResolutionContext

    const transition = executeWithContext(
      encounter(),
      P2_3_GUARD_ACTION,
      { kind: 'self' },
      P2_3_COMBAT_CONTENT,
      { provenance, triggerGuard },
    )

    expect(transition.resolution).toEqual({
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance,
      triggerGuard,
    })
  })

  it('preserves the historical four-argument transition shape when no K3 context is supplied', () => {
    const transition = executeCombatAction(
      encounter(),
      P2_3_GUARD_ACTION,
      { kind: 'self' },
      P2_3_COMBAT_CONTENT,
    ) as CombatResolutionTransition & { resolution?: ResolutionMetadata }

    expect(transition.resolution).toBeUndefined()
  })
})
