import { describe, expect, it } from 'vitest'

import { COMBAT_EFFECT_CATEGORIES, validateCombatEffectCategory } from './combat-effect-categories'

const EXPECTED_CATEGORIES = [
  'Damage',
  'Healing',
  'Control',
  'Movement',
  'ForcedMovement',
  'Buff',
  'Debuff',
  'DamageOverTime',
  'HealingOverTime',
  'Barrier',
  'Summon',
  'Resource',
  'Stealth',
  'Mark',
  'Terrain',
  'Transformation',
] as const

describe('P4.K4 combat effect categories', () => {
  it('publishes the approved immutable category vocabulary in canonical order', () => {
    expect(COMBAT_EFFECT_CATEGORIES).toEqual(EXPECTED_CATEGORIES)
    expect(Object.isFrozen(COMBAT_EFFECT_CATEGORIES)).toBe(true)
    expect(new Set(COMBAT_EFFECT_CATEGORIES).size).toBe(EXPECTED_CATEGORIES.length)
  })

  it('accepts only exact canonical categories', () => {
    expect(() => validateCombatEffectCategory('Damage')).not.toThrow()
    expect(() => validateCombatEffectCategory('ForcedMovement')).not.toThrow()
    expect(() => validateCombatEffectCategory('damage')).toThrow(/effect category/i)
    expect(() => validateCombatEffectCategory('Scripted')).toThrow(/effect category/i)
    expect(() => validateCombatEffectCategory(null)).toThrow(/effect category/i)
  })
})
