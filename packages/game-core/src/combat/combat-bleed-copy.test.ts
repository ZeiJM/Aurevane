import { describe, expect, it } from 'vitest'
import {
  createCombatEncounterState,
  endCombatTurn,
  evaluateCombatAction,
  executeCombatAction,
  validateCombatEncounterState,
  type CombatActionDefinition,
  type CombatContentCatalog,
  type CombatEffectDefinition,
  type CombatEncounterState,
  type CombatResolutionContext,
  type CombatStatusDefinition,
} from './actions'
import { advanceBattleRng, createPendingBattle, startBattle } from './battle-state'
import { createTacticalBattleState, selectCurrentFinalFacing } from './board'
import {
  advanceCurrentBleedEndTurn,
  applyCurrentBurnState,
  applyCurrentPoisonState,
  currentBleedStacks,
} from './combat-dots'
import { normalizeCombatEffectState } from './combat-effect-state'
import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
} from './combat-kernel-types'
import { validateCombatActionDefinition } from './combat-authoring-validation'
import { createStatDrivenCombatEncounterState } from './stat-driven-combat'

const NEGATIVE: CombatStatusDefinition = {
  id: 'test.copyable-negative',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 3,
  damageTakenMultiplierBasisPoints: 10_000,
  polarity: 'negative',
  reactionClass: 'ordinary',
  curseCopyable: true,
}
const BLEED_REMOVAL_STATUS: CombatStatusDefinition = {
  id: 'bleed',
  version: 1,
  maximumStacks: 1,
  durationOwnerTurnStarts: 1,
  damageTakenMultiplierBasisPoints: 10_000,
}
const CONTENT: CombatContentCatalog = { statuses: [NEGATIVE] }
const TARGET = { kind: 'unit' as const, combatantId: 'target' }

type BleedWithCopyPolicy = ReturnType<typeof currentBleedStacks>[number] & {
  curseCopyable?: boolean
}

function world(seed = 211): CombatEncounterState {
  const ids = ['actor', 'target', 'other']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:bleed-copy-contract',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: seed,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'target' ? 'enemies' : 'players',
        initiative: 30 - index * 10,
        baseMovementBudget: 3,
        hp: 50,
        maxHp: 50,
        mp: 20,
        maxMp: 30,
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
  )
}

function bleedEffect(
  damagePerTick: number,
  ticks: number,
  curseCopyable?: unknown,
): CombatEffectDefinition {
  return {
    type: 'bleed',
    recipient: 'primary-unit',
    damagePerTick,
    ticks,
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  } as unknown as CombatEffectDefinition
}

function bleedAction(
  damagePerTick: number,
  ticks: number,
  curseCopyable?: unknown,
  id = 'test.apply-bleed',
): CombatActionDefinition {
  return {
    id,
    version: 1,
    sourceType: 'test',
    tags: [],
    target: {
      kind: 'unit',
      teamPolicy: 'any',
      shape: { kind: 'single' },
      minimumRange: 0,
      maximumRange: 3,
      requiresLineOfSight: false,
      maximumElevationDifference: 0,
      friendlyFire: 'all-units',
    },
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [bleedEffect(damagePerTick, ticks, curseCopyable)],
  }
}

function copyAction(
  accuracyMode: 'automatic' | 'per-target' = 'automatic',
  cost = { spendsAction: false, mp: 0 },
): CombatActionDefinition {
  return {
    id: 'test.curse-bleed',
    version: 1,
    sourceType: 'test',
    tags: [],
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
    cost,
    requirements: [],
    accuracyMode,
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'curse' }],
  } as CombatActionDefinition
}

function amplifyAction(): CombatActionDefinition {
  return {
    ...copyAction(),
    id: 'test.amplify-bleed',
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' }],
  } as CombatActionDefinition
}

function applyBleed(
  state: CombatEncounterState,
  targetId: string,
  damagePerTick: number,
  ticks: number,
  copyable?: unknown,
  actionId = 'test.apply-bleed',
): CombatEncounterState {
  const authoredCopyable = arguments.length >= 5 ? copyable : true
  return executeCombatAction(
    state,
    bleedAction(damagePerTick, ticks, authoredCopyable, actionId),
    { kind: 'unit', combatantId: targetId },
    CONTENT,
  ).state
}

function stacks(state: CombatEncounterState, targetId = 'actor') {
  return currentBleedStacks(state, targetId)
}

