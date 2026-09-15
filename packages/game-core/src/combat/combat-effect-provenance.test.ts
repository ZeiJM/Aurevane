import { describe, expect, it } from 'vitest'

import * as kernel from './combat-kernel-types'

type ActionProvenance = ReturnType<typeof kernel.createCombatActionProvenance>

type EffectProvenanceBuilder = (input: {
  action: ActionProvenance
  targetCombatantId: string
  effectOrdinal: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: string
  inheritedFromInstanceId?: string
}) => {
  instanceId: string
  action: ActionProvenance
  targetCombatantId: string
  effectOrdinal: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: string
  inheritedFromInstanceId?: string
}

type EffectProvenanceValidator = (value: unknown) => readonly string[]

function requireKernelFunction<T>(name: string): T {
  const value = (kernel as unknown as Record<string, unknown>)[name]
  expect(value, `${name} must be exported by the K3 kernel contract`).toBeTypeOf('function')
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

  it('preserves copied-from and inherited-from causal links when explicitly supplied', () => {
    const build = requireKernelFunction<EffectProvenanceBuilder>(
      'createCombatEffectInstanceProvenance',
    )

    expect(
      build({
        action: actionProvenance(),
        targetCombatantId: 'target',
        effectOrdinal: 0,
        createdRound: 1,
        createdTurn: 1,
        copiedFromInstanceId: 'effect:origin',
        inheritedFromInstanceId: 'effect:parent',
      }),
    ).toMatchObject({
      copiedFromInstanceId: 'effect:origin',
      inheritedFromInstanceId: 'effect:parent',
    })
  })

  it.each([
    { field: 'effectOrdinal', value: -1 },
    { field: 'effectOrdinal', value: 1.5 },
    { field: 'createdRound', value: 0 },
    { field: 'createdTurn', value: 0 },
  ] as const)(
    'rejects invalid numeric provenance input: $field=$value',
    ({ field, value }) => {
      const build = requireKernelFunction<EffectProvenanceBuilder>(
        'createCombatEffectInstanceProvenance',
      )
      const input = {
        action: actionProvenance(),
        targetCombatantId: 'target',
        effectOrdinal: 0,
        createdRound: 1,
        createdTurn: 1,
        [field]: value,
      }

      expect(() => build(input)).toThrow(TypeError)
    },
  )

  it('validates persisted provenance and rejects malformed target/instance identities', () => {
    const build = requireKernelFunction<EffectProvenanceBuilder>(
      'createCombatEffectInstanceProvenance',
    )
    const validate = requireKernelFunction<EffectProvenanceValidator>(
      'validateCombatEffectInstanceProvenance',
    )
    const valid = build({
      action: actionProvenance(),
      targetCombatantId: 'target',
      effectOrdinal: 0,
      createdRound: 1,
      createdTurn: 1,
    })

    expect(validate(valid)).toEqual([])
    expect(validate({ ...valid, targetCombatantId: ' target' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/targetCombatantId/i)]),
    )
    expect(validate({ ...valid, instanceId: '' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/instanceId/i)]),
    )
  })
})
