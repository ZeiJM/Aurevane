import { describe, expect, it } from 'vitest'
import {
  evaluateAbilityRequirements,
  validateAbilityRequirements,
  type RequirementNode,
  type AbilityRequirementContext,
} from './combat-requirements'

const context: AbilityRequirementContext = {
  owner: {
    resources: { ap: 11, mp: 2, hp: 40 },
    maximumResources: { ap: 100, mp: 20, hp: 100 },
    previousResources: { ap: 11, mp: 2, hp: 60 },
    statusIds: ['frozen'],
    primeAbilityIds: ['strike'],
  },
}
const leaf: RequirementNode = {
  kind: 'status-presence',
  subject: 'owner',
  statusId: 'frozen',
  present: true,
}
function depth(count: number): RequirementNode {
  let node = leaf
  for (let index = 1; index < count; index++) node = { kind: 'all', children: [node] }
  return node
}

describe('Ability Requirements', () => {
  it('rejects undefined-only action qualifiers before canonical cloning', () => {
    expect(validateAbilityRequirements({ kind: 'action', classification: undefined })).not.toEqual(
      [],
    )
    expect(
      evaluateAbilityRequirements(
        { kind: 'action', classification: undefined },
        {
          event: {
            type: 'action',
            phase: 'before',
            action: { classification: 'attack', tags: [] },
          },
        },
      ),
    ).toBe(false)
  })

  it('requirement_tree_budget accepts depth8/node128 and rejects depth9/node129', () => {
    expect(validateAbilityRequirements(depth(8))).toEqual([])
    expect(evaluateAbilityRequirements(depth(8), context)).toBe(true)
    expect(validateAbilityRequirements(depth(9))).toContainEqual(
      expect.objectContaining({ code: 'requirement-budget' }),
    )
    expect(
      validateAbilityRequirements({
        kind: 'all',
        children: Array.from({ length: 127 }, () => leaf),
      }),
    ).toEqual([])
    expect(
      validateAbilityRequirements({
        kind: 'all',
        children: Array.from({ length: 128 }, () => leaf),
      }),
    ).toContainEqual(expect.objectContaining({ code: 'requirement-budget' }))
    expect(evaluateAbilityRequirements(depth(9), context)).toBe(false)
  })

  it('event_subject_unavailable fails closed even for absent-status predicates', () => {
    expect(
      evaluateAbilityRequirements({ ...leaf, subject: 'triggering', present: false }, context),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(
        {
          kind: 'resource-state',
          subject: 'selected',
          resource: 'hp',
          comparison: 'at-least',
          amount: 0,
        },
        context,
      ),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(
        { kind: 'prime-presence', subject: 'affected', abilityId: 'strike', present: false },
        context,
      ),
    ).toBe(false)
  })

  it('evaluates All/Any, resource state, event phase, status and prime independently', () => {
    expect(evaluateAbilityRequirements(null, context)).toBe(true)
    expect(
      evaluateAbilityRequirements(
        {
          kind: 'all',
          children: [
            leaf,
            {
              kind: 'resource-state',
              subject: 'owner',
              resource: 'ap',
              comparison: 'at-least',
              amount: 11,
            },
            { kind: 'prime-presence', subject: 'owner', abilityId: 'strike', present: true },
          ],
        },
        context,
      ),
    ).toBe(true)
    expect(
      evaluateAbilityRequirements(
        { kind: 'any', children: [{ ...leaf, present: false }, leaf] },
        context,
      ),
    ).toBe(true)
    expect(
      evaluateAbilityRequirements(
        { kind: 'all', children: [{ ...leaf, present: false }, leaf] },
        context,
      ),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(
        { kind: 'event', eventType: 'damage-settled', phase: 'after' },
        { ...context, event: { type: 'damage-settled', phase: 'before' } },
      ),
    ).toBe(false)
  })

  it('distinguishes threshold crossing from persistent state and uses intrinsic action source', () => {
    const threshold: RequirementNode = {
      kind: 'resource-threshold-crossing',
      subject: 'owner',
      resource: 'hp',
      direction: 'below',
      thresholdBasisPoints: 5000,
    }
    expect(evaluateAbilityRequirements(threshold, context)).toBe(false)
    const event = {
      type: 'damage-settled',
      phase: 'after' as const,
      action: {
        classification: 'attack' as const,
        sourceDisciplineId: 'vanguard',
        tags: ['melee'],
      },
    }
    expect(evaluateAbilityRequirements(threshold, { ...context, event })).toBe(true)
    expect(
      evaluateAbilityRequirements(threshold, {
        ...context,
        event,
        owner: { ...context.owner!, previousResources: { ap: 11, mp: 2, hp: 40 } },
      }),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(
        { kind: 'action', classification: 'attack', sourceDisciplineId: 'shadehand' },
        { ...context, event },
      ),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(
        {
          kind: 'action',
          classification: 'attack',
          sourceDisciplineId: 'vanguard',
          requiredTags: ['melee'],
        },
        { ...context, event },
      ),
    ).toBe(true)
  })

  it('resource-state distinguishes absolute resource units from maximum-resource percentages', () => {
    const percentage = {
      kind: 'resource-state',
      subject: 'owner',
      resource: 'hp',
      comparison: 'at-most',
      basisPoints: 5000,
    } as const
    expect(validateAbilityRequirements(percentage)).toEqual([])
    expect(evaluateAbilityRequirements(percentage, context)).toBe(true)
    expect(
      evaluateAbilityRequirements(percentage, {
        ...context,
        owner: { ...context.owner, maximumResources: { hp: 50 } },
      }),
    ).toBe(false)
    expect(validateAbilityRequirements({ ...percentage, amount: 50 })).not.toEqual([])
    expect(validateAbilityRequirements({ ...percentage, basisPoints: 10001 })).not.toEqual([])
    expect(
      evaluateAbilityRequirements(percentage, { ...context, owner: { resources: { hp: 40 } } }),
    ).toBe(false)
  })

  it('rejects unknown/empty/cyclic trees and invalid threshold units without throwing', () => {
    expect(validateAbilityRequirements({ kind: 'all', children: [] })).not.toEqual([])
    expect(validateAbilityRequirements({ ...leaf, script: 'true' })).toContainEqual(
      expect.objectContaining({ code: 'unknown-key' }),
    )
    expect(
      validateAbilityRequirements({
        kind: 'resource-threshold-crossing',
        subject: 'owner',
        resource: 'hp',
        direction: 'below',
        thresholdBasisPoints: 10001,
      }),
    ).not.toEqual([])
    const cyclic: { kind: string; children: unknown[] } = { kind: 'all', children: [] }
    cyclic.children.push(cyclic)
    expect(validateAbilityRequirements(cyclic)).toContainEqual(
      expect.objectContaining({ code: 'requirement-budget' }),
    )
    expect(evaluateAbilityRequirements(cyclic as never, context)).toBe(false)
  })
})
