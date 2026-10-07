import { describe, expect, it } from 'vitest'
import { percentageDotTickDamage, validatePercentageDotProfile } from './combat-percentage-dots'
import {
  validateCurrentBleedEffect,
  validateCurrentBurnEffect,
  validateCurrentPoisonEffect,
} from './combat-dots'

describe('attack percentage DoT arithmetic and authoring', () => {
  it('uses captured HP damage and percentage-point Burn decay', () => {
    const profile = {
      kind: 'attack-percentage' as const,
      basisPoints: 2500,
      decayBasisPointsPerTick: 500,
    }
    expect([0, 1, 2].map((stage) => percentageDotTickDamage(40, profile, stage))).toEqual([
      10, 8, 6,
    ])
    expect(percentageDotTickDamage(40, { kind: 'attack-percentage', basisPoints: 1500 })).toBe(6)
  })

  it('floors without an implicit minimum and stays exact at the safe integer boundary', () => {
    expect(percentageDotTickDamage(1, { kind: 'attack-percentage', basisPoints: 1 })).toBe(0)
    expect(percentageDotTickDamage(0, { kind: 'attack-percentage', basisPoints: 10000 })).toBe(0)
    expect(
      percentageDotTickDamage(Number.MAX_SAFE_INTEGER, {
        kind: 'attack-percentage',
        basisPoints: 10000,
      }),
    ).toBe(Number.MAX_SAFE_INTEGER)
    expect(percentageDotTickDamage(39, { kind: 'attack-percentage', basisPoints: 1500 })).toBe(5)
  })

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])(
    'rejects invalid captured HP basis %s',
    (basis) => {
      expect(() =>
        percentageDotTickDamage(basis, { kind: 'attack-percentage', basisPoints: 1500 }),
      ).toThrow()
    },
  )

  it.each([0, -1, 10001, 0.5, NaN, Infinity])('rejects invalid percentages %s', (basisPoints) => {
    expect(() =>
      validatePercentageDotProfile({ kind: 'attack-percentage', basisPoints }, 3, 'burn'),
    ).toThrow()
  })

  it.each([0, 5, 1.5, NaN, Infinity])('rejects invalid tick counts %s', (ticks) => {
    expect(() =>
      validatePercentageDotProfile(
        { kind: 'attack-percentage', basisPoints: 1500 },
        ticks,
        'poison',
      ),
    ).toThrow()
  })

  it('requires every Burn stage to remain positive and forbids Poison/Bleed decay', () => {
    expect(() =>
      validatePercentageDotProfile(
        { kind: 'attack-percentage', basisPoints: 1000, decayBasisPointsPerTick: 500 },
        3,
        'burn',
      ),
    ).toThrow()
    expect(() =>
      validatePercentageDotProfile(
        { kind: 'attack-percentage', basisPoints: 1000, decayBasisPointsPerTick: -1 },
        2,
        'burn',
      ),
    ).toThrow()
    for (const type of ['poison', 'bleed'] as const)
      expect(() =>
        validatePercentageDotProfile(
          { kind: 'attack-percentage', basisPoints: 1500, decayBasisPointsPerTick: 0 },
          3,
          type,
        ),
      ).toThrow()
    expect(() =>
      validatePercentageDotProfile(
        { kind: 'attack-percentage', basisPoints: 2500, decayBasisPointsPerTick: 500 },
        3,
        'burn',
      ),
    ).not.toThrow()
  })

  it('accepts percentage effects without fixed damage and rejects ambiguous authoring', () => {
    const damageProfile = { kind: 'attack-percentage' as const, basisPoints: 1500 }
    expect(() => validateCurrentBleedEffect({ damageProfile, ticks: 3 })).not.toThrow()
    expect(() =>
      validateCurrentBleedEffect({ damageProfile, damagePerTick: 2, ticks: 3 }),
    ).toThrow()
    expect(() => validateCurrentPoisonEffect({ damageProfile, durationTurns: 4 })).not.toThrow()
    expect(() =>
      validateCurrentPoisonEffect({ damageProfile, power: 2, durationTurns: 4 }),
    ).toThrow()
    expect(() => validateCurrentBurnEffect({ damageProfile, durationTurns: 3 })).not.toThrow()
    expect(() => validateCurrentBurnEffect({ damageProfile, power: 2, durationTurns: 3 })).toThrow()
  })
})
