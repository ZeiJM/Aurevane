import { describe, expect, it } from 'vitest'

import {
  P2_3_COMBAT_CONTENT,
  P2_3_GUARDED_STATUS,
  P2_3_GUARD_ACTION,
  validateCombatActionDefinition,
  validateCombatStatusDefinition,
} from './actions'

describe('combat authoring validation boundary', () => {
  it('exposes pure validators that accept current published content', () => {
    expect(() => validateCombatActionDefinition(P2_3_GUARD_ACTION, P2_3_COMBAT_CONTENT)).not.toThrow()
    expect(() => validateCombatStatusDefinition(P2_3_GUARDED_STATUS)).not.toThrow()
  })
})
