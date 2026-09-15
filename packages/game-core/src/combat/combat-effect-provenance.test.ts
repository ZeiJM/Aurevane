import { describe, expect, it } from 'vitest'

import * as kernel from './combat-kernel-types'

type ActionProvenance = ReturnType<typeof kernel.createCombatActionProvenance>

interface EffectProvenanceInput {
  action: ActionProvenance
  targetCombatantId: string
  effectOrdinal: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: string
  inheritedFromInstanceId?: string
}

interface EffectProvenance {
  instanceId: string
  action: ActionProvenance
  targetCombatantId: string
  effectOrdinal: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: string
  inheritedFromInstanceId?: string
}

type EffectProvenanceBuilder = (input: EffectProvenanceInput) => EffectProvenance
type EffectProvenanceValidator = (value: unknown) => readonly string[]

function requireKernelFunction<T>(name: string): T {
  const exports = kernel as unknown as Record<string, unknown>
  const value = exports[name]
  expect(typeof value).toBe('function')
  return value as T
}

function actionProvenance(): ActionProvenance {
  return kernel.createCombatActionProvenance({
    rulesetVersion: 2,
    sourceKind: 'discipline-skill',
    actionDefinitionId: 'skill.ironfist.rising-fist',
    actionVersion: 3,
    sourceCombatantId: 'actor',
    controllerCombatantId: 'actor',
    triggerChainId: 'chain:command-1',
  })
}

function validInput(): EffectProvenanceInput {
  return {
    action: actionProvenance(),
    targetCombatantId: 'target',
    effectOrdinal: 0,
    createdRound: 1,
    createdTurn: 1,
  }
}

describe('P4.K3 combat effect instance provenance', () => {
  it('builds deterministic provenance from the action chain, effect ordinal and target', () => {
    const build = requireKernelFunction<EffectProvenanceBuilder>(
      'createCombatEffectInstanceProvenance',
    )
    const action = actionProvenance()

    expect(
      build({
        action,
        targetCombatantId: 'target',
        effectOrdinal: 1,
        createdRound: 2,
        createdTurn: 4,
      }),
    ).toEqual({
      instanceId: 'effect:chain:command-1:skill.ironfist.rising-fist:1:target',
      action,
      targetCombatantId: 'target',
      effectOrdinal: 1,
      createdRound: 2,
      createdTurn: 4,
    })
  })

  it('preserves explicit copied-from and inherited-from causal links', () => {
    const build = requireKernelFunction<EffectProvenanceBuilder>(
      'createCombatEffectInstanceProvenance',
    )

    expect(
      build({
        ...validInput(),
        copiedFromInstanceId: 'effect:origin',
        inheritedFromInstanceId: 'effect:parent',
      }),
    ).toMatchObject({
      copiedFromInstanceId: 'effect:origin',
      inheritedFromInstanceId: 'effect:parent',
    })
  })

  it('rejects invalid numeric provenance input', () => {
    const build = requireKernelFunction<EffectProvenanceBuilder>(
      'createCombatEffectInstanceProvenance',
    )

    expect(() => build({ ...validInput(), effectOrdinal: -1 })).toThrow(TypeError)
    expect(() => build({ ...validInput(), effectOrdinal: 1.5 })).toThrow(TypeError)
    expect(() => build({ ...validInput(), createdRound: 0 })).toThrow(TypeError)
    expect(() => build({ ...validInput(), createdTurn: 0 })).toThrow(TypeError)
  })

  it('validates persisted provenance and rejects malformed identities', () => {
    const build = requireKernelFunction<EffectProvenanceBuilder>(
      'createCombatEffectInstanceProvenance',
    )
    const validate = requireKernelFunction<EffectProvenanceValidator>(
      'validateCombatEffectInstanceProvenance',
    )
    const valid = build(validInput())

    expect(validate(valid)).toEqual([])
    expect(validate({ ...valid, targetCombatantId: ' target' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/targetCombatantId/i)]),
    )
    expect(validate({ ...valid, instanceId: '' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/instanceId/i)]),
    )
  })
})
