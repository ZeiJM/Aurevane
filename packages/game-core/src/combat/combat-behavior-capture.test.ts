import { describe, expect, it } from 'vitest'
import { captureCombatAbilitySource } from './combat-behavior-capture'
import { validateAbilityDefinition } from './combat-definition'

import { source } from './combat-behavior.test-utils'

describe('private canonical execution capture', () => {
  it('capture_cannot_change_in_place detaches and freezes every execution field', () => {
    const original = source({
      activationLimits: ['once-per-battle'],
      accuracy: { kind: 'fixed', chanceBasisPoints: 0 },
    })
    const captured = captureCombatAbilitySource(original)
    expect(captured).toEqual(original)
    expect(captured).not.toBe(original)
    expect(Object.isFrozen(captured.definition.behaviors[0]!.effects[0]!.payload)).toBe(true)
    expect(() => Object.assign(captured.definition.behaviors[0]!, { costs: [] })).toThrow()
    Object.assign(original.definition.behaviors[0]!, { costs: [] })
    expect(captured.definition.behaviors[0]!.costs).toHaveLength(3)
  })
  it('capture_persistence retains private accuracy and activation scopes across JSON reconnect', () => {
    const captured = captureCombatAbilitySource(
      source({
        activationLimits: ['once-per-owner-turn', 'once-per-round'],
        accuracy: { kind: 'fixed', chanceBasisPoints: 10000 },
      }),
    )
    const restored = captureCombatAbilitySource(JSON.parse(JSON.stringify(captured)))
    expect(restored).toEqual(captured)
    expect(restored.definition.behaviors[0]!.accuracy).toEqual({
      kind: 'fixed',
      chanceBasisPoints: 10000,
    })
  })
  it('capture rejects malformed present envelopes and invalid identity/version', () => {
    expect(() => captureCombatAbilitySource({ ...source(), definition: null } as never)).toThrow()
    expect(() => captureCombatAbilitySource({ ...source(), contentVersion: 0 })).toThrow()
    expect(() => captureCombatAbilitySource({ ...source(), ownerCombatantId: '' })).toThrow()
  })
  it('ongoing continuous packets stay unsupported by the canonical producer', () => {
    for (const payload of [
      { type: 'damage', recipient: 'actor', amount: 1 },
      { type: 'healing', recipient: 'actor', amount: 1 },
      { type: 'apply-status', recipient: 'actor', statusId: 'suppress', stacks: 1 },
    ]) {
      const value = source({
        activation: 'ongoing',
        mode: 'modifier',
        targeting: null,
        costs: [],
        effects: [{ id: 'unsupported', payload } as never],
      })
      expect(validateAbilityDefinition(value.definition)).toContainEqual(
        expect.objectContaining({ code: 'unsupported-combination' }),
      )
    }
  })
})
