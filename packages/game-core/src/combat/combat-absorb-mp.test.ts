import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  type CombatActionDefinition,
  type CombatEncounterState,
  type CombatResolutionTransition,
  type CombatStatusDefinition,
} from './actions'
import { createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import {
  COMBAT_RESOLUTION_PIPELINE_VERSION,
  createCombatActionProvenance,
  createCombatTriggerGuard,
} from './combat-kernel-types'
import { PHASE4_STATUSES } from './status-content'

function absorbMpStatus(
  basisPoints = 2_500,
  overrides: Partial<CombatStatusDefinition> = {},
): CombatStatusDefinition & { absorbMpBasisPoints: number } {
  return {
    id: 'test.absorb-mp',
    version: 1,
    maximumStacks: 3,
    durationOwnerTurnStarts: 2,
    damageTakenMultiplierBasisPoints: 10_000,
    polarity: 'positive',
    reactionClass: 'reactive',
    absorbMpBasisPoints: basisPoints,
    ...overrides,
  }
}

const MP25 = absorbMpStatus()
const HP25: CombatStatusDefinition = {
  id: 'test.absorb-hp',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 2,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'positive',
  reactionClass: 'reactive',
  absorbHpBasisPoints: 2_500,
}

function encounter(
  options: {
    hp?: number
    mp?: number
    maxMp?: number
    stacks?: number
    statuses?: readonly CombatStatusDefinition[]
    actorStatuses?: readonly CombatStatusDefinition[]
    friendly?: boolean
    targetFirst?: boolean
    witnessAbsorbs?: boolean
  } = {},
): CombatEncounterState {
  const ids = ['actor', 'target', 'witness']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:absorb-mp-reconcile',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: 43,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'actor' || (id === 'target' && options.friendly) ? 'players' : 'enemies',
        initiative: id === 'target' && options.targetFirst ? 30 : 20 - index,
        baseMovementBudget: 3,
        hp: id === 'target' ? (options.hp ?? 100) : 100,
        maxHp: 100,
        mp: id === 'target' ? (options.mp ?? 10) : 10,
        maxMp: id === 'target' ? (options.maxMp ?? 100) : 100,
      })),
    }),
  ).state
  return createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 3,
      height: 1,
      terrains: [{ id: 'open', traversalCost: 1 }],
      tiles: ids.map((_, x) => ({ position: { x, y: 0 }, elevation: 0, terrainId: 'open' })),
      movementProfiles: [{ id: 'ground', maxElevationStep: 0, terrainCostOverrides: [] }],
      placements: ids.map((combatantId, x) => ({
        combatantId,
        position: { x, y: 0 },
        facing: 'east',
        movementProfileId: 'ground',
      })),
    }),
    ids.map((combatantId) => ({
      combatantId,
      statuses: (combatantId === 'target'
        ? (options.statuses ?? [MP25])
        : combatantId === 'actor'
          ? (options.actorStatuses ?? [])
          : options.witnessAbsorbs
            ? [MP25]
            : []
      ).map((status) => ({
        statusId: status.id,
        statusVersion: status.version,
        stacks: combatantId === 'target' ? (options.stacks ?? 1) : 1,
        remainingOwnerTurnStarts: 2,
        sourceCombatantId: combatantId,
      })),
    })),
  )
}

function hit(amount = 20): CombatActionDefinition {
  return {
    id: 'test.absorb-mp-hit',
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 1,
      maximumRange: 2,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount }],
  }
}

function cast(
  state: CombatEncounterState = encounter(),
  action: CombatActionDefinition = hit(),
  statuses: readonly CombatStatusDefinition[] = [MP25],
): CombatResolutionTransition {
  return executeCombatAction(state, action, { kind: 'unit', combatantId: 'target' }, { statuses })
}

function unit(result: CombatResolutionTransition, id = 'target') {
  return result.state.tactical.battle.combatants.find((combatant) => combatant.id === id)!
}

function mpEvents(result: CombatResolutionTransition) {
  return result.events.filter(
    (event) =>
      event.event === 'resource_changed' && event.actionId === 'status.absorb-mp.current.v1',
  )
}