function context(
  actionId = 'test.curse-bleed',
  actorId = 'actor',
  chainId = 'chain:bleed-copy',
): CombatResolutionContext {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'discipline-skill',
      actionDefinitionId: actionId,
      actionVersion: 1,
      sourceCombatantId: actorId,
      controllerCombatantId: actorId,
      triggerChainId: chainId,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: chainId }),
  }
}

function cast(state: CombatEncounterState, ctx?: CombatResolutionContext, action = copyAction()) {
  return executeCombatAction(state, action, TARGET, CONTENT, ctx)
}

function finishTurn(state: CombatEncounterState, content = CONTENT): CombatEncounterState {
  const faced = selectCurrentFinalFacing(state.tactical, 'east')
  return endCombatTurn({ ...state, tactical: faced.state }, content).state
}

function advanceTo(state: CombatEncounterState, actorId: string, content = CONTENT) {
  let next = state
  for (let index = 0; index < 10; index += 1) {
    if (next.tactical.battle.currentTurn?.combatantId === actorId) return next
    next = finishTurn(next, content)
  }
  throw new Error(`Did not reach ${actorId}`)
}

function origin(targetId: string, actionId: string, ordinal = 0) {
  const action = createCombatActionProvenance({
    rulesetVersion: 2,
    sourceKind: 'discipline-skill',
    actionDefinitionId: actionId,
    actionVersion: 1,
    sourceCombatantId: 'actor',
    controllerCombatantId: 'actor',
    triggerChainId: `chain:${actionId}`,
  })
  return createCombatEffectInstanceProvenance({
    action,
    targetCombatantId: targetId,
    effectOrdinal: ordinal,
    createdRound: 1,
    createdTurn: 1,
  })
}

function withStackProvenance(
  state: CombatEncounterState,
  targetId: string,
  applicationOrder: number,
  actionId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      bleed: effectState.bleed.map((stack) =>
        stack.targetCombatantId === targetId && stack.applicationOrder === applicationOrder
          ? { ...stack, provenance: origin(targetId, actionId) }
          : stack,
      ),
    },
  }
}

function withAccuracyProfiles(state: CombatEncounterState): CombatEncounterState {
  return createStatDrivenCombatEncounterState(
    state,
    state.tactical.battle.combatants.map((unit) => ({
      combatantId: unit.id,
      provenance: {
        kind: 'scenario' as const,
        sourceId: `scenario:${unit.id}`,
        sourceRulesVersion: 2,
      },
      accuracy: unit.id === 'actor' ? 0 : 5_000,
      evasion: unit.id === 'target' ? 10_000 : 0,
      armor: 0,
      ward: 0,
      jump: 0,
      physicalPower: 30,
      mysticPower: 30,
    })),
  )
}

function seedDonorThree(state = world()): CombatEncounterState {
  let next = applyBleed(state, 'actor', 3, 3, true, 'test.donor-a')
  next = applyBleed(next, 'actor', 5, 1, true, 'test.donor-b')
  return applyBleed(next, 'actor', 2, 4, true, 'test.donor-c')
}

function seedReceiverThree(state: CombatEncounterState): CombatEncounterState {
  let next = applyBleed(state, 'target', 2, 1, false, 'test.receiver-short')
  next = applyBleed(next, 'target', 2, 2, false, 'test.receiver-mid')
  return applyBleed(next, 'target', 2, 4, false, 'test.receiver-long')
}

function copiedStacks(state: CombatEncounterState) {
  return stacks(state, 'target').filter((stack) => stack.sourceActionId === 'test.curse-bleed')
}

const malformedPolicies = [0, 1, 'true', null, {}, []]

