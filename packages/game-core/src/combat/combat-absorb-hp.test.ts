import { describe, expect, it } from 'vitest'

import {
  createCombatEncounterState,
  endCombatTurn,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionTransition,
  type CombatStatusDefinition,
  type CombatTargetSelection,
} from './actions'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import {
  COMBAT_RESOLUTION_PIPELINE_VERSION,
  createCombatActionProvenance,
  createCombatTriggerGuard,
  type CombatActionProvenance,
  type CombatTriggerGuard,
} from './combat-kernel-types'

function absorbStatus(
  id: string,
  basisPoints: number,
  overrides: Record<string, unknown> = {},
): CombatStatusDefinition {
  return {
    id,
    version: 1,
    maximumStacks: 1,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    reactionClass: 'reactive',
    effectCategories: ['Healing'],
    absorbHpBasisPoints: basisPoints,
    ...overrides,
  } as unknown as CombatStatusDefinition
}

const ABSORB_25 = absorbStatus('test.absorb-hp-25', 2_500)
const ABSORB_10 = absorbStatus('test.absorb-hp-10', 1_000)
const PERIODIC_DAMAGE: CombatStatusDefinition = {
  id: 'test.periodic-damage',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  endOfTurn: { type: 'damage', amount: 4 },
}

function damageAction(
  amount: number,
  teamPolicy: 'enemy' | 'any' = 'enemy',
): CombatActionDefinition {
  return {
    id: 'test.absorb-hp-hit',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy,
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 1,
      requiresLineOfSight: false,
      maximumElevationDifference: 1,
      friendlyFire: teamPolicy === 'enemy' ? 'enemies-only' : 'all-units',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }],
  }
}

function barrierAction(amount: number): CombatActionDefinition {
  return {
    ...damageAction(1),
    id: 'test.absorb-hp-barrier',
    effects: [{ type: 'barrier-change', recipient: 'primary-unit', amount }],
  }
}

function statusInstance(status: CombatStatusDefinition, sourceCombatantId = 'target') {
  return {
    statusId: status.id,
    statusVersion: status.version,
    stacks: 1,
    remainingOwnerTurnStarts: status.durationOwnerTurnStarts,
    sourceCombatantId,
  }
}

function encounter(options?: {
  targetTeamId?: string
  targetHp?: number
  targetMaxHp?: number
  targetStatuses?: readonly CombatStatusDefinition[]
  targetActsFirst?: boolean
}): CombatEncounterState {
  const targetActsFirst = options?.targetActsFirst ?? false
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:k4-absorb-hp',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 41,
      combatants: [
        {
          id: 'actor',
          teamId: 'players',
          initiative: targetActsFirst ? 10 : 20,
          baseMovementBudget: 3,
          hp: 100,
          maxHp: 100,
          mp: 50,
          maxMp: 50,
        },
        {
          id: 'target',
          teamId: options?.targetTeamId ?? 'opponents',
          initiative: targetActsFirst ? 20 : 10,
          baseMovementBudget: 3,
          hp: options?.targetHp ?? 100,
          maxHp: options?.targetMaxHp ?? 100,
          mp: 30,
          maxMp: 30,
        },
        {
          id: 'witness',
          teamId: 'opponents',
          initiative: 5,
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
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: [
        { position: { x: 0, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 1, y: 0 }, elevation: 0, terrainId: 'open' },
        { position: { x: 2, y: 0 }, elevation: 0, terrainId: 'open' },
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
        {
          combatantId: 'witness',
          position: { x: 2, y: 0 },
          facing: 'west',
          movementProfileId: 'ground',
        },
      ],
    }),
    [
      { combatantId: 'actor', statuses: [] },
      {
        combatantId: 'target',
        statuses: (options?.targetStatuses ?? []).map((status) => statusInstance(status, 'actor')),
      },
      { combatantId: 'witness', statuses: [] },
    ],
  )
}

function targetHp(state: CombatEncounterState): number {
  return state.tactical.battle.combatants.find((combatant) => combatant.id === 'target')!.hp
}

function execute(
  state: CombatEncounterState,
  damage: number,
  statuses: readonly CombatStatusDefinition[],
  teamPolicy: 'enemy' | 'any' = 'enemy',
) {
  const content: CombatContentCatalog = { statuses }
  return executeCombatAction(
    state,
    damageAction(damage, teamPolicy),
    { kind: 'unit', combatantId: 'target' },
    content,
  )
}

function absorbHealingEvents(transition: CombatResolutionTransition) {
  return transition.events.filter(
    (event) => event.event === 'healing_applied' && event.actionId === 'status.absorb-hp.current.v1',
  )
}

interface ResolutionMetadata {
  pipelineVersion: typeof COMBAT_RESOLUTION_PIPELINE_VERSION
  provenance: CombatActionProvenance
  triggerGuard: CombatTriggerGuard
}

type ExecuteWithResolutionContext = (
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: CombatTargetSelection,
  content: CombatContentCatalog,
  context: {
    provenance: CombatActionProvenance
    triggerGuard: CombatTriggerGuard
  },
) => CombatResolutionTransition & { resolution?: ResolutionMetadata }

