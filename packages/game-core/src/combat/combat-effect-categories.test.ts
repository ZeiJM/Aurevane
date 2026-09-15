import { describe, expect, it } from 'vitest'

import { P2_3_GUARDED_STATUS, type CombatStatusDefinition } from './actions'
import { validateCombatStatusDefinition } from './combat-authoring-validation'
import { COMBAT_EFFECT_CATEGORIES, validateCombatEffectCategory } from './combat-effect-categories'
import { combatStatusEffectCategories } from './combat-effect-state'

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

  it('keeps historical status definitions category-empty by default', () => {
    expect(combatStatusEffectCategories(P2_3_GUARDED_STATUS)).toEqual([])
  })

  it('accepts distinct canonical categories on status definitions', () => {
    const status = {
      ...P2_3_GUARDED_STATUS,
      effectCategories: ['Buff', 'Barrier'],
    } as unknown as CombatStatusDefinition

    expect(combatStatusEffectCategories(status)).toEqual(['Buff', 'Barrier'])
    expect(() => validateCombatStatusDefinition(status)).not.toThrow()
  })

  it('rejects duplicate and unknown status categories', () => {
    expect(() =>
      validateCombatStatusDefinition({
        ...P2_3_GUARDED_STATUS,
        effectCategories: ['Buff', 'Buff'],
      } as unknown as CombatStatusDefinition),
    ).toThrow(/effect categories/i)

    expect(() =>
      validateCombatStatusDefinition({
        ...P2_3_GUARDED_STATUS,
        effectCategories: ['Scripted'],
      } as unknown as CombatStatusDefinition),
    ).toThrow(/effect category/i)
  })
})