describe('Curse Bleed: explicit authored and persisted copy policy', () => {
  it.each([true, false])('accepts explicit authored copy policy %s', (flag) => {
    expect(() => validateCombatActionDefinition(bleedAction(2, 4, flag))).not.toThrow()
    const state = applyBleed(world(), 'actor', 2, 4, flag)
    expect((stacks(state)[0] as BleedWithCopyPolicy).curseCopyable).toBe(flag)
    expect(validateCombatEncounterState(state)).toEqual([])
  })

  it.each(malformedPolicies)('rejects malformed authored copy policy %j', (value) => {
    expect(() => validateCombatActionDefinition(bleedAction(2, 4, value))).toThrow(/curseCopyable/i)
    expect(() =>
      executeCombatAction(
        world(),
        bleedAction(2, 4, value),
        { kind: 'unit', combatantId: 'actor' },
        CONTENT,
      ),
    ).toThrow(/curseCopyable/i)
  })

  it('keeps historical omitted Bleed state valid and non-copyable', () => {
    const state = applyBleed(world(), 'actor', 2, 4, undefined)
    expect(stacks(state)[0]).not.toHaveProperty('curseCopyable')
    expect(validateCombatEncounterState(state)).toEqual([])
    expect(evaluateCombatAction(state, copyAction(), TARGET, CONTENT).legal).toBe(false)
  })

  it.each(malformedPolicies)('rejects malformed persisted copy policy %j', (value) => {
    const state = applyBleed(world(), 'actor', 2, 4, true)
    const effectState = normalizeCombatEffectState(state.effectState)
    const malformed = {
      ...state,
      effectState: {
        ...effectState,
        bleed: effectState.bleed.map((stack) => ({ ...stack, curseCopyable: value })),
      },
    } as unknown as CombatEncounterState
    expect(validateCombatEncounterState(malformed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'effectState.bleed' })]),
    )
  })

  it('an unflagged new Bleed stack does not become Curse-copyable', () => {
    let state = applyBleed(world(), 'actor', 2, 4, true, 'test.flagged')
    state = applyBleed(state, 'actor', 3, 3, undefined, 'test.unflagged')
    const rows = stacks(state) as readonly BleedWithCopyPolicy[]
    expect(rows[0]?.curseCopyable).toBe(true)
    expect(rows[1]).not.toHaveProperty('curseCopyable')
  })
})

describe('Curse Bleed: stable donor state and receiver cap semantics', () => {
  it('copies all eligible donor stacks in stable application order to an empty receiver', () => {
    const state = seedDonorThree()
    const donorBefore = stacks(state).map((stack) => ({ ...stack }))
    const hpBefore = state.tactical.battle.combatants.find((unit) => unit.id === 'target')!.hp
    const result = cast(state)
    const copied = copiedStacks(result.state)
    expect(copied).toHaveLength(3)
    expect(copied.map((stack) => [stack.damagePerTick, stack.remainingTicks])).toEqual([
      [3, 3],
      [5, 1],
      [2, 4],
    ])
    expect(copied.map((stack) => stack.applicationOrder)).toEqual([4, 5, 6])
    expect(copied).toEqual(
      copied.map(() =>
        expect.objectContaining({
          targetCombatantId: 'target',
          sourceCombatantId: 'actor',
          sourceActionId: 'test.curse-bleed',
          curseCopyable: true,
        }),
      ),
    )
    expect(stacks(result.state).map((stack) => ({ ...stack }))).toEqual(donorBefore)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')!.hp).toBe(
      hpBefore,
    )
    expect(result.events.filter((event) => event.event === 'damage_applied')).toEqual([])
  })

  it.each([1, 2])('fills a receiver starting with %s stack(s) without exceeding three', (count) => {
    let state = applyBleed(world(), 'actor', 3, 2, true, 'test.donor-single')
    for (let index = 0; index < count; index += 1) {
      state = applyBleed(state, 'target', 2, index + 2, false, `test.receiver-${index}`)
    }
    const result = cast(state)
    expect(stacks(result.state, 'target')).toHaveLength(count + 1)
    expect(copiedStacks(result.state)).toHaveLength(1)
  })

  it('applies each donor sequentially through the existing three-stack replacement rule', () => {
    const state = seedReceiverThree(seedDonorThree())
    const result = cast(state)
    const final = stacks(result.state, 'target')
    expect(final).toHaveLength(3)
    expect(
      final.map((stack) => [stack.damagePerTick, stack.remainingTicks, stack.applicationOrder]),
    ).toEqual([
      [2, 4, 6],
      [3, 3, 7],
      [2, 4, 9],
    ])
    expect(copiedStacks(result.state).map((stack) => stack.applicationOrder)).toEqual([7, 9])
    expect(final.some((stack) => stack.applicationOrder === 8)).toBe(false)
  })

  it('breaks receiver replacement ties by oldest application order during copy', () => {
    let state = applyBleed(world(), 'actor', 3, 3, true, 'test.donor')
    state = applyBleed(state, 'target', 2, 2, false, 'test.oldest-two')
    state = applyBleed(state, 'target', 3, 2, false, 'test.newer-two')
    state = applyBleed(state, 'target', 2, 4, false, 'test.four')
    const result = cast(state)
    expect(stacks(result.state, 'target').map((stack) => stack.sourceActionId)).toEqual([
      'test.newer-two',
      'test.four',
      'test.curse-bleed',
    ])
  })

  it('copied stacks continue the normal independent Bleed timer afterward', () => {
    const copied = cast(applyBleed(world(), 'actor', 4, 2, true)).state
    const transition = advanceCurrentBleedEndTurn(copied, 'target')
    expect(transition.stacks).toEqual([
      expect.objectContaining({ damagePerTick: 4, remainingTicks: 2 }),
    ])
    expect(stacks(transition.state, 'target')).toEqual([
      expect.objectContaining({ damagePerTick: 4, remainingTicks: 1 }),
    ])
  })

  it('Cleanse removes all copied Bleed stacks using existing removal behavior', () => {
    const copied = cast(seedDonorThree()).state
    const action: CombatActionDefinition = {
      ...bleedAction(2, 2, false),
      id: 'test.cleanse-bleed',
      effects: [{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['bleed'] }],
    }
    const targetTurn = advanceTo(copied, 'target')
    const result = executeCombatAction(targetTurn, action, TARGET, {
      statuses: [...CONTENT.statuses, BLEED_REMOVAL_STATUS],
    })
    expect(stacks(result.state, 'target')).toEqual([])
  })
})