describe('P4.K4 Absorb HP committed-damage reaction', () => {
  it('recovers an authored percentage of actual hostile direct HP damage', () => {
    const result = execute(encounter({ targetStatuses: [ABSORB_25] }), 20, [ABSORB_25])

    expect(targetHp(result.state)).toBe(85)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        event: 'healing_applied',
        actionId: 'status.absorb-hp.current.v1',
        sourceCombatantId: 'target',
        targetCombatantId: 'target',
        amount: 5,
        hpBefore: 80,
        hpAfter: 85,
      }),
    )
  })

  it('uses the minimum-1 recovery rule when a positive percentage rounds below one HP', () => {
    const result = execute(encounter({ targetStatuses: [ABSORB_10] }), 1, [ABSORB_10])

    expect(targetHp(result.state)).toBe(100)
  })

  it('cannot rescue lethal damage', () => {
    const result = execute(encounter({ targetHp: 4, targetStatuses: [ABSORB_25] }), 20, [ABSORB_25])

    expect(targetHp(result.state)).toBe(0)
    expect(absorbHealingEvents(result)).toEqual([])
  })

  it('does not trigger from non-hostile direct damage', () => {
    const result = execute(
      encounter({ targetTeamId: 'players', targetStatuses: [ABSORB_25] }),
      20,
      [ABSORB_25],
      'any',
    )

    expect(targetHp(result.state)).toBe(80)
    expect(absorbHealingEvents(result)).toEqual([])
  })

  it('does not trigger from periodic damage', () => {
    const content: CombatContentCatalog = { statuses: [ABSORB_25, PERIODIC_DAMAGE] }
    const state = encounter({
      targetStatuses: [ABSORB_25, PERIODIC_DAMAGE],
      targetActsFirst: true,
    })
    const faced = selectCurrentFinalFacing(state.tactical, 'west')
    const ended = endCombatTurn({ ...state, tactical: faced.state }, content)

    expect(targetHp(ended.state)).toBe(96)
    expect(absorbHealingEvents(ended)).toEqual([])
  })

  it('caps combined active Absorb HP recovery at 100% of qualifying damage', () => {
    const absorb60A = absorbStatus('test.absorb-hp-60-a', 6_000)
    const absorb60B = absorbStatus('test.absorb-hp-60-b', 6_000)
    const result = execute(
      encounter({
        targetHp: 100,
        targetMaxHp: 200,
        targetStatuses: [absorb60A, absorb60B],
      }),
      20,
      [absorb60A, absorb60B],
    )

    expect(targetHp(result.state)).toBe(100)
  })

  it('validates Absorb HP as bounded positive reactive status metadata', () => {
    expect(() => validateCombatStatusDefinition(ABSORB_25)).not.toThrow()
    expect(() =>
      validateCombatStatusDefinition(absorbStatus('test.absorb-too-high', 10_001)),
    ).toThrow(/Absorb HP/i)
    expect(() =>
      validateCombatStatusDefinition(
        absorbStatus('test.absorb-wrong-polarity', 2_500, { polarity: 'negative' }),
      ),
    ).toThrow(/Absorb HP/i)
    expect(() =>
      validateCombatStatusDefinition(
        absorbStatus('test.absorb-not-reactive', 2_500, { reactionClass: 'ordinary' }),
      ),
    ).toThrow(/Absorb HP/i)
  })

  it('uses post-Barrier committed HP loss as the recovery basis', () => {
    const content: CombatContentCatalog = { statuses: [ABSORB_25] }
    const initial = encounter({ targetStatuses: [ABSORB_25] })
    const barrier = executeCombatAction(
      initial,
      barrierAction(8),
      { kind: 'unit', combatantId: 'target' },
      content,
    )
    const hit = executeCombatAction(
      barrier.state,
      damageAction(20),
      { kind: 'unit', combatantId: 'target' },
      content,
    )

    expect(
      hit.events.find(
        (event) => event.event === 'damage_applied' && event.targetCombatantId === 'target',
      ),
    ).toMatchObject({ event: 'damage_applied', amount: 12 })
    expect(targetHp(hit.state)).toBe(91)
    expect(absorbHealingEvents(hit)).toContainEqual(
      expect.objectContaining({ amount: 3, hpBefore: 88, hpAfter: 91 }),
    )
  })

  it('does not trigger when Barrier absorbs all hostile direct damage', () => {
    const content: CombatContentCatalog = { statuses: [ABSORB_25] }
    const initial = encounter({ targetStatuses: [ABSORB_25] })
    const barrier = executeCombatAction(
      initial,
      barrierAction(20),
      { kind: 'unit', combatantId: 'target' },
      content,
    )
    const hit = executeCombatAction(
      barrier.state,
      damageAction(20),
      { kind: 'unit', combatantId: 'target' },
      content,
    )

    expect(targetHp(hit.state)).toBe(100)
    expect(absorbHealingEvents(hit)).toEqual([])
  })

  it('preserves K3 command resolution metadata while applying Absorb HP', () => {
    const action = damageAction(20)
    const content: CombatContentCatalog = { statuses: [ABSORB_25] }
    const provenance = createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: action.id,
      actionVersion: action.version,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'chain:k4-absorb-hp',
    })
    const triggerGuard = createCombatTriggerGuard({
      triggerChainId: 'chain:k4-absorb-hp',
      maxDepth: 4,
      reactionBudget: 6,
    })
    const executeWithContext = executeCombatAction as unknown as ExecuteWithResolutionContext

    const result = executeWithContext(
      encounter({ targetStatuses: [ABSORB_25] }),
      action,
      { kind: 'unit', combatantId: 'target' },
      content,
      { provenance, triggerGuard },
    )

    expect(targetHp(result.state)).toBe(85)
    expect(result.resolution).toEqual({
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance,
      triggerGuard,
    })
  })
})
