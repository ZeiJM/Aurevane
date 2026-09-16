import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEncounterState,
  type CombatResolutionContext,
  type CombatStatusDefinition,
} from './actions'
import { advanceBattleRng, createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState } from './board'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'
import {
  createStatDrivenCombatEncounterState,
  forecastStatDrivenAttack,
  executeStatDrivenAttack,
  reattachStatDrivenCombatBridge,
} from './stat-driven-combat'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import { PV1F_COMBAT_CONTENT } from './pv1f-action-economy'

// Test-first intersection describes the approved metadata before production types exist.
type AccuracyStatusFixture = CombatStatusDefinition & {
  markAccuracyBonusBasisPoints?: number
  blindAccuracyPenaltyBasisPoints?: number
}
const MARK: AccuracyStatusFixture = {
  id: 'test.current-mark',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 3,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'negative',
  reactionClass: 'ordinary',
  markAccuracyBonusBasisPoints: 1_500,
}
const BLIND: AccuracyStatusFixture = {
  id: 'test.current-blind',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 3,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'negative',
  reactionClass: 'ordinary',
  blindAccuracyPenaltyBasisPoints: 1_500,
}
const CONTENT: CombatContentCatalog = { statuses: [MARK, BLIND] }
const TARGET = { kind: 'unit' as const, combatantId: 'target' }

function world(accuracy = 6_000, evasion = 1_000, seed = 53) {
  const ids = ['actor', 'ally', 'target', 'z-target']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:mark-blind-contract',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: seed,
      combatants: ids.map((id, index) => ({
        id,
        teamId: index < 2 ? 'players' : 'enemies',
        initiative: 40 - index * 10,
        baseMovementBudget: 3,
        hp: 100,
        maxHp: 100,
        mp: 20,
        maxMp: 30,
      })),
    }),
  ).state
  const base = createCombatEncounterState(
    createTacticalBattleState({
      battle,
      width: 4,
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
  )
  return createStatDrivenCombatEncounterState(
    base,
    ids.map((combatantId) => ({
      combatantId,
      provenance: { kind: 'scenario', sourceId: `scenario:${combatantId}`, sourceRulesVersion: 2 },
      accuracy,
      evasion,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 30,
      mysticPower: 30,
    })),
  )
}
function attack(): CombatActionDefinition {
  return {
    id: 'test.accuracy-attack',
    version: 1,
    sourceType: 'test',
    tags: ['attack'],
    target: {
      kind: 'unit',
      teamPolicy: 'enemy',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'enemies-only',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    accuracyMode: 'per-target',
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 20 }],
  }
}
function statusAction(statusId: string): CombatActionDefinition {
  return {
    ...attack(),
    id: `test.apply.${statusId}`,
    accuracyMode: 'automatic',
    tags: [],
    target: { ...attack().target, teamPolicy: 'any', friendlyFire: 'all-units' },
    effects: [{ type: 'apply-status', recipient: 'primary-unit', statusId, stacks: 1 }],
  }
}
function apply(
  state: CombatEncounterState,
  statusId: string,
  targetId = 'target',
  content = CONTENT,
  context?: CombatResolutionContext,
) {
  return executeCombatAction(
    state,
    statusAction(statusId),
    { kind: 'unit', combatantId: targetId },
    content,
    context,
  ).state
}
function chance(state: CombatEncounterState, content = CONTENT, action = attack()) {
  return evaluateCombatAction(state, action, TARGET, content).targetHitChances?.[0]
    ?.hitChanceBasisPoints
}
function advanceTo(state: CombatEncounterState, actorId: string, content = CONTENT) {
  let next = state
  for (let index = 0; index < 8; index += 1) {
    if (next.tactical.battle.currentTurn?.combatantId === actorId) return next
    next = endCombatTurn(next, content).state
  }
  throw new Error(`Fixture did not reach the living actor ${actorId}.`)
}
function cleanse(state: CombatEncounterState, statusId: string, targetId: string) {
  const action: CombatActionDefinition = {
    ...statusAction(statusId),
    id: 'test.cleanse',
    effects: [{ type: 'remove-status', recipient: 'primary-unit', statusIds: [statusId] }],
  }
  return executeCombatAction(state, action, { kind: 'unit', combatantId: targetId }, CONTENT).state
}
function context(actorId: string, chainId: string): CombatResolutionContext {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: statusAction(MARK.id).id,
      actionVersion: 1,
      sourceCombatantId: actorId,
      controllerCombatantId: actorId,
      triggerChainId: chainId,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: chainId }),
  }
}

