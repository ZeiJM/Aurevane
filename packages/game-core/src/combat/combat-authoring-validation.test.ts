import { describe, expect, it } from 'vitest'

import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARDED_STATUS,
  P2_3_GUARD_ACTION,
  type CombatStatusDefinition,
} from './actions'
import {
  validateCombatActionDefinition,
  validateCombatStatusDefinition,
} from './combat-authoring-validation'
import { combatStatusMetadata } from './combat-effect-state'

describe('combat authoring validation boundary', () => {
  it('exposes pure validators that accept current published content', () => {
    expect(() =>
      validateCombatActionDefinition(P2_3_GUARD_ACTION, P2_3_COMBAT_CONTENT),
    ).not.toThrow()
    expect(() => validateCombatStatusDefinition(P2_3_GUARDED_STATUS)).not.toThrow()
  })

  it('validates explicit status metadata used by cloning and reactions', () => {
    const status: CombatStatusDefinition = {
      ...P2_3_GUARDED_STATUS,
      polarity: 'positive',
      amplifyCopyable: true,
      curseCopyable: false,
      reactionClass: 'ordinary',
    }
    expect(() => validateCombatStatusDefinition(status)).not.toThrow()
    expect(combatStatusMetadata(status)).toEqual({
      polarity: 'positive',
      amplifyCopyable: true,
      curseCopyable: false,
      reactionClass: 'ordinary',
    })

    expect(() =>
      validateCombatStatusDefinition({
        ...status,
        polarity: 'beneficial',
      } as unknown as CombatStatusDefinition),
    ).toThrow(/polarity/i)
  })

  it('uses non-copying compatibility defaults for historical statuses', () => {
    expect(combatStatusMetadata(P2_3_GUARDED_STATUS)).toEqual({
      polarity: 'neutral',
      amplifyCopyable: false,
      curseCopyable: false,
      reactionClass: 'ordinary',
    })
  })
})
