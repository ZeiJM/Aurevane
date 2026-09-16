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
import { advanceCurrentBurnEndTurn, currentBurnInstance } from './combat-dots'
import { normalizeCombatEffectState } from './combat-effect-state'
import {
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
} from './combat-kernel-types'
import { validateCombatActionDefinition } from './combat-authoring-validation'

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
const CONTENT: CombatContentCatalog = { statuses: [NEGATIVE] }
const TARGET = { kind: 'unit' as const, combatantId: 'target' }

function world(seed = 103): CombatEncounterState {
  const ids = ['actor', 'target', 'other']
  const battle = startBattle(
    createPendingBattle({
      battleId: 'battle:burn-copy-contract',
      rulesVersion: 2,
      contentVersion: 2,
      rngSeed: seed,
      combatants: ids.map((id, index) => ({
        id,
        teamId: id === 'target' ? 'enemies' : 'players',
        initiative: 30 - index * 10,
        baseMovementBudget: 3,
        hp: 40,
        maxHp: 40,
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

function burnEffect(curseCopyable?: unknown): CombatEffectDefinition {
  return {
    type: 'burn',
    recipient: 'primary-unit',
    ...(curseCopyable !== undefined ? { curseCopyable } : {}),
  } as unknown as CombatEffectDefinition
}

function burnAction(curseCopyable?: unknown, id = 'test.apply-burn'): CombatActionDefinition {
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
    effects: [burnEffect(curseCopyable)],
  }
}

function copyAction(
  accuracyMode: 'automatic' | 'per-target' = 'automatic',
  cost = { spendsAction: false, mp: 0 },
): CombatActionDefinition {
  return {
    id: 'test.curse-burn',
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
    id: 'test.amplify-burn',
    target: { ...copyAction().target, teamPolicy: 'enemy' },
    effects: [{ type: 'copy-statuses', recipient: 'primary-unit', mode: 'amplify' }],
  } as CombatActionDefinition
}

function applyBurn(
  state: CombatEncounterState,
  targetId: string,
  copyable: unknown = true,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  return executeCombatAction(
    state,
    burnAction(copyable, actionId),
    { kind: 'unit', combatantId: targetId },
    CONTENT,
  ).state
}

function withStage(state: CombatEncounterState, targetId: string, stage: number): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      burn: effectState.burn.map((instance) =>
        instance.targetCombatantId === targetId ? { ...instance, stage } : instance,
      ),
    },
  }
}

function burn(
  state: CombatEncounterState,
  targetId = 'actor',
  stage = 0,
  copyable: unknown = true,
  actionId = 'test.apply-burn',
): CombatEncounterState {
  return withStage(applyBurn(state, targetId, copyable, actionId), targetId, stage)
}

function instance(state: CombatEncounterState, targetId = 'actor') {
  const found = currentBurnInstance(state, targetId)
  if (!found) throw new Error(`Missing Burn on ${targetId}`)
  return found
}

function context(
  actionId = 'test.curse-burn',
  actorId = 'actor',
  chainId = 'chain:burn-copy',
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

function cast(
  state: CombatEncounterState,
  ctx?: CombatResolutionContext,
  action = copyAction(),
) {
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

function origin(targetId: string, actionId = 'test.origin-burn') {
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
    effectOrdinal: 0,
    createdRound: 1,
    createdTurn: 1,
  })
}

function withProvenance(state: CombatEncounterState, targetId: string, provenance = origin(targetId)) {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      burn: effectState.burn.map((entry) =>
        entry.targetCombatantId === targetId ? { ...entry, provenance } : entry,
      ),
    },
  }
}

function damageAction(): CombatActionDefinition {
  return {
    id: 'test.burned-attack',
    version: 1,
    sourceType: 'discipline-skill',
    tags: ['attack'],
    target: copyAction().target,
    cost: { spendsAction: false, mp: 0 },
    requirements: [],
    effects: [{ type: 'damage', recipient: 'primary-unit', amount: 3 }],
  }
}

const malformedPolicies = [0, 1, 'true', null, {}, []]

describe('Curse Burn: explicit authored and persisted copy policy', () => {
  it.each([true, false])('accepts explicit authored copy policy %s', (flag) => {
    expect(() => validateCombatActionDefinition(burnAction(flag))).not.toThrow()
    const state = applyBurn(world(), 'actor', flag)
    expect(instance(state).curseCopyable).toBe(flag)
    expect(validateCombatEncounterState(state)).toEqual([])
  })

  it.each(malformedPolicies)('rejects malformed authored copy policy %j', (value) => {
    expect(() => validateCombatActionDefinition(burnAction(value))).toThrow(/curseCopyable/i)
    expect(() => executeCombatAction(world(), burnAction(value), { kind: 'unit', combatantId: 'actor' }, CONTENT)).toThrow(/curseCopyable/i)
  })

  it('keeps historical omitted Burn state valid and non-copyable', () => {
    const state = applyBurn(world(), 'actor', undefined)
    expect(instance(state)).not.toHaveProperty('curseCopyable')
    expect(validateCombatEncounterState(state)).toEqual([])
    expect(evaluateCombatAction(state, copyAction(), TARGET, CONTENT).legal).toBe(false)
  })

  it.each(malformedPolicies)('rejects malformed persisted copy policy %j', (value) => {
    const state = burn(world(), 'actor', 1)
    const effectState = normalizeCombatEffectState(state.effectState)
    const malformed = {
      ...state,
      effectState: {
        ...effectState,
        burn: effectState.burn.map((entry) => ({ ...entry, curseCopyable: value })),
      },
    } as unknown as CombatEncounterState
    expect(validateCombatEncounterState(malformed)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'effectState.burn' })]),
    )
  })

  it('unflagged reapplication removes a previous explicit opt-in and restarts Burn normally', () => {
    const state = burn(world(), 'actor', 2, true)
    const reapplied = applyBurn(state, 'actor', undefined, 'test.reapply-unflagged')
    expect(instance(reapplied)).toMatchObject({ stage: 0, sourceActionId: 'test.reapply-unflagged' })
    expect(instance(reapplied)).not.toHaveProperty('curseCopyable')
    expect(evaluateCombatAction(reapplied, copyAction(), TARGET, CONTENT).legal).toBe(false)
  })
})

