import { describe, expect, it } from 'vitest'

import {
  calculateDerivedStats,
  DERIVED_STAT_RULESET_V1,
  validateDerivedStatRuleset,
  type DerivedStatRuleset,
} from './derived-stats'

const balancedAttributes = {
  might: 6,
  finesse: 6,
  intellect: 6,
  resolve: 6,
}

describe('derived stat framework', () => {
  it('calculates the deterministic Phase 1 balanced level-1 profile', () => {
    const snapshot = calculateDerivedStats({ attributes: balancedAttributes, level: 1 })

    expect(snapshot.rulesVersion).toBe(1)
    expect(snapshot.stats.maxHp.value).toBe(164)
    expect(snapshot.stats.maxMp.value).toBe(90)
    expect(snapshot.stats.physicalPower.value).toBe(34)
    expect(snapshot.stats.mysticPower.value).toBe(34)
    expect(snapshot.stats.armor.value).toBe(23)
    expect(snapshot.stats.ward.value).toBe(23)
    expect(snapshot.stats.accuracy.value).toBe(7400)
    expect(snapshot.stats.evasion.value).toBe(900)
    expect(snapshot.stats.criticalChance.value).toBe(800)
    expect(snapshot.stats.initiative.value).toBe(28)
    expect(snapshot.stats.movement.value).toBe(4)
    expect(snapshot.stats.jump.value).toBe(1)
    expect(snapshot.stats.statusResistance.value).toBe(600)
  })

  it('applies level growth from level steps after level 1', () => {
    const levelOne = calculateDerivedStats({ attributes: balancedAttributes, level: 1 })
    const levelTen = calculateDerivedStats({ attributes: balancedAttributes, level: 10 })

    expect(levelTen.stats.maxHp.value - levelOne.stats.maxHp.value).toBe(45)
    expect(levelTen.stats.maxMp.value - levelOne.stats.maxMp.value).toBe(27)
    expect(levelTen.stats.physicalPower.value - levelOne.stats.physicalPower.value).toBe(9)
    expect(levelTen.stats.armor.value - levelOne.stats.armor.value).toBe(9)
  })

  it('keeps contribution provenance sufficient to reconstruct each unclamped value', () => {
    const snapshot = calculateDerivedStats({ attributes: balancedAttributes, level: 10 })

    for (const stat of Object.values(snapshot.stats)) {
      const numerator = stat.contributions.reduce(
        (total, contribution) => total + contribution.numeratorAmount,
        0,
      )
      expect(Math.floor(numerator / stat.divisor)).toBe(stat.unclampedValue)
    }

    expect(snapshot.stats.physicalPower.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'attribute',
          sourceId: 'character.attribute.might',
          inputValue: 6,
          coefficient: 3,
        }),
      ]),
    )
  })

  it('clamps bounded percentage and mobility stats at configured limits', () => {
    const snapshot = calculateDerivedStats({
      attributes: { might: 1000, finesse: 1000, intellect: 1000, resolve: 1000 },
      level: 100,
    })

    expect(snapshot.stats.accuracy.value).toBe(9500)
    expect(snapshot.stats.evasion.value).toBe(7500)
    expect(snapshot.stats.criticalChance.value).toBe(5000)
    expect(snapshot.stats.statusResistance.value).toBe(7500)
    expect(snapshot.stats.movement.value).toBe(8)
    expect(snapshot.stats.jump.value).toBe(4)
  })

  it('rejects invalid character inputs', () => {
    expect(() =>
      calculateDerivedStats({ attributes: { ...balancedAttributes, resolve: 0 }, level: 1 }),
    ).toThrow(RangeError)
    expect(() => calculateDerivedStats({ attributes: balancedAttributes, level: 0 })).toThrow(
      RangeError,
    )
    expect(() => calculateDerivedStats({ attributes: balancedAttributes, level: 101 })).toThrow(
      RangeError,
    )
  })

  it('validates versioned configuration completeness and arithmetic safety', () => {
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V1)).toEqual([])

    const duplicateAndMissing: DerivedStatRuleset = {
      version: 1,
      rules: [
        ...DERIVED_STAT_RULESET_V1.rules.filter((rule) => rule.id !== 'jump'),
        { ...DERIVED_STAT_RULESET_V1.rules[0] },
      ],
    }
    const unsafeDivisor: DerivedStatRuleset = {
      version: 1,
      rules: DERIVED_STAT_RULESET_V1.rules.map((rule) =>
        rule.id === 'movement' ? { ...rule, divisor: 0 } : rule,
      ),
    }

    const identityIssues = validateDerivedStatRuleset(duplicateAndMissing)
    expect(identityIssues.some((issue) => issue.message.includes('Duplicate'))).toBe(true)
    expect(
      identityIssues.some((issue) => issue.message.includes('Missing derived stat rule: jump')),
    ).toBe(true)
    expect(validateDerivedStatRuleset(unsafeDivisor)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: expect.stringContaining('divisor') }),
      ]),
    )
  })
})
