import { describe, expect, it } from 'vitest'

import * as kernel from './combat-kernel-types'

const EXPECTED_V1_STAGES = [
  'command-validation',
  'legality',
  'target-context',
  'accuracy',
  'pre-hit-reactions',
  'raw-potency',
  'defense',
  'tactical-modifiers',
  'damage-modifiers',
  'barrier-redirect',
  'commit-mutation',
  'after-damage-triggers',
  'bounded-reactions',
  'consequences',
  'battle-state-checks',
  'metadata',
] as const

type TriggerGuard = {
  triggerChainId: string
  maxDepth: number
  remainingReactionBudget: number
  triggeredDamagePolicy: 'non-reactive' | 'reactive'
  executedInstanceIds: readonly string[]
}

type TriggerAttempt =
  | { accepted: true; guard: TriggerGuard }
  | {
      accepted: false
      reason: 'depth-limit' | 'reaction-budget-exhausted' | 'instance-already-executed'
      guard: TriggerGuard
    }

type TriggerGuardFactory = (input: {
  triggerChainId: string
  maxDepth?: number
  reactionBudget?: number
  triggeredDamagePolicy?: 'non-reactive' | 'reactive'
}) => TriggerGuard

type TriggerConsumer = (
  guard: TriggerGuard,
  input: { instanceId: string; depth: number },
) => TriggerAttempt

function k3Export(name: string): unknown {
  return (kernel as unknown as Record<string, unknown>)[name]
}

function requireK3Function<T>(name: string): T {
  const value = k3Export(name)
  expect(value, `${name} must be exported by the K3 kernel contract`).toBeTypeOf('function')
  return value as T
}

describe('P4.K3 versioned combat-resolution pipeline', () => {
  it('publishes the approved sixteen v1 stages in one explicit immutable order', () => {
    expect(k3Export('COMBAT_RESOLUTION_PIPELINE_VERSION')).toBe(1)
    expect(k3Export('COMBAT_RESOLUTION_STAGES_V1')).toEqual(EXPECTED_V1_STAGES)
    expect(new Set(k3Export('COMBAT_RESOLUTION_STAGES_V1') as readonly string[]).size).toBe(
      EXPECTED_V1_STAGES.length,
    )
    expect(Object.isFrozen(k3Export('COMBAT_RESOLUTION_STAGES_V1'))).toBe(true)
  })
})

describe('P4.K3 trigger-chain safety', () => {
  it('creates a bounded chain with explicit triggered-damage policy', () => {
    const createGuard = requireK3Function<TriggerGuardFactory>('createCombatTriggerGuard')

    expect(
      createGuard({
        triggerChainId: 'chain-001',
        maxDepth: 3,
        reactionBudget: 2,
        triggeredDamagePolicy: 'non-reactive',
      }),
    ).toEqual({
      triggerChainId: 'chain-001',
      maxDepth: 3,
      remainingReactionBudget: 2,
      triggeredDamagePolicy: 'non-reactive',
      executedInstanceIds: [],
    })
  })

  it('consumes reactions immutably and blocks the same instance from executing twice', () => {
    const createGuard = requireK3Function<TriggerGuardFactory>('createCombatTriggerGuard')
    const consumeTrigger = requireK3Function<TriggerConsumer>('consumeCombatTrigger')
    const original = createGuard({ triggerChainId: 'chain-002', reactionBudget: 2 })

    const first = consumeTrigger(original, { instanceId: 'effect-instance-a', depth: 1 })
    expect(first).toEqual({
      accepted: true,
      guard: {
        ...original,
        remainingReactionBudget: 1,
        executedInstanceIds: ['effect-instance-a'],
      },
    })
    expect(original.remainingReactionBudget).toBe(2)
    expect(original.executedInstanceIds).toEqual([])

    if (!first.accepted) throw new Error('first trigger unexpectedly rejected')
    const duplicate = consumeTrigger(first.guard, { instanceId: 'effect-instance-a', depth: 1 })
    expect(duplicate).toEqual({
      accepted: false,
      reason: 'instance-already-executed',
      guard: first.guard,
    })
  })

  it('rejects depth overflow and exhausted reaction budgets without mutating the guard', () => {
    const createGuard = requireK3Function<TriggerGuardFactory>('createCombatTriggerGuard')
    const consumeTrigger = requireK3Function<TriggerConsumer>('consumeCombatTrigger')
    const guard = createGuard({
      triggerChainId: 'chain-003',
      maxDepth: 2,
      reactionBudget: 1,
      triggeredDamagePolicy: 'reactive',
    })

    expect(consumeTrigger(guard, { instanceId: 'too-deep', depth: 3 })).toEqual({
      accepted: false,
      reason: 'depth-limit',
      guard,
    })

    const accepted = consumeTrigger(guard, { instanceId: 'within-depth', depth: 2 })
    if (!accepted.accepted) throw new Error('bounded trigger unexpectedly rejected')
    expect(consumeTrigger(accepted.guard, { instanceId: 'budget-empty', depth: 2 })).toEqual({
      accepted: false,
      reason: 'reaction-budget-exhausted',
      guard: accepted.guard,
    })
  })
})
