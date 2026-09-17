import { describe, expect, it } from 'vitest'
import {
  consumeCombatTrigger,
  createCombatActionProvenance,
  createCombatEffectInstanceProvenance,
  createCombatTriggerGuard,
  validateCombatEffectInstanceProvenance,
  type CreateCombatEffectInstanceProvenanceInput,
} from './combat-kernel-types'

const action = createCombatActionProvenance({
  rulesetVersion: 2,
  sourceKind: 'discipline-skill',
  actionDefinitionId: 'skill.amplify',
  actionVersion: 1,
  sourceCombatantId: 'caster',
  controllerCombatantId: 'caster',
  triggerChainId: 'chain:copy-command',
})
const input: CreateCombatEffectInstanceProvenanceInput = {
  action,
  targetCombatantId: 'caster',
  effectOrdinal: 2,
  createdRound: 3,
  createdTurn: 9,
  copiedFromInstanceId: 'effect:original-command:guard:0:donor',
}

// Test-first extension stays assignable before the production field exists.
function copy(copyOrdinal = 0) {
  const extended = { ...input, copyOrdinal }
  return createCombatEffectInstanceProvenance(extended)
}

function expectedId(copyOrdinal: number) {
  return `effect-copy:${JSON.stringify([
    action.triggerChainId,
    action.actionDefinitionId,
    input.effectOrdinal,
    input.targetCombatantId,
    copyOrdinal,
  ])}`
}

const invalidOrdinals = [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, '0', false]

function malformedInput(copyOrdinal: unknown): CreateCombatEffectInstanceProvenanceInput {
  // The untrusted boundary is intentional: validate runtime inputs, not only TypeScript callers.
  return { ...input, copyOrdinal } as unknown as CreateCombatEffectInstanceProvenanceInput
}

