import { describe, expect, it } from 'vitest'
import type { CombatActionDefinition, CombatEncounterState } from './actions'
import type { CombatActionEvaluation } from './actions-legacy'
import {
  applyCurrentPoisonState,
  applyCurrentBurnState,
  removeCurrentPoisonState,
} from './combat-dots'
import { normalizeCombatEffectState } from './combat-effect-state'
import { attachCombatEffectProvenance } from './combat-effect-provenance'
import { grantBarrier } from './combat-barrier'
import { applyCombatStatusCopies } from './combat-status-copy'
import { replaceRecoverySchedule } from './combat-recovery'
import { createCombatActionProvenance, createCombatTriggerGuard } from './combat-kernel-types'

const DOT_ACTION = {
  id: 'same-action',
  effects: [
    { type: 'poison', recipient: 'primary-unit' },
    { type: 'burn', recipient: 'primary-unit' },
    { type: 'healing', recipient: 'primary-unit', amount: 2, ticks: 3 },
  ],
} as unknown as CombatActionDefinition
const EVALUATION = {
  actorId: 'actor',
  primaryCombatantId: 'target',
  affectedCombatantIds: ['target'],
} as unknown as CombatActionEvaluation
function world(current = true) {
  return {
    ...(current ? { effectStackingPolicyVersion: 1 } : {}),
    tactical: {
      battle: {
        round: 1,
        turnNumber: 1,
        combatants: [
          { id: 'actor', hp: 100 },
          { id: 'target', hp: 100 },
        ],
      },
    },
    statusState: [],
    effectState: normalizeCombatEffectState(undefined),
  } as unknown as CombatEncounterState
}
function context(chain: string) {
  return {
    provenance: createCombatActionProvenance({
      rulesetVersion: 2,
      sourceKind: 'test',
      actionDefinitionId: DOT_ACTION.id,
      actionVersion: 1,
      sourceCombatantId: 'actor',
      controllerCombatantId: 'actor',
      triggerChainId: chain,
    }),
    triggerGuard: createCombatTriggerGuard({ triggerChainId: chain }),
  }
}
function apply(state: CombatEncounterState) {
  state = applyCurrentPoisonState(state, 'actor', 'target', DOT_ACTION.id)
  state = applyCurrentBurnState(state, 'actor', 'target', DOT_ACTION.id)
  return replaceRecoverySchedule(state, {
    kind: 'hp',
    sourceCombatantId: 'actor',
    targetCombatantId: 'target',
    sourceActionId: DOT_ACTION.id,
    amountPerTick: 2,
    remainingFutureTicks: 2,
  })
}

