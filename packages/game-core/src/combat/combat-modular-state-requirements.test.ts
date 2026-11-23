import { describe, expect, it } from 'vitest'
import {
  evaluateAbilityRequirements,
  evaluateAutomaticRequirementTrigger,
  hasUnanchoredAutomaticStateRequirement,
  isBeforeActionModifierRequirement,
  validateAbilityRequirements,
  type AbilityRequirementContext,
  type RequirementNode,
} from './combat-requirements'

describe('registered state condition primitives', () => {
  it('checks generic Primed without requiring a particular ability identity', () => {
    const primed: RequirementNode = { kind: 'prime-presence', subject: 'owner', present: true }
    expect(validateAbilityRequirements(primed)).toEqual([])
    expect(
      evaluateAbilityRequirements(primed, { owner: { primeAbilityIds: ['custom.held-skill'] } }),
    ).toBe(true)
    expect(evaluateAbilityRequirements(primed, { owner: { primeAbilityIds: [] } })).toBe(false)
    expect(evaluateAbilityRequirements(primed, { owner: { statusIds: ['primed'] } })).toBe(false)
    expect(evaluateAbilityRequirements(primed, {})).toBe(false)
  })

  it('keeps generic absence and historical ability-specific presence distinct', () => {
    const absent: RequirementNode = { kind: 'prime-presence', subject: 'owner', present: false }
    expect(evaluateAbilityRequirements(absent, { owner: { primeAbilityIds: [] } })).toBe(true)
    expect(
      evaluateAbilityRequirements(absent, { owner: { primeAbilityIds: ['other.skill'] } }),
    ).toBe(false)
    expect(evaluateAbilityRequirements(absent, { owner: {} })).toBe(false)
    expect(
      evaluateAbilityRequirements(
        { kind: 'prime-presence', subject: 'owner', abilityId: 'old.skill', present: true },
        { owner: { primeAbilityIds: ['other.skill'] } },
      ),
    ).toBe(false)
    expect(validateAbilityRequirements({ ...absent, abilityId: '' })).not.toEqual([])
  })

  const gain: Extract<RequirementNode, { kind: 'resource-change' }> = {
    kind: 'resource-change',
    subject: 'affected',
    resource: 'mp',
    direction: 'gained',
    minimumAmount: 2,
  }
  const frame: AbilityRequirementContext = {
    affected: { resources: { mp: 12 }, previousResources: { mp: 10 } },
    resourceMutations: { affected: ['mp'] },
  }

  it('requires a real witnessed resource change of the authored size', () => {
    expect(validateAbilityRequirements(gain)).toEqual([])
    expect(evaluateAbilityRequirements(gain, frame)).toBe(true)
    for (const value of [10, 11, 9])
      expect(
        evaluateAbilityRequirements(gain, {
          ...frame,
          affected: { ...frame.affected, resources: { mp: value } },
        }),
      ).toBe(false)
    expect(evaluateAbilityRequirements(gain, { ...frame, resourceMutations: {} })).toBe(false)
    expect(
      evaluateAbilityRequirements(gain, { ...frame, resourceMutations: { affected: ['hp'] } }),
    ).toBe(false)
    expect(
      evaluateAbilityRequirements(gain, {
        ...frame,
        affected: { resources: { mp: 12 } },
        event: { type: 'resource_changed', phase: 'after' },
      }),
    ).toBe(false)
  })

  it('treats resource change as an event witness rather than maintained state', () => {
    expect(evaluateAutomaticRequirementTrigger(gain, frame, true)).toEqual({
      holds: true,
      stateTruth: false,
      eventMatched: true,
      stateEntered: false,
    })
    expect(hasUnanchoredAutomaticStateRequirement(gain)).toBe(false)
    expect(
      isBeforeActionModifierRequirement({
        kind: 'all',
        children: [{ kind: 'action', classification: 'attack' }, gain],
      }),
    ).toBe(false)
    const loss = { ...gain, direction: 'lost' } as RequirementNode
    expect(
      evaluateAbilityRequirements(loss, {
        ...frame,
        affected: { resources: { mp: 8 }, previousResources: { mp: 10 } },
      }),
    ).toBe(true)
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid change amount %s',
    (amount) => {
      expect(validateAbilityRequirements({ ...gain, minimumAmount: amount })).not.toEqual([])
    },
  )
})