describe('Curse Burn: current stage and replacement semantics', () => {
  it.each([0, 1, 2])('copies donor stage %s to an unburned target', (stage) => {
    const state = burn(world(), 'actor', stage)
    const before = JSON.stringify(state)
    const result = cast(state)
    expect(instance(result.state, 'target')).toMatchObject({
      stage,
      sourceCombatantId: 'actor',
      sourceActionId: 'test.curse-burn',
      curseCopyable: true,
    })
    expect(instance(result.state)).toEqual(instance(state))
    expect(JSON.stringify(state)).toBe(before)
  })

  it.each([0, 1, 2])('restarts an already-burning target at stage zero when donor is stage %s', (stage) => {
    const state = burn(burn(world(), 'actor', stage), 'target', 2, false, 'test.existing-target-burn')
    const old = instance(state, 'target')
    const result = cast(state)
    expect(instance(result.state, 'target')).toMatchObject({
      stage: 0,
      sourceCombatantId: 'actor',
      sourceActionId: 'test.curse-burn',
      curseCopyable: true,
    })
    expect(instance(result.state, 'target')).not.toEqual(old)
    expect(instance(result.state)).toEqual(instance(state))
  })

  it.each([
    [0, 4, 1],
    [1, 3, 2],
    [2, 2, null],
  ] as const)('copied stage %s deals %s on its next target end-turn and advances to %s', (stage, damage, nextStage) => {
    let state = cast(burn(world(), 'actor', stage)).state
    state = advanceTo(state, 'target')
    const hpBefore = state.tactical.battle.combatants.find((unit) => unit.id === 'target')!.hp
    const transition = advanceCurrentBurnEndTurn(state, 'target')
    expect(transition.damage).toBe(damage)
    expect(transition.state.tactical.battle.combatants.find((unit) => unit.id === 'target')!.hp).toBe(hpBefore)
    const next = currentBurnInstance(transition.state, 'target')
    expect(nextStage === null ? next : next?.stage).toBe(nextStage)
  })

  it('copying Burn causes no immediate Burn damage or backlash', () => {
    const state = burn(world(), 'actor', 1)
    const before = state.tactical.battle.combatants.map((unit) => ({ id: unit.id, hp: unit.hp }))
    const result = cast(state)
    expect(result.state.tactical.battle.combatants.map((unit) => ({ id: unit.id, hp: unit.hp }))).toEqual(before)
    expect(result.events.filter((event) => event.event === 'damage_applied')).toEqual([])
  })

  it('a copied Burn later triggers the normal one-time damaging-command backlash', () => {
    const copied = cast(burn(world(), 'actor', 1)).state
    const targetTurn = advanceTo(copied, 'target')
    const result = executeCombatAction(
      targetTurn,
      damageAction(),
      { kind: 'unit', combatantId: 'actor' },
      CONTENT,
    )
    const target = result.state.tactical.battle.combatants.find((unit) => unit.id === 'target')
    expect(target?.hp).toBe(38)
    expect(
      result.events.filter(
        (event) =>
          event.event === 'damage_applied' &&
          event.sourceCombatantId === 'target' &&
          event.targetCombatantId === 'target',
      ),
    ).toHaveLength(1)
  })

  it('Cleanse removes copied Burn using existing removal behavior', () => {
    const copied = cast(burn(world(), 'actor')).state
    const action: CombatActionDefinition = {
      ...burnAction(),
      id: 'test.cleanse-burn',
      effects: [{ type: 'remove-status', recipient: 'primary-unit', statusIds: ['burn'] }],
    }
    const targetTurn = advanceTo(copied, 'target')
    const cleared = executeCombatAction(targetTurn, action, { kind: 'unit', combatantId: 'target' }, CONTENT)
    expect(currentBurnInstance(cleared.state, 'target')).toBeNull()
  })
})