describe('independent application K3 identity', () => {
  it('preserves each prior application lineage when repeating the same source action', () => {
    const initial = world()
    const first = attachCombatEffectProvenance(
      initial,
      apply(initial),
      DOT_ACTION,
      EVALUATION,
      context('first'),
    )
    const firstEffects = first.effectState!
    const repeated = attachCombatEffectProvenance(
      first,
      apply(first),
      DOT_ACTION,
      EVALUATION,
      context('second'),
    )
    for (const kind of ['poison', 'burn', 'ongoingRecovery'] as const) {
      expect(repeated.effectState![kind][0]!.provenance).toEqual(firstEffects[kind][0]!.provenance)
      expect(repeated.effectState![kind][1]!.provenance?.action.triggerChainId).toBe('second')
      expect(repeated.effectState![kind][1]!.provenance?.instanceId).not.toBe(
        firstEffects[kind][0]!.provenance?.instanceId,
      )
    }
  })

  it('assigns multiple same-type effects to their distinct authored ordinals', () => {
    const before = world()
    let after = apply(before)
    after = applyCurrentPoisonState(after, 'actor', 'target', DOT_ACTION.id, false, 7, 3)
    after = applyCurrentBurnState(after, 'actor', 'target', DOT_ACTION.id, false, 9, 3)
    after = replaceRecoverySchedule(after, {
      kind: 'hp',
      sourceCombatantId: 'actor',
      targetCombatantId: 'target',
      sourceActionId: DOT_ACTION.id,
      amountPerTick: 11,
      remainingFutureTicks: 1,
    })
    const action = { ...DOT_ACTION, effects: [...DOT_ACTION.effects, ...DOT_ACTION.effects] }
    const result = attachCombatEffectProvenance(before, after, action, EVALUATION, context('multi'))
    expect(result.effectState!.poison.map((row) => row.provenance?.effectOrdinal)).toEqual([0, 3])
    expect(result.effectState!.burn.map((row) => row.provenance?.effectOrdinal)).toEqual([1, 4])
    expect(result.effectState!.ongoingRecovery.map((row) => row.provenance?.effectOrdinal)).toEqual(
      [2, 5],
    )
  })

  it('handles order reuse after cleanse and excludes applications removed by later cleanse', () => {
    const initial = world()
    const before = attachCombatEffectProvenance(
      initial,
      apply(initial),
      DOT_ACTION,
      EVALUATION,
      context('first'),
    )
    let after = removeCurrentPoisonState(before, 'target')
    after = applyCurrentPoisonState(after, 'actor', 'target', DOT_ACTION.id)
    const action = {
      ...DOT_ACTION,
      effects: [
        { type: 'poison' as const, recipient: 'primary-unit' as const },
        {
          type: 'remove-status' as const,
          recipient: 'primary-unit' as const,
          statusIds: ['poison'],
        },
        { type: 'poison' as const, recipient: 'primary-unit' as const },
      ],
    }
    const result = attachCombatEffectProvenance(
      before,
      after,
      action,
      EVALUATION,
      context('cleansed'),
    )
    expect(result.effectState!.poison[0]!.provenance?.effectOrdinal).toBe(2)
    expect(result.effectState!.poison[0]!.provenance?.action.triggerChainId).toBe('cleansed')
  })

  it('keeps copied application identity when a composed Curse adds new applications afterward', () => {
    let before = applyCurrentPoisonState(world(), 'actor', 'actor', 'donor', true)
    before = applyCurrentBurnState(before, 'actor', 'actor', 'donor', true)
    const effect = {
      type: 'copy-statuses' as const,
      recipient: 'primary-unit' as const,
      mode: 'curse' as const,
    }
    let after = applyCombatStatusCopies(before, 'actor', 'target', DOT_ACTION.id, effect, {
      statuses: [],
    }).state
    after = applyCurrentPoisonState(after, 'actor', 'target', DOT_ACTION.id)
    after = applyCurrentBurnState(after, 'actor', 'target', DOT_ACTION.id)
    const action = {
      ...DOT_ACTION,
      effects: [effect, DOT_ACTION.effects[0]!, DOT_ACTION.effects[1]!],
    }
    const result = attachCombatEffectProvenance(
      before,
      after,
      action,
      EVALUATION,
      context('composed'),
      { statuses: [] },
    )
    expect(
      result
        .effectState!.poison.filter((row) => row.targetCombatantId === 'target')
        .map((row) => [row.provenance?.effectOrdinal, row.provenance?.copyOrdinal]),
    ).toEqual([
      [0, 0],
      [1, undefined],
    ])
    expect(
      result
        .effectState!.burn.filter((row) => row.targetCombatantId === 'target')
        .map((row) => [row.provenance?.effectOrdinal, row.provenance?.copyOrdinal]),
    ).toEqual([
      [0, 1],
      [2, undefined],
    ])
  })

  it('does not attribute an instant application to an earlier delayed effect ordinal', () => {
    const before = {
      ...world(),
      effectTimingPolicy: {
        version: 1,
        modes: { poison: 'next-round' as const, instant: 'instant' as const },
      },
    }
    const after = applyCurrentPoisonState(before, 'actor', 'target', DOT_ACTION.id)
    const action = {
      ...DOT_ACTION,
      effects: [DOT_ACTION.effects[0]!, DOT_ACTION.effects[0]!],
      effectTimingTags: ['poison', 'instant'],
    }
    const result = attachCombatEffectProvenance(before, after, action, EVALUATION, context('timed'))
    expect(result.effectState!.poison[0]!.provenance?.effectOrdinal).toBe(1)
  })

  it('assigns independent Barrier grants to their distinct authored ordinals', () => {
    const before = world()
    let after = grantBarrier(before, 'actor', 'target', DOT_ACTION.id, 2).state
    after = grantBarrier(after, 'actor', 'target', DOT_ACTION.id, 7).state
    const action = {
      ...DOT_ACTION,
      effects: [
        { type: 'barrier-change' as const, recipient: 'primary-unit' as const, amount: 2 },
        { type: 'barrier-change' as const, recipient: 'primary-unit' as const, amount: 7 },
      ],
    }
    const result = attachCombatEffectProvenance(
      before,
      after,
      action,
      EVALUATION,
      context('barriers'),
    )
    expect(result.effectState!.barriers!.map((row) => row.provenance?.effectOrdinal)).toEqual([
      0, 1,
    ])
  })

  it('preserves Copy Barrier lineage when the same command adds another pool from the same action', () => {
    let before = grantBarrier(world(), 'actor', 'actor', DOT_ACTION.id, 8).state
    before = grantBarrier(before, 'actor', 'target', DOT_ACTION.id, 12).state
    const effect = {
      type: 'copy-statuses' as const,
      recipient: 'primary-unit' as const,
      mode: 'amplify' as const,
      beneficialEffects: true,
    }
    let after = applyCombatStatusCopies(before, 'actor', 'target', DOT_ACTION.id, effect, {
      statuses: [],
    }).state
    after = grantBarrier(after, 'actor', 'actor', DOT_ACTION.id, 4).state
    const action = {
      ...DOT_ACTION,
      effects: [
        effect,
        { type: 'barrier-change' as const, recipient: 'actor' as const, amount: 4 },
      ],
    }
    const result = attachCombatEffectProvenance(
      before,
      after,
      action,
      EVALUATION,
      context('copy-barrier'),
      { statuses: [] },
    )
    const recipientPools = result.effectState!.barriers!.filter(
      (row) => row.targetCombatantId === 'actor',
    )
    expect(
      recipientPools.map((row) => [
        row.amount,
        row.provenance?.effectOrdinal,
        row.provenance?.copyOrdinal,
      ]),
    ).toEqual([
      [8, undefined, undefined],
      [12, 0, 0],
      [4, 1, undefined],
    ])
  })

  it('preserves historical replacement attribution', () => {
    const before = world(false)
    const after = apply(before)
    const attributed = attachCombatEffectProvenance(
      before,
      after,
      DOT_ACTION,
      EVALUATION,
      context('legacy'),
    )
    expect(attributed.effectState!.poison[0]!.provenance?.effectOrdinal).toBe(0)
    expect(attributed.effectState!.burn[0]!.provenance?.effectOrdinal).toBe(1)
    expect(attributed.effectState!.ongoingRecovery[0]!.provenance?.effectOrdinal).toBe(2)
  })
})