describe('Mark and Blind: public-entry contract', () => {
  it('adds fifteen percentage points for the Mark source, not fifteen percent of accuracy', () => {
    expect(chance(apply(world(), MARK.id))).toBe(6_500)
  })
  it('does not grant the applying source bonus to its ally', () => {
    const marked = apply(world(), MARK.id)
    expect(chance(advanceTo(marked, 'ally'))).toBe(5_000)
  })
  it('supports a second independent Mark without overwriting the first source relationship', () => {
    const first = apply(world(), MARK.id)
    const second = apply(advanceTo(first, 'ally'), MARK.id)
    expect(chance(second)).toBe(6_500)
    expect(chance(advanceTo(second, 'actor'))).toBe(6_500)
  })
  it('does not stack the same source Mark on repeated application', () => {
    expect(chance(apply(apply(world(), MARK.id), MARK.id))).toBe(6_500)
  })
  it('does not increase damage merely because the new Mark improves accuracy', () => {
    const state = apply(world(10_000, 0), MARK.id)
    const result = executeCombatAction(state, attack(), TARGET, CONTENT)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(
      80,
    )
  })
  it('subtracts fifteen percentage points from the blinded actor', () => {
    expect(chance(apply(world(), BLIND.id, 'actor'))).toBe(3_500)
  })
  it('does not lower attacker accuracy merely because the target is blind', () => {
    expect(chance(apply(world(), BLIND.id, 'target'))).toBe(5_000)
  })
  it('does not compound Blind when the same source reapplies it', () => {
    const once = apply(world(), BLIND.id, 'actor')
    expect(chance(apply(once, BLIND.id, 'actor'))).toBe(3_500)
  })
  it('does not compound Blind when another source reapplies it', () => {
    const first = apply(world(), BLIND.id, 'actor')
    const second = apply(advanceTo(first, 'ally'), BLIND.id, 'actor')
    expect(chance(advanceTo(second, 'actor'))).toBe(3_500)
  })
  it('combines Mark and Blind additively with the Skill modifier before clamping', () => {
    const state = apply(apply(world(), MARK.id), BLIND.id, 'actor')
    expect(chance(state, CONTENT, { ...attack(), accuracyModifierBasisPoints: 500 })).toBe(5_500)
  })
  it('clamps positive Mark at one hundred percent', () => {
    expect(chance(apply(world(10_000, 0), MARK.id))).toBe(10_000)
  })
  it('clamps negative Blind at zero percent', () => {
    expect(chance(apply(world(500, 1_000), BLIND.id, 'actor'))).toBe(0)
  })
  it('never makes Automatic Hit roll because the caster is blinded', () => {
    const state = apply(world(0), BLIND.id, 'actor')
    const result = executeCombatAction(
      state,
      { ...attack(), accuracyMode: 'automatic' },
      TARGET,
      CONTENT,
    )
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
    expect(result.events.some((event) => event.event === 'combat_accuracy_resolved')).toBe(false)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(
      80,
    )
  })
  it('does not sample or mutate RNG while forecasting current Mark and Blind', () => {
    const state = apply(apply(world(), MARK.id), BLIND.id, 'actor')
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, attack(), TARGET, CONTENT)
    expect(preview.targetHitChances?.[0]?.hitChanceBasisPoints).toBe(5_000)
    expect(
      preview.projectedEvents.some((event) => event.event === 'combat_accuracy_resolved'),
    ).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('uses the same status-adjusted chance in Basic Attack forecasting', () => {
    const initial = world()
    const marked = apply(initial, MARK.id)
    const basic: CombatActionDefinition = {
      ...attack(),
      sourceType: 'basic-attack',
      accuracyMode: undefined,
    }
    const forecast = forecastStatDrivenAttack(
      reattachStatDrivenCombatBridge(marked, initial.statBridge),
      basic,
      TARGET,
      CONTENT,
    )
    expect(forecast.hitChanceBasisPoints).toBe(6_500)
  })
  it('cleansing the Mark removes the source accuracy benefit', () => {
    expect(chance(cleanse(apply(world(), MARK.id), MARK.id, 'target'))).toBe(5_000)
  })
  it('cleansing Blind removes its penalty', () => {
    expect(chance(cleanse(apply(world(), BLIND.id, 'actor'), BLIND.id, 'actor'))).toBe(5_000)
  })
  it('expires a one-owner-turn Mark without changing the ordinary turn order', () => {
    const content: CombatContentCatalog = {
      statuses: [{ ...MARK, durationOwnerTurnStarts: 1 }, BLIND],
    }
    const initial = apply(world(), MARK.id, 'target', content)
    expect(chance(initial, content)).toBe(6_500)
    expect(
      chance(advanceTo(advanceTo(initial, 'target', content), 'actor', content), content),
    ).toBe(5_000)
  })
  it('refreshes only the reapplying source duration and leaves the other Mark intact', () => {
    const first = apply(world(), MARK.id)
    const both = apply(advanceTo(first, 'ally'), MARK.id)
    const afterOneCycle = advanceTo(both, 'actor')
    const refreshed = apply(afterOneCycle, MARK.id)
    const rows = refreshed.statusState.find((row) => row.combatantId === 'target')?.statuses ?? []
    expect(
      rows.find((status) => status.statusId === MARK.id && status.sourceCombatantId === 'actor')
        ?.remainingOwnerTurnStarts,
    ).toBe(3)
    expect(
      rows.find((status) => status.statusId === MARK.id && status.sourceCombatantId === 'ally')
        ?.remainingOwnerTurnStarts,
    ).toBe(2)
  })
  it('does not overwrite the other Mark source provenance', () => {
    const first = apply(world(), MARK.id, 'target', CONTENT, context('actor', 'chain:mark-a'))
    const original = first.statusState
      .find((row) => row.combatantId === 'target')
      ?.statuses.find((status) => status.statusId === MARK.id)
    expect(original?.provenance).toBeDefined()
    const second = apply(
      advanceTo(first, 'ally'),
      MARK.id,
      'target',
      CONTENT,
      context('ally', 'chain:mark-b'),
    )
    const retained = second.statusState
      .find((row) => row.combatantId === 'target')
      ?.statuses.find(
        (status) => status.statusId === MARK.id && status.sourceCombatantId === 'actor',
      )
    expect(retained).toEqual(original)
  })
  it('retains ordinary vulnerability behavior for a metadata-free historical-style definition', () => {
    const old: CombatStatusDefinition = {
      id: 'mark',
      version: 1,
      maximumStacks: 1,
      durationOwnerTurnStarts: 2,
      damageTakenMultiplierBasisPoints: 12_500,
    }
    const content: CombatContentCatalog = { statuses: [old] }
    const state = apply(world(10_000, 0), old.id, 'target', content)
    const result = executeCombatAction(
      state,
      { ...attack(), accuracyMode: 'automatic' },
      TARGET,
      content,
    )
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(
      75,
    )
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })
  it('gates a new Mark application on the same hostile target hit result as its damage', () => {
    const state = world(0)
    const action: CombatActionDefinition = {
      ...attack(),
      effects: [
        { type: 'damage', recipient: 'primary-unit', amount: 20 },
        { type: 'apply-status', recipient: 'primary-unit', statusId: MARK.id, stacks: 1 },
      ],
    }
    const result = executeCombatAction(state, action, TARGET, CONTENT)
    expect(result.state.statusState).toEqual(state.statusState)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(
      100,
    )
  })
})

function statuses(state: CombatEncounterState, id = 'target') {
  return state.statusState.find((row) => row.combatantId === id)?.statuses ?? []
}
function withStatuses(
  state: CombatEncounterState,
  next: readonly object[],
  id = 'target',
): CombatEncounterState {
  // Deliberately malformed runtime data exercises negative snapshot validation.
  return {
    ...state,
    statusState: state.statusState.map((row) =>
      row.combatantId === id ? { ...row, statuses: next } : row,
    ),
  } as unknown as CombatEncounterState
}
function basic(): CombatActionDefinition {
  return { ...attack(), sourceType: 'basic-attack', accuracyMode: undefined }
}

describe('Mark and Blind: authoring and snapshot guards', () => {
  const invalidMagnitudes = [
    -1,
    0,
    0.5,
    3_001,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER,
  ]
  it.each(invalidMagnitudes)(
    'rejects invalid Mark magnitude %s at authoring and both public action boundaries',
    (value) => {
      const definition: AccuracyStatusFixture = { ...MARK, markAccuracyBonusBasisPoints: value }
      const content = { statuses: [definition] }
      expect(() => validateCombatStatusDefinition(definition)).toThrow()
      expect(() => evaluateCombatAction(world(), statusAction(MARK.id), TARGET, content)).toThrow()
      expect(() => executeCombatAction(world(), statusAction(MARK.id), TARGET, content)).toThrow()
    },
  )
  it.each(invalidMagnitudes)(
    'rejects invalid Blind magnitude %s at authoring and both public action boundaries',
    (value) => {
      const definition: AccuracyStatusFixture = { ...BLIND, blindAccuracyPenaltyBasisPoints: value }
      const content = { statuses: [definition] }
      expect(() => validateCombatStatusDefinition(definition)).toThrow()
      expect(() => evaluateCombatAction(world(), statusAction(BLIND.id), TARGET, content)).toThrow()
      expect(() => executeCombatAction(world(), statusAction(BLIND.id), TARGET, content)).toThrow()
    },
  )
  const invalidProfiles: Partial<AccuracyStatusFixture>[] = [
    { maximumStacks: 2 },
    { polarity: 'positive' },
    { reactionClass: 'reactive' },
    { damageTakenMultiplierBasisPoints: 12_500 },
    { endOfTurn: { type: 'damage', amount: 5 } },
    { nextRoundInitiative: -5 },
    { blindAccuracyPenaltyBasisPoints: 1_500 },
  ]
  it.each(invalidProfiles)('rejects mixed, stacking or nonordinary Mark definition %j', (patch) => {
    const definition = { ...MARK, ...patch }
    expect(() => validateCombatStatusDefinition(definition)).toThrow()
    expect(() => apply(world(), MARK.id, 'target', { statuses: [definition] })).toThrow()
  })
  it('rejects a current Mark row without its source-scoped identity marker', () => {
    const marked = apply(world(), MARK.id)
    const unscoped = statuses(marked).map((row) => {
      const copy = { ...row } as Record<string, unknown>
      delete copy.sourceScopedMark
      return copy
    })
    expect(() => chance(withStatuses(marked, unscoped))).toThrow()
  })
  it('rejects a source-scoped marker attached to a historical definition', () => {
    const historical = { ...MARK, markAccuracyBonusBasisPoints: undefined }
    const state = withStatuses(world(), [
      {
        statusId: MARK.id,
        statusVersion: 1,
        stacks: 1,
        remainingOwnerTurnStarts: 3,
        sourceCombatantId: 'actor',
        sourceScopedMark: true,
      },
    ])
    expect(() => chance(state, { statuses: [historical] })).toThrow()
  })
  it('continues rejecting ordinary duplicate status IDs', () => {
    const first = {
      statusId: 'ordinary',
      statusVersion: 1,
      stacks: 1,
      remainingOwnerTurnStarts: 2,
      sourceCombatantId: 'actor',
    }
    expect(
      validateCombatEncounterState(
        withStatuses(world(), [first, { ...first, sourceCombatantId: 'ally' }]),
      ).length,
    ).toBeGreaterThan(0)
  })
  it('rejects repeated current Mark identities for the same source', () => {
    const marked = apply(world(), MARK.id)
    expect(
      validateCombatEncounterState(withStatuses(marked, [...statuses(marked), ...statuses(marked)]))
        .length,
    ).toBeGreaterThan(0)
  })
  it('rejects mixed scoped and unscoped instances of one status ID', () => {
    const marked = apply(world(), MARK.id)
    const old = { ...statuses(marked)[0], sourceCombatantId: 'ally', sourceScopedMark: undefined }
    expect(
      validateCombatEncounterState(withStatuses(marked, [...statuses(marked), old])).length,
    ).toBeGreaterThan(0)
  })
  it('rejects mixed pinned versions of one source-scoped definition', () => {
    const marked = apply(world(), MARK.id)
    const other = { ...statuses(marked)[0], sourceCombatantId: 'ally', statusVersion: 2 }
    expect(
      validateCombatEncounterState(withStatuses(marked, [...statuses(marked), other])).length,
    ).toBeGreaterThan(0)
  })
  it('rejects a current accuracy row with a mismatched pinned catalog version', () => {
    const marked = apply(world(), MARK.id)
    const changed = withStatuses(
      marked,
      statuses(marked).map((row) => ({ ...row, statusVersion: 2 })),
    )
    expect(() => chance(changed)).toThrow()
  })
  it('rejects a multi-stack current accuracy row even when only one identity exists', () => {
    const marked = apply(world(), MARK.id)
    expect(() =>
      chance(
        withStatuses(
          marked,
          statuses(marked).map((row) => ({ ...row, stacks: 2 })),
        ),
      ),
    ).toThrow()
  })
  it('rejects a current accuracy duration exceeding its pinned definition', () => {
    const marked = apply(world(), MARK.id)
    expect(() =>
      chance(
        withStatuses(
          marked,
          statuses(marked).map((row) => ({ ...row, remainingOwnerTurnStarts: 4 })),
        ),
      ),
    ).toThrow()
  })
  it('preserves current per-source rows through JSON reload and encounter reconstruction', () => {
    const first = apply(world(), MARK.id)
    const both = apply(advanceTo(first, 'ally'), MARK.id)
    const restored = JSON.parse(JSON.stringify(both)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    const rebuilt = {
      ...createCombatEncounterState(restored.tactical, restored.statusState),
      statBridge: restored.statBridge,
    }
    expect(statuses(rebuilt).map((row) => row.sourceCombatantId)).toEqual(['actor', 'ally'])
    expect(chance(rebuilt)).toBe(6_500)
    expect(chance(advanceTo(rebuilt, 'actor'))).toBe(6_500)
  })
  it('requires stable source order within a source-scoped status ID', () => {
    const first = apply(world(), MARK.id)
    const both = apply(advanceTo(first, 'ally'), MARK.id)
    expect(statuses(both)).toHaveLength(2)
    expect(
      validateCombatEncounterState(withStatuses(both, [...statuses(both)].reverse())).length,
    ).toBeGreaterThan(0)
  })
})

describe('Mark and Blind: command and lifecycle interactions', () => {
  it('cleanses every source for an explicitly removed Mark ID', () => {
    const first = apply(world(), MARK.id)
    const both = apply(advanceTo(first, 'ally'), MARK.id)
    expect(statuses(both)).toHaveLength(2)
    const cleared = cleanse(both, MARK.id, 'target')
    expect(statuses(cleared)).toEqual([])
    expect(chance(cleared)).toBe(5_000)
    expect(chance(advanceTo(cleared, 'actor'))).toBe(5_000)
  })
  it('reports an independently expiring Mark source without removing a refreshed source', () => {
    const content = { statuses: [{ ...MARK, durationOwnerTurnStarts: 2 }, BLIND] }
    const first = apply(world(), MARK.id, 'target', content)
    const both = apply(advanceTo(first, 'ally', content), MARK.id, 'target', content)
    const refreshed = apply(advanceTo(both, 'actor', content), MARK.id, 'target', content)
    const alliedTurn = advanceTo(refreshed, 'ally', content)
    const transitioned = endCombatTurn(alliedTurn, content)
    expect(statuses(transitioned.state).map((row) => row.sourceCombatantId)).toEqual(['actor'])
    expect(transitioned.events).toContainEqual({
      event: 'status_expired',
      combatantId: 'target',
      statusId: MARK.id,
      sourceCombatantId: 'ally',
    })
  })
  it('refreshes Blind duration without additional penalty', () => {
    const first = apply(world(), BLIND.id, 'actor')
    const cycled = advanceTo(advanceTo(first, 'ally'), 'actor')
    expect(statuses(cycled, 'actor')[0]?.remainingOwnerTurnStarts).toBe(2)
    const refreshed = apply(cycled, BLIND.id, 'actor')
    expect(statuses(refreshed, 'actor')[0]?.remainingOwnerTurnStarts).toBe(3)
    expect(chance(refreshed)).toBe(3_500)
  })
  it('does not stack accuracy bonuses from alternate Mark definitions for one source', () => {
    const stronger: AccuracyStatusFixture = {
      ...MARK,
      id: 'test.stronger-mark',
      markAccuracyBonusBasisPoints: 2_000,
    }
    const content = { statuses: [MARK, BLIND, stronger] }
    const state = apply(apply(world(), MARK.id, 'target', content), stronger.id, 'target', content)
    expect(chance(state, content)).toBe(7_000)
  })
  it('does not stack Blind penalties from alternate definitions', () => {
    const stronger: AccuracyStatusFixture = {
      ...BLIND,
      id: 'test.stronger-blind',
      blindAccuracyPenaltyBasisPoints: 2_000,
    }
    const content = { statuses: [MARK, BLIND, stronger] }
    const state = apply(apply(world(), BLIND.id, 'actor', content), stronger.id, 'actor', content)
    expect(chance(state, content)).toBe(3_000)
  })
  it('does not borrow a stronger Mark owned by another attacker', () => {
    const stronger: AccuracyStatusFixture = {
      ...MARK,
      id: 'test.stronger-mark',
      markAccuracyBonusBasisPoints: 3_000,
    }
    const content = { statuses: [MARK, BLIND, stronger] }
    const first = apply(world(), MARK.id, 'target', content)
    const both = apply(advanceTo(first, 'ally', content), stronger.id, 'target', content)
    expect(chance(both, content)).toBe(8_000)
    expect(chance(advanceTo(both, 'actor', content), content)).toBe(6_500)
  })
  it('does not use a just-applied Mark to improve the same command hit roll', () => {
    const state = world()
    const action = {
      ...attack(),
      effects: [
        {
          type: 'apply-status' as const,
          recipient: 'primary-unit' as const,
          statusId: MARK.id,
          stacks: 1,
        },
        ...attack().effects,
      ],
    }
    const result = executeCombatAction(state, action, TARGET, CONTENT)
    expect(result.events.find((event) => event.event === 'combat_accuracy_resolved')).toMatchObject(
      { hitChanceBasisPoints: 5_000 },
    )
  })
  it('previews the applying source stack count rather than another attacker Mark', () => {
    const first = apply(world(), MARK.id)
    const state = advanceTo(first, 'ally')
    const preview = evaluateCombatAction(state, statusAction(MARK.id), TARGET, CONTENT)
    expect(preview.projectedEffects).toContainEqual({
      effectType: 'apply-status',
      combatantId: 'target',
      before: 0,
      after: 1,
    })
  })
  it('keeps alternate-target Mark modifiers independent in an area command', () => {
    const state = apply(apply(world(), MARK.id), BLIND.id, 'actor')
    const area: CombatActionDefinition = {
      ...attack(),
      target: { ...attack().target, kind: 'ground-tile', shape: { kind: 'circle', radius: 1 } },
      effects: [{ type: 'damage', recipient: 'affected-units', amount: 20 }],
    }
    const selection = { kind: 'tile' as const, position: { x: 2, y: 0 } }
    const preview = evaluateCombatAction(state, area, selection, CONTENT)
    expect(preview.targetHitChances).toEqual([
      { targetCombatantId: 'target', hitChanceBasisPoints: 5_000 },
      { targetCombatantId: 'z-target', hitChanceBasisPoints: 3_500 },
    ])
    const result = executeCombatAction(state, area, selection, CONTENT)
    expect(
      result.events
        .filter((event) => event.event === 'combat_accuracy_resolved')
        .map((event) => event.hitChanceBasisPoints),
    ).toEqual([5_000, 3_500])
    expect(result.state.tactical.battle.rng).toEqual(
      advanceBattleRng(advanceBattleRng(state.tactical.battle.rng).state).state,
    )
  })
  it.each([1, 7, 19, 53, 101, 997])(
    'uses the same adjusted chance and one RNG draw for Basic Attack seed %s',
    (seed) => {
      const initial = world(6_000, 1_000, seed)
      const state = reattachStatDrivenCombatBridge(apply(initial, MARK.id), initial.statBridge)
      const draw = advanceBattleRng(state.tactical.battle.rng)
      const hit = draw.value % 10_000 < 6_500
      const result = executeStatDrivenAttack(state, basic(), TARGET, CONTENT)
      expect(result.events[0]).toMatchObject({
        event: 'stat_driven_attack_resolved',
        hitChanceBasisPoints: 6_500,
        rollBasisPoints: draw.value % 10_000,
        hit,
      })
      expect(result.state.tactical.battle.rng).toEqual(draw.state)
      expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(
        hit ? 80 : 100,
      )
      expect(result.events.some((event) => event.event === 'combat_accuracy_resolved')).toBe(false)
    },
  )
  it.each([1, 7, 19, 53, 101, 997])(
    'uses the same adjusted chance in Skill forecast and commit for seed %s',
    (seed) => {
      const state = apply(world(6_000, 1_000, seed), BLIND.id, 'actor')
      const before = JSON.stringify(state)
      const draw = advanceBattleRng(state.tactical.battle.rng)
      expect(chance(state)).toBe(3_500)
      const result = executeCombatAction(state, attack(), TARGET, CONTENT)
      expect(result.events[0]).toMatchObject({
        event: 'combat_accuracy_resolved',
        hitChanceBasisPoints: 3_500,
        rollBasisPoints: draw.value % 10_000,
        hit: draw.value % 10_000 < 3_500,
      })
      expect(JSON.stringify(state)).toBe(before)
    },
  )
  it('preserves real published historical Mark source-only damage vulnerability', () => {
    const definition = PV1F_COMBAT_CONTENT.statuses.find((status) => status.id === 'marked')
    expect(definition).toBeDefined()
    const content = { statuses: [definition!] }
    const first = apply(world(10_000, 0), 'marked', 'target', content)
    expect(chance(first, content)).toBe(10_000)
    const own = executeCombatAction(
      first,
      { ...attack(), accuracyMode: 'automatic' },
      TARGET,
      content,
    )
    expect(own.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(76)
    const otherTurn = advanceTo(first, 'ally', content)
    const ally = executeCombatAction(
      otherTurn,
      { ...attack(), accuracyMode: 'automatic' },
      TARGET,
      content,
    )
    expect(ally.state.tactical.battle.combatants.find((unit) => unit.id === 'target')?.hp).toBe(80)
  })
})