describe('Curse Bleed: legality, accuracy and immutability', () => {
  it.each([undefined, false])('does not treat donor policy %s as eligible', (flag) => {
    const state = applyBleed(world(), 'actor', 2, 4, flag)
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, copyAction(), TARGET, CONTENT)
    expect(preview.legal).toBe(false)
    expect(() => cast(state)).toThrow(/eligible active statuses/i)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('Amplify never copies current Bleed', () => {
    const state = applyBleed(world(), 'target', 2, 4, true)
    expect(evaluateCombatAction(state, amplifyAction(), TARGET, CONTENT).legal).toBe(false)
    expect(() => executeCombatAction(state, amplifyAction(), TARGET, CONTENT)).toThrow()
  })

  it('a hostile miss spends ordinary MP but does not copy or reattribute Bleed', () => {
    const state = applyBleed(withAccuracyProfiles(world(1)), 'actor', 2, 4, true)
    const action = copyAction('per-target', { spendsAction: false, mp: 3 })
    const donorBefore = stacks(state).map((stack) => ({ ...stack }))
    const draw = advanceBattleRng(state.tactical.battle.rng)
    const result = executeCombatAction(state, action, TARGET, CONTENT)
    expect(result.events).toContainEqual(
      expect.objectContaining({ event: 'combat_accuracy_resolved', hit: false }),
    )
    expect(stacks(result.state, 'target')).toEqual([])
    expect(stacks(result.state).map((stack) => ({ ...stack }))).toEqual(donorBefore)
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(17)
    expect(result.state.tactical.battle.rng).toEqual(draw.state)
  })

  it('Automatic Hit copy does not consume RNG', () => {
    const state = applyBleed(world(), 'actor', 2, 4, true)
    const result = cast(state)
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })

  it('forecasting Bleed copy is RNG-pure and does not mutate state', () => {
    const state = applyBleed(world(), 'actor', 3, 2, true)
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, copyAction(), TARGET, CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.projectedEffects).toContainEqual(
      expect.objectContaining({
        effectType: 'copy-statuses',
        combatantId: 'target',
        after: 'bleed:3:2',
      }),
    )
    expect(JSON.stringify(state)).toBe(before)
  })

  it('status-only copying preserves the exact typed effectState reference', () => {
    const state = applyBleed(world(), 'other', 2, 4, false)
    const withStatus: CombatEncounterState = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: NEGATIVE.id,
                  statusVersion: NEGATIVE.version,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'other',
                },
              ],
            }
          : row,
      ),
    }
    const result = cast(withStatus)
    expect(result.state.effectState).toBe(withStatus.effectState)
    expect(stacks(result.state, 'other')[0]).toBe(stacks(withStatus, 'other')[0])
  })
})

