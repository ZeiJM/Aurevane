import { describe, expect, it } from 'vitest'

import {
  calculateScaledRawDamage,
  currentSkillDamageScaling,
  legacySkillDamageScaling,
  validateCombatDamageScaling,
  type CombatDamageScaling,
} from './damage-scaling'

describe('combat damage scaling', () => {
  it('preserves authored base damage when no scaling profile is present', () => {
    expect(calculateScaledRawDamage(12, null, null)).toBe(12)
    expect(calculateScaledRawDamage(12, undefined, null)).toBe(12)
  })

  it('preserves the historical v3 25% Skill scaling budget', () => {
    expect(legacySkillDamageScaling('physical-power', 1)).toEqual({
      source: 'physical-power',
      coefficientBasisPoints: 2_500,
    })
    expect(legacySkillDamageScaling('mystic-power', 2)).toEqual({
      source: 'mystic-power',
      coefficientBasisPoints: 1_250,
    })
    expect(legacySkillDamageScaling('physical-power', 3)).toEqual({
      source: 'physical-power',
      coefficientBasisPoints: 833,
    })
  })

  it.each([
    [25, 1_250],
    [30, 1_500],
    [35, 1_750],
    [40, 2_000],
    [45, 2_250],
    [50, 2_500],
    [55, 2_750],
    [60, 3_000],
    [65, 3_250],
  ] as const)('weights the current Skill Power budget by %i AP', (apCost, expected) => {
    expect(currentSkillDamageScaling('physical-power', 1, apCost)).toEqual({
      source: 'physical-power',
      coefficientBasisPoints: expected,
    })
  })

  it('splits one AP-weighted command budget across multiple direct damage blocks', () => {
    expect(currentSkillDamageScaling('mystic-power', 2, 50)).toEqual({
      source: 'mystic-power',
      coefficientBasisPoints: 1_250,
    })
    expect(currentSkillDamageScaling('physical-power', 3, 60)).toEqual({
      source: 'physical-power',
      coefficientBasisPoints: 1_000,
    })
    expect(currentSkillDamageScaling('physical-power', 7, 65)).toEqual({
      source: 'physical-power',
      coefficientBasisPoints: 464,
    })
  })

  it('adds deterministic Physical Power scaling with basis-point floor semantics', () => {
    expect(
      calculateScaledRawDamage(12, { source: 'physical-power', coefficientBasisPoints: 5_000 }, 40),
    ).toBe(32)
  })

  it('adds deterministic Mystic Power scaling with basis-point floor semantics', () => {
    expect(
      calculateScaledRawDamage(12, { source: 'mystic-power', coefficientBasisPoints: 7_500 }, 41),
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
