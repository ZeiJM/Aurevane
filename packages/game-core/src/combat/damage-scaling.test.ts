import { describe, expect, it } from 'vitest'

import {
  calculateScaledRawDamage,
  validateCombatDamageScaling,
  type CombatDamageScaling,
} from './damage-scaling'

describe('combat damage scaling', () => {
  it('preserves authored base damage when no scaling profile is present', () => {
    expect(calculateScaledRawDamage(12, null, null)).toBe(12)
    expect(calculateScaledRawDamage(12, undefined, null)).toBe(12)
  })

  it('adds deterministic Physical Power scaling with basis-point floor semantics', () => {
    expect(
      calculateScaledRawDamage(
        12,
        { source: 'physical-power', coefficientBasisPoints: 5_000 },
        40,
      ),
    ).toBe(32)
  })

  it('adds deterministic Mystic Power scaling with basis-point floor semantics', () => {
    expect(
      calculateScaledRawDamage(
        12,
        { source: 'mystic-power', coefficientBasisPoints: 7_500 },
        41,
      ),
    ).toBe(42)
  })

  it('fails closed when a scaled effect has no offensive power', () => {
    expect(() =>
      calculateScaledRawDamage(
        12,
        { source: 'physical-power', coefficientBasisPoints: 5_000 },
        null,
      ),
    ).toThrow('Scaled damage requires offensive power.')
  })

  it.each([
    { source: 'physical-power', coefficientBasisPoints: -1 },
    { source: 'physical-power', coefficientBasisPoints: 20_001 },
    { source: 'physical-power', coefficientBasisPoints: 1.5 },
    { source: 'mystic-power', coefficientBasisPoints: Number.NaN },
  ] as const)('rejects invalid scaling metadata: %j', (scaling) => {
    expect(validateCombatDamageScaling(scaling as CombatDamageScaling)).not.toEqual([])
  })

  it('accepts the inclusive 0x to 2x authored coefficient range', () => {
    expect(
      validateCombatDamageScaling({ source: 'physical-power', coefficientBasisPoints: 0 }),
    ).toEqual([])
    expect(
      validateCombatDamageScaling({ source: 'mystic-power', coefficientBasisPoints: 20_000 }),
    ).toEqual([])
  })
})