describe('Curse Bleed: K3 lineage and copy ordering', () => {
  it('links a copied Bleed stack to its immediate donor', () => {
    let state = applyBleed(world(), 'actor', 3, 2, true, 'test.donor')
    state = withStackProvenance(state, 'actor', stacks(state)[0]!.applicationOrder, 'test.donor')
    const donor = stacks(state)[0]!
    const result = cast(state, context())
    expect(copiedStacks(result.state)[0]?.provenance).toMatchObject({
      copyOrdinal: 0,
      copiedFromInstanceId: donor.provenance?.instanceId,
      action: { actionDefinitionId: 'test.curse-bleed', sourceCombatantId: 'actor' },
    })
  })

  it('records a replaced pre-existing receiver stack as inherited lineage', () => {
    let state = applyBleed(world(), 'actor', 3, 3, true, 'test.donor')
    state = applyBleed(state, 'target', 2, 1, false, 'test.receiver-short')
    state = applyBleed(state, 'target', 2, 3, false, 'test.receiver-mid')
    state = applyBleed(state, 'target', 2, 4, false, 'test.receiver-long')
    const replacedOrder = stacks(state, 'target')[0]!.applicationOrder
    state = withStackProvenance(state, 'target', replacedOrder, 'test.receiver-short')
    const previous = stacks(state, 'target')[0]!.provenance
    const result = cast(state, context())
    expect(copiedStacks(result.state)[0]?.provenance?.inheritedFromInstanceId).toBe(
      previous?.instanceId,
    )
  })

  it('does not invent lineage without K3 context', () => {
    let state = applyBleed(world(), 'actor', 3, 2, true)
    state = withStackProvenance(state, 'actor', stacks(state)[0]!.applicationOrder, 'test.donor')
    const result = cast(state)
    expect(copiedStacks(result.state)[0]).not.toHaveProperty('provenance')
  })

  it('a copy of a copy links to the immediate copied Bleed stack', () => {
    let state = applyBleed(world(), 'actor', 3, 2, true)
    state = withStackProvenance(state, 'actor', stacks(state)[0]!.applicationOrder, 'test.origin')
    const first = cast(state, context()).state
    const firstCopy = copiedStacks(first)[0]!
    const targetTurn = advanceTo(first, 'target')
    const reverseAction = { ...copyAction(), id: 'test.reverse-curse' }
    const result = executeCombatAction(
      targetTurn,
      reverseAction,
      { kind: 'unit', combatantId: 'actor' },
      CONTENT,
      context('test.reverse-curse', 'target', 'chain:reverse-bleed'),
    )
    const reverseCopy = stacks(result.state, 'actor').find(
      (stack) => stack.sourceActionId === 'test.reverse-curse',
    )
    expect(reverseCopy?.provenance?.copiedFromInstanceId).toBe(firstCopy.provenance?.instanceId)
  })

  it('assigns Bleed ordinals after ordinary status, Poison and Burn copies', () => {
    let state = applyBleed(world(), 'actor', 3, 2, true, 'test.bleed-one')
    state = applyBleed(state, 'actor', 2, 4, true, 'test.bleed-two')
    state = applyCurrentPoisonState(state, 'actor', 'actor', 'test.poison', true)
    state = applyCurrentBurnState(state, 'actor', 'actor', 'test.burn', true)
    state = {
      ...state,
      statusState: state.statusState.map((row) =>
        row.combatantId === 'actor'
          ? {
              ...row,
              statuses: [
                {
                  statusId: NEGATIVE.id,
                  statusVersion: NEGATIVE.version,
                  stacks: 1,
                  remainingOwnerTurnStarts: 2,
                  sourceCombatantId: 'other',
                },
              ],
            }
          : row,
      ),
    }
    const result = cast(state, context())
    const targetStatus = result.state.statusState.find((row) => row.combatantId === 'target')
    expect(targetStatus?.statuses[0]?.provenance?.copyOrdinal).toBe(0)
    expect(
      result.state.effectState?.poison.find((row) => row.targetCombatantId === 'target')?.provenance
        ?.copyOrdinal,
    ).toBe(1)
    expect(
      result.state.effectState?.burn.find((row) => row.targetCombatantId === 'target')?.provenance
        ?.copyOrdinal,
    ).toBe(2)
    expect(copiedStacks(result.state).map((stack) => stack.provenance?.copyOrdinal)).toEqual([3, 4])
  })

  it('reserves donor-order ordinals even when a same-command Bleed copy is later replaced', () => {
    const state = seedReceiverThree(seedDonorThree())
    const result = cast(state, context())
    const copied = copiedStacks(result.state)
    expect(copied.map((stack) => stack.provenance?.copyOrdinal)).toEqual([0, 2])
    expect(copied[1]?.provenance).not.toHaveProperty('inheritedFromInstanceId')
  })

  it('round-trips final copied Bleed provenance and timers through JSON', () => {
    let state = applyBleed(world(), 'actor', 3, 2, true)
    state = withStackProvenance(state, 'actor', stacks(state)[0]!.applicationOrder, 'test.origin')
    const result = cast(state, context()).state
    const restored = JSON.parse(JSON.stringify(result)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    expect(copiedStacks(restored)).toEqual(copiedStacks(result))
  })
})