describe('copy-effect provenance identity', () => {
  it('retains the exact historical shape when copyOrdinal is omitted', () => {
    expect(createCombatEffectInstanceProvenance(input)).toEqual({
      instanceId: 'effect:chain:copy-command:skill.amplify:2:caster',
      ...input,
    })
  })

  it('preserves the authored effect ordinal and immediate source lineage on each copy', () => {
    expect(copy(0)).toEqual({ ...input, instanceId: expectedId(0), copyOrdinal: 0 })
  })

  it.each([0, 1, 2, 7, 31, Number.MAX_SAFE_INTEGER])(
    'constructs a valid deterministic copy identity for ordinal %s',
    (ordinal) => {
      const result = copy(ordinal)
      expect(result.instanceId).toBe(expectedId(ordinal))
      expect(validateCombatEffectInstanceProvenance(result)).toEqual([])
      expect(copy(ordinal)).toEqual(result)
    },
  )

  it('gives sibling copies distinct IDs even when they share the same original source', () => {
    expect(new Set([copy(0).instanceId, copy(1).instanceId, copy(2).instanceId]).size).toBe(3)
  })

  it('lets two copied reactive statuses consume separate trigger slots, not the same slot', () => {
    const initial = createCombatTriggerGuard({ triggerChainId: action.triggerChainId })
    const first = consumeCombatTrigger(initial, { instanceId: copy(0).instanceId, depth: 1 })
    expect(first.accepted).toBe(true)
    const second = consumeCombatTrigger(first.guard, { instanceId: copy(1).instanceId, depth: 1 })
    expect(second.accepted).toBe(true)
    expect(second.guard.remainingReactionBudget).toBe(30)
    expect(initial.remainingReactionBudget).toBe(32)
    const duplicate = consumeCombatTrigger(second.guard, {
      instanceId: copy(0).instanceId,
      depth: 1,
    })
    expect(duplicate).toMatchObject({ accepted: false, reason: 'instance-already-executed' })
  })

  it('does not invent source lineage when copying a historical untracked effect', () => {
    const untracked = { ...input, copiedFromInstanceId: undefined, copyOrdinal: 1 }
    const result = createCombatEffectInstanceProvenance(untracked)
    expect(result.instanceId).toBe(expectedId(1))
    expect(result).not.toHaveProperty('copiedFromInstanceId')
    expect(validateCombatEffectInstanceProvenance(result)).toEqual([])
  })

  it('links a copy of a copy to the immediate copied instance, not an invented ancestor', () => {
    const first = copy(0)
    const nextInput = { ...input, copyOrdinal: 1, copiedFromInstanceId: first.instanceId }
    const second = createCombatEffectInstanceProvenance(nextInput)
    expect(second.copiedFromInstanceId).toBe(first.instanceId)
    expect(second.instanceId).not.toBe(first.instanceId)
    expect(validateCombatEffectInstanceProvenance(second)).toEqual([])
  })

  it('round-trips copied provenance through a saved JSON snapshot', () => {
    const result = copy(3)
    const restored: unknown = JSON.parse(JSON.stringify(result))
    expect(validateCombatEffectInstanceProvenance(restored)).toEqual([])
    expect(restored).toEqual({ ...input, instanceId: expectedId(3), copyOrdinal: 3 })
  })

  it.each(invalidOrdinals)('rejects malformed copy ordinal %j during construction', (ordinal) => {
    expect(() => createCombatEffectInstanceProvenance(malformedInput(ordinal))).toThrow()
  })

  it.each(invalidOrdinals)('rejects malformed copy ordinal %j in saved provenance', (ordinal) => {
    const result = { ...createCombatEffectInstanceProvenance(input), copyOrdinal: ordinal }
    expect(validateCombatEffectInstanceProvenance(result).length).toBeGreaterThan(0)
  })

  it.each([
    { copyOrdinal: 1 },
    { copyOrdinal: undefined },
    { effectOrdinal: 3 },
    { targetCombatantId: 'other-target' },
    { action: { ...action, triggerChainId: 'other-chain' } },
    { action: { ...action, actionDefinitionId: 'skill.curse' } },
  ])('rejects a copy ID whose identifying metadata was changed: %j', (patch) => {
    const result = { ...input, copyOrdinal: 0, instanceId: expectedId(0), ...patch }
    expect(validateCombatEffectInstanceProvenance(result).length).toBeGreaterThan(0)
  })

  it('rejects a legacy ID mislabeled as a numbered copy', () => {
    const result = { ...createCombatEffectInstanceProvenance(input), copyOrdinal: 0 }
    expect(validateCombatEffectInstanceProvenance(result).length).toBeGreaterThan(0)
  })

  it('does not collide when identifiers contain the separators used by historical IDs', () => {
    const firstAction = createCombatActionProvenance({
      ...action,
      triggerChainId: 'chain:a',
      actionDefinitionId: 'skill',
    })
    const secondAction = createCombatActionProvenance({
      ...action,
      triggerChainId: 'chain',
      actionDefinitionId: 'a:skill',
    })
    const first = createCombatEffectInstanceProvenance({ ...input, action: firstAction })
    const second = createCombatEffectInstanceProvenance({ ...input, action: secondAction })
    // Historical encoding is deliberately unchanged; numbered copies use an unambiguous tuple.
    expect(first.instanceId).toBe(second.instanceId)
    const firstCopy = { ...input, action: firstAction, copyOrdinal: 0 }
    const secondCopy = { ...input, action: secondAction, copyOrdinal: 0 }
    expect(createCombatEffectInstanceProvenance(firstCopy).instanceId).not.toBe(
      createCombatEffectInstanceProvenance(secondCopy).instanceId,
    )
  })

  it('keeps inherited lineage and source inputs unchanged', () => {
    const nextInput = Object.freeze({
      ...input,
      action: Object.freeze({ ...action }),
      copyOrdinal: 0,
      inheritedFromInstanceId: 'effect:inherited:skill:0:caster',
    })
    const before = JSON.stringify(nextInput)
    const result = createCombatEffectInstanceProvenance(nextInput)
    expect(result.instanceId).toBe(expectedId(0))
    expect(result.inheritedFromInstanceId).toBe(nextInput.inheritedFromInstanceId)
    expect(JSON.stringify(nextInput)).toBe(before)
    expect(validateCombatEffectInstanceProvenance(result)).toEqual([])
  })
})