describe('Curse Burn: legality, accuracy and immutability', () => {
  it.each([undefined, false])('does not treat donor policy %s as eligible', (flag) => {
    const state = burn(world(), 'actor', 1, flag)
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, copyAction(), TARGET, CONTENT)
    expect(preview.legal).toBe(false)
    expect(() => cast(state)).toThrow(/eligible active statuses/i)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('Amplify never copies current Burn', () => {
    const state = burn(world(), 'target', 1, true)
    expect(evaluateCombatAction(state, amplifyAction(), TARGET, CONTENT).legal).toBe(false)
    expect(() => executeCombatAction(state, amplifyAction(), TARGET, CONTENT)).toThrow()
  })

  it('a hostile miss spends ordinary MP but does not copy or reattribute Burn', () => {
    const state = burn(world(1), 'actor', 2, true)
    const action = copyAction('per-target', { spendsAction: false, mp: 3 })
    const draw = advanceBattleRng(state.tactical.battle.rng)
    const result = executeCombatAction(state, action, TARGET, CONTENT)
    expect(result.events).toContainEqual(expect.objectContaining({ event: 'combat_accuracy_resolved', hit: false }))
    expect(currentBurnInstance(result.state, 'target')).toBeNull()
    expect(instance(result.state)).toEqual(instance(state))
    expect(result.state.tactical.battle.combatants.find((unit) => unit.id === 'actor')?.mp).toBe(17)
    expect(result.state.tactical.battle.rng).toEqual(draw.state)
  })

  it('Automatic Hit copy does not consume RNG', () => {
    const state = burn(world(), 'actor', 1)
    const result = cast(state)
    expect(result.state.tactical.battle.rng).toEqual(state.tactical.battle.rng)
  })

  it('forecasting Burn copy is RNG-pure and does not mutate state', () => {
    const state = burn(world(), 'actor', 2)
    const before = JSON.stringify(state)
    const preview = evaluateCombatAction(state, copyAction(), TARGET, CONTENT)
    expect(preview.legal).toBe(true)
    expect(preview.projectedEffects).toContainEqual(
      expect.objectContaining({ effectType: 'copy-statuses', combatantId: 'target', after: 'burn:2' }),
    )
    expect(JSON.stringify(state)).toBe(before)
  })

  it('status-only copying preserves the exact typed effectState reference', () => {
    const state = burn(world(), 'other', 1, false)
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
    expect(instance(result.state, 'other')).toBe(instance(withStatus, 'other'))
  })
})

describe('Curse Burn: K3 lineage and copy ordering', () => {
  it('links a copied Burn to its immediate donor', () => {
    const donor = withProvenance(burn(world(), 'actor', 1), 'actor')
    const source = instance(donor).provenance
    const result = cast(donor, context())
    expect(instance(result.state, 'target').provenance).toMatchObject({
      copyOrdinal: 0,
      copiedFromInstanceId: source?.instanceId,
      action: { actionDefinitionId: 'test.curse-burn', sourceCombatantId: 'actor' },
    })
  })

  it('records a replaced receiver Burn as inherited lineage', () => {
    const donor = withProvenance(burn(world(), 'actor', 1), 'actor', origin('actor', 'test.donor'))
    const both = withProvenance(
      burn(donor, 'target', 2, false, 'test.receiver'),
      'target',
      origin('target', 'test.receiver'),
    )
    const previous = instance(both, 'target').provenance
    const result = cast(both, context())
    expect(instance(result.state, 'target').provenance).toMatchObject({
      copiedFromInstanceId: instance(both).provenance?.instanceId,
      inheritedFromInstanceId: previous?.instanceId,
    })
  })

  it('does not invent lineage without K3 context', () => {
    const state = withProvenance(burn(world(), 'actor', 1), 'actor')
    const result = cast(state)
    expect(instance(result.state, 'target')).not.toHaveProperty('provenance')
  })

  it('a copy of a copy links to the immediate copied Burn', () => {
    const first = cast(withProvenance(burn(world(), 'actor', 1), 'actor'), context()).state
    const firstCopy = instance(first, 'target')
    const targetTurn = advanceTo(first, 'target')
    const reverseAction = { ...copyAction(), id: 'test.reverse-curse' }
    const result = executeCombatAction(
      targetTurn,
      reverseAction,
      { kind: 'unit', combatantId: 'actor' },
      CONTENT,
      context('test.reverse-curse', 'target', 'chain:reverse-burn'),
    )
    expect(instance(result.state, 'actor').provenance?.copiedFromInstanceId).toBe(
      firstCopy.provenance?.instanceId,
    )
  })

  it('assigns Burn after ordinary status and Poison copy ordinals', () => {
    const poisonedBurned = burn(world(), 'actor', 1)
    const poisonAction: CombatActionDefinition = {
      ...burnAction(),
      id: 'test.poison-donor',
      effects: [
        {
          type: 'poison',
          recipient: 'primary-unit',
          curseCopyable: true,
        } as unknown as CombatEffectDefinition,
      ],
    }
    const poisoned = executeCombatAction(
      poisonedBurned,
      poisonAction,
      { kind: 'unit', combatantId: 'actor' },
      CONTENT,
      context('test.poison-donor'),
    ).state
    const state: CombatEncounterState = {
      ...poisoned,
      statusState: poisoned.statusState.map((row) =>
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
                  provenance: origin('actor', 'test.negative-origin'),
                },
              ],
            }
          : row,
      ),
    }
    const result = cast(state, context())
    const status = result.state.statusState.find((row) => row.combatantId === 'target')?.statuses[0]
    const poison = normalizeCombatEffectState(result.state.effectState).poison.find(
      (entry) => entry.targetCombatantId === 'target',
    )
    expect(status?.provenance?.copyOrdinal).toBe(0)
    expect(poison?.provenance?.copyOrdinal).toBe(1)
    expect(instance(result.state, 'target').provenance?.copyOrdinal).toBe(2)
    expect(new Set([status?.provenance?.instanceId, poison?.provenance?.instanceId, instance(result.state, 'target').provenance?.instanceId]).size).toBe(3)
  })

  it('round-trips copied Burn provenance and stage through JSON', () => {
    const result = cast(withProvenance(burn(world(), 'actor', 2), 'actor'), context()).state
    const restored = JSON.parse(JSON.stringify(result)) as CombatEncounterState
    expect(validateCombatEncounterState(restored)).toEqual([])
    expect(instance(restored, 'target')).toEqual(instance(result, 'target'))
  })
})
