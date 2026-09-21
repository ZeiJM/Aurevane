import { describe, expect, it } from 'vitest'

import {
  COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS,
  COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS,
  combatLevelDamageModifierBasisPoints,
} from './combat-level-scaling'

describe('combat Level matchup scaling', () => {
  it('keeps equal-Level damage neutral', () => {
    expect(combatLevelDamageModifierBasisPoints(50, 50)).toBe(10_000)
  })

  it('keeps opponents within 20 Levels in a competitive damage band', () => {
    expect(combatLevelDamageModifierBasisPoints(60, 80)).toBe(9_000)
    expect(combatLevelDamageModifierBasisPoints(80, 60)).toBe(11_000)
    expect(combatLevelDamageModifierBasisPoints(25, 40)).toBe(9_250)
    expect(combatLevelDamageModifierBasisPoints(40, 25)).toBe(10_750)
  })

  it('ramps more sharply beyond the 20-Level competitive band', () => {
    expect(combatLevelDamageModifierBasisPoints(50, 80)).toBe(7_500)
    expect(combatLevelDamageModifierBasisPoints(80, 50)).toBe(12_500)
    expect(combatLevelDamageModifierBasisPoints(40, 80)).toBe(6_000)
    expect(combatLevelDamageModifierBasisPoints(80, 40)).toBe(14_000)
  })

  it('prevents extreme Level gaps from returning to near-even damage', () => {
    expect(combatLevelDamageModifierBasisPoints(1, 80)).toBe(COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS)
    expect(combatLevelDamageModifierBasisPoints(80, 1)).toBe(COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS)
    expect(COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS).toBe(2_500)
    expect(COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS).toBe(17_500)
  })

  it('rejects invalid Level inputs', () => {
    expect(() => combatLevelDamageModifierBasisPoints(0, 1)).toThrow(RangeError)
    expect(() => combatLevelDamageModifierBasisPoints(1, 101)).toThrow(RangeError)
  })
})