describe('Absorb MP committed-command recovery', () => {
  it('restores MP to the damaged defender, not the attacker or HP pool', () => {
    const result = cast()
    expect(unit(result)).toMatchObject({ hp: 80, mp: 15 })
    expect(unit(result, 'actor')).toMatchObject({ hp: 100, mp: 10 })
    expect(mpEvents(result)).toEqual([
      {
        event: 'resource_changed',
        actionId: 'status.absorb-mp.current.v1',
        sourceCombatantId: 'target',
        targetCombatantId: 'target',
        resource: 'mp',
        delta: 5,
        before: 10,
        after: 15,
      },
    ])
  })

  it('rounds down a fractional percentage', () => {
    expect(unit(cast(encounter(), hit(7))).mp).toBe(11)
  })

  it('restores the minimum one MP for positive qualifying math', () => {
    const status = absorbMpStatus(1)
    const result = cast(encounter({ statuses: [status] }), hit(1), [status])
    expect(unit(result).mp).toBe(11)
  })

  it('aggregates multi-hit HP loss before applying the minimum once', () => {
    const action = hit(1)
    action.effects = [...action.effects, ...action.effects]
    const result = cast(encounter(), action)
    expect(unit(result)).toMatchObject({ hp: 98, mp: 11 })
    expect(mpEvents(result)).toHaveLength(1)
  })

  it('uses actual post-Barrier HP loss', () => {
    const barrier = hit()
    barrier.effects = [{ type: 'barrier-change', recipient: 'primary-unit', amount: 8 }]
    const result = cast(cast(encounter(), barrier).state)
    expect(unit(result)).toMatchObject({ hp: 88, mp: 13 })
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 12 },
    ])
  })

  it('does not restore MP when Barrier absorbs the whole hit', () => {
    const barrier = hit()
    barrier.effects = [{ type: 'barrier-change', recipient: 'primary-unit', amount: 20 }]
    const result = cast(cast(encounter(), barrier).state)
    expect(unit(result)).toMatchObject({ hp: 100, mp: 10 })
    expect(mpEvents(result)).toEqual([])
  })

  it.each([0, 20])('caps restoration at max MP with %s available capacity', (capacity) => {
    const result = cast(encounter({ mp: 100 - capacity }))
    expect(unit(result).mp).toBe(capacity === 0 ? 100 : 85)
    expect(mpEvents(result)).toHaveLength(capacity === 0 ? 0 : 1)
  })

  it('reports only the MP actually restored when capped', () => {
    const result = cast(encounter({ mp: 98 }))
    expect(unit(result).mp).toBe(100)
    expect(mpEvents(result)).toEqual([
      expect.objectContaining({ delta: 2, before: 98, after: 100 }),
    ])
  })

  it('does not restore MP to a combatant without an MP capacity', () => {
    const result = cast(encounter({ mp: 0, maxMp: 0 }))
    expect(unit(result).mp).toBe(0)
    expect(mpEvents(result)).toEqual([])
  })

  it('includes active status stacks', () => {
    const result = cast(encounter({ stacks: 2 }))
    expect(unit(result).mp).toBe(20)
  })

  it('caps combined MP percentages at 100% of qualifying HP loss', () => {
    const first = absorbMpStatus(6_000, { id: 'test.mp60-a' })
    const second = absorbMpStatus(6_000, { id: 'test.mp60-b' })
    const result = cast(encounter({ mp: 0, statuses: [first, second] }), hit(), [first, second])
    expect(unit(result).mp).toBe(20)
  })

  it('coexists with HP recovery without reducing the shared damage basis', () => {
    const statuses = [MP25, HP25]
    const result = cast(encounter({ statuses }), hit(), statuses)
    expect(unit(result)).toMatchObject({ hp: 85, mp: 15 })
    expect(mpEvents(result)).toHaveLength(1)
    expect(result.events.filter((event) => event.event === 'healing_applied')).toHaveLength(1)
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 20 },
    ])
  })

  it('restores MP even when ordinary healing removes all net HP loss', () => {
    const action = hit()
    action.effects = [...action.effects, { type: 'healing', recipient: 'primary-unit', amount: 20 }]
    const result = cast(encounter(), action)
    expect(unit(result)).toMatchObject({ hp: 100, mp: 15 })
  })

  it('uses the post-command MP pool after an ordinary resource change', () => {
    const action = hit()
    action.effects = [
      ...action.effects,
      { type: 'resource-change', recipient: 'primary-unit', resource: 'mp', delta: 87 },
    ]
    const result = cast(encounter(), action)
    expect(unit(result).mp).toBe(100)
    expect(mpEvents(result)).toEqual([
      expect.objectContaining({ delta: 3, before: 97, after: 100 }),
    ])
  })

  it('resolves AoE recovery independently for each damaged defender', () => {
    const action = hit()
    action.target = { ...action.target, shape: { kind: 'circle', radius: 1 } }
    action.effects = [{ type: 'damage', recipient: 'affected-units', amount: 20 }]
    const result = cast(encounter({ witnessAbsorbs: true }), action)
    expect(unit(result).mp).toBe(15)
    expect(unit(result, 'witness').mp).toBe(15)
    expect(unit(result, 'actor').mp).toBe(10)
    expect(mpEvents(result)).toHaveLength(2)
  })

  it('does not restore MP after lethal damage or count overkill', () => {
    const result = cast(encounter({ hp: 3 }))
    expect(unit(result)).toMatchObject({ hp: 0, mp: 10 })
    expect(mpEvents(result)).toEqual([])
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 3 },
    ])
  })

  it('does not restore between hits when a later hit is lethal', () => {
    const action = hit(2)
    action.effects = [...action.effects, ...action.effects]
    const result = cast(encounter({ hp: 3, statuses: [MP25, HP25] }), action, [MP25, HP25])
    expect(unit(result)).toMatchObject({ hp: 0, mp: 10 })
    expect(mpEvents(result)).toEqual([])
  })

  it('does not trigger from friendly fire', () => {
    const action = hit()
    action.target = { ...action.target, teamPolicy: 'any', friendlyFire: 'all-units' }
    const result = cast(encounter({ friendly: true }), action)
    expect(unit(result)).toMatchObject({ hp: 80, mp: 10 })
    expect(mpEvents(result)).toEqual([])
  })

  it('does not trigger from zero damage or from absent metadata', () => {
    expect(mpEvents(cast(encounter(), hit(0)))).toEqual([])
    const result = cast(encounter({ statuses: [] }), hit(), [])
    expect(unit(result)).toMatchObject({ hp: 80, mp: 10 })
    expect(mpEvents(result)).toEqual([])
  })

  it('does not trigger from periodic status damage', () => {
    const periodic: CombatStatusDefinition = {
      ...HP25,
      id: 'test.periodic',
      absorbHpBasisPoints: undefined,
      endOfTurn: { type: 'damage', amount: 4 },
    }
    const statuses = [MP25, periodic]
    const state = encounter({ targetFirst: true, statuses })
    const tactical = selectCurrentFinalFacing(state.tactical, 'east').state
    const result = endCombatTurn({ ...state, tactical }, { statuses })
    expect(unit(result)).toMatchObject({ hp: 96, mp: 10 })
    expect(mpEvents(result)).toEqual([])
  })

  it('excludes Burn backlash while still recovering the hostile defender', () => {
    const statuses = [...PHASE4_STATUSES, MP25]
    const state = encounter({ actorStatuses: [MP25] })
    const burn = hit()
    burn.effects = [{ type: 'burn', recipient: 'actor' }]
    const burned = cast(state, burn, statuses)
    const result = cast(burned.state, hit(), statuses)
    expect(unit(result, 'actor')).toMatchObject({ hp: 98, mp: 10 })
    expect(unit(result)).toMatchObject({ hp: 80, mp: 15 })
    expect(mpEvents(result)).toHaveLength(1)
  })

  it('does not mutate input state or consume recovery during evaluation', () => {
    const state = encounter()
    const before = JSON.stringify(state)
    const evaluation = evaluateCombatAction(
      state,
      hit(),
      { kind: 'unit', combatantId: 'target' },
      { statuses: [MP25] },
    )
    expect(evaluation.legal).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
    const result = cast(state)
    expect(JSON.stringify(state)).toBe(before)
    expect(unit(result).mp).toBe(15)
    expect(result.resolution).toBeUndefined()
  })

  it('preserves K3 resolution metadata and the authoritative damage ledger', () => {
    const action = hit()
    const provenance = createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: action.id,
      actionVersion: action.version,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: 'chain:absorb-mp',
    })
    const triggerGuard = createCombatTriggerGuard({ triggerChainId: 'chain:absorb-mp' })
    const result = executeCombatAction(
      encounter(),
      action,
      { kind: 'unit', combatantId: 'target' },
      { statuses: [MP25] },
      { provenance, triggerGuard },
    )
    expect(unit(result).mp).toBe(15)
    expect(result.resolution).toEqual({
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance,
      triggerGuard,
    })
    expect(result.state.effectState?.damageHistory).toEqual([
      { combatantId: 'target', round: 1, amount: 20 },
    ])
  })

  it.each([0, -1, 0.5, 10_001, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid MP basis points %s',
    (basisPoints) => {
      expect(() => validateCombatStatusDefinition(absorbMpStatus(basisPoints))).toThrow(/Absorb MP/)
    },
  )

  it.each([1, 10_000])('accepts MP basis-point boundary %s', (basisPoints) => {
    expect(() => validateCombatStatusDefinition(absorbMpStatus(basisPoints))).not.toThrow()
  })

  it.each<Partial<CombatStatusDefinition>>([
    { polarity: 'negative' },
    { polarity: 'neutral' },
    { polarity: 'mixed' },
    { polarity: undefined },
    { reactionClass: 'ordinary' },
    { reactionClass: 'periodic' },
    { reactionClass: 'self-cost' },
    { reactionClass: 'system' },
    { reactionClass: undefined },
  ])('rejects non-positive or non-reactive MP metadata %j', (overrides) => {
    expect(() => validateCombatStatusDefinition(absorbMpStatus(2_500, overrides))).toThrow(
      /Absorb MP/,
    )
  })
})
