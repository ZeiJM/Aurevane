import { describe, expect, it } from 'vitest'

import {
  calculateDerivedStats,
  DERIVED_STAT_RULESET_V1,
  DERIVED_STAT_RULESET_V2,
  DERIVED_STAT_RULESET_V3,
  validateDerivedStatRuleset,
  type DerivedStatRuleset,
} from './derived-stats'

const balancedAttributes = {
  might: 6,
  finesse: 6,
  vitality: 6,
  agility: 6,
  intellect: 6,
  resolve: 6,
}

describe('derived stat framework', () => {
  it('calculates the current balanced Level-1 profile without front-loading endgame percentages', () => {
    const snapshot = calculateDerivedStats({ attributes: balancedAttributes, level: 1 })

    expect(snapshot.rulesVersion).toBe(3)
    expect(snapshot.stats.maxHp.value).toBe(164)
    expect(snapshot.stats.maxMp.value).toBe(90)
    expect(snapshot.stats.physicalPower.value).toBe(34)
    expect(snapshot.stats.mysticPower.value).toBe(34)
    expect(snapshot.stats.armor.value).toBe(23)
    expect(snapshot.stats.ward.value).toBe(23)
    expect(snapshot.stats.accuracy.value).toBe(6650)
    expect(snapshot.stats.evasion.value).toBe(170)
    expect(snapshot.stats.criticalChance.value).toBe(250)
    expect(snapshot.stats.initiative.value).toBe(14)
    expect(snapshot.stats.movement.value).toBe(2)
    expect(snapshot.stats.jump.value).toBe(0)
    expect(snapshot.stats.statusResistance.value).toBe(420)
  })

  it('retains V1 as an explicit historical ruleset', () => {
    const snapshot = calculateDerivedStats(
      { attributes: balancedAttributes, level: 1 },
      DERIVED_STAT_RULESET_V1,
    )

    expect(snapshot.rulesVersion).toBe(1)
    expect(snapshot.stats.accuracy.value).toBe(7400)
    expect(snapshot.stats.evasion.value).toBe(900)
    expect(snapshot.stats.criticalChance.value).toBe(800)
    expect(snapshot.stats.initiative.value).toBe(28)
    expect(snapshot.stats.statusResistance.value).toBe(600)
  })

  it('applies Level growth after Level 1 while preserving established core-stat curves', () => {
    const levelOne = calculateDerivedStats({ attributes: balancedAttributes, level: 1 })
    const levelTen = calculateDerivedStats({ attributes: balancedAttributes, level: 10 })

    expect(levelTen.stats.maxHp.value - levelOne.stats.maxHp.value).toBe(22)
    expect(levelTen.stats.maxMp.value - levelOne.stats.maxMp.value).toBe(13)
    expect(levelTen.stats.physicalPower.value - levelOne.stats.physicalPower.value).toBe(4)
    expect(levelTen.stats.armor.value - levelOne.stats.armor.value).toBe(4)
    expect(levelTen.stats.accuracy.value - levelOne.stats.accuracy.value).toBe(90)
    expect(levelTen.stats.evasion.value - levelOne.stats.evasion.value).toBe(27)
    expect(levelTen.stats.criticalChance.value - levelOne.stats.criticalChance.value).toBe(63)
    expect(levelTen.stats.statusResistance.value - levelOne.stats.statusResistance.value).toBe(135)
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
          coefficient: 4,
        }),
      ]),
    )
    expect(snapshot.stats.evasion.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'level',
          sourceId: 'character.level',
          coefficient: 3,
        }),
      ]),
    )
    expect(snapshot.stats.movement.contributions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'attribute',
          sourceId: 'character.attribute.agility',
          inputValue: 6,
          coefficient: 2,
        }),
      ]),
    )
  })


  it('keeps every Core Attribute isolated to the Profile Adventure Stats shown beneath it', () => {
    const expectedSources = {
      maxHp: ['vitality'],
      maxMp: ['intellect'],
      physicalPower: ['might'],
      mysticPower: ['intellect'],
      armor: ['vitality'],
      ward: ['resolve'],
      accuracy: ['finesse'],
      evasion: ['agility'],
      criticalChance: ['finesse'],
      initiative: ['agility'],
      movement: ['agility'],
      jump: ['agility'],
      statusResistance: ['resolve'],
    } as const

    for (const rule of DERIVED_STAT_RULESET_V3.rules) {
      expect(Object.keys(rule.attributeWeights).sort(), rule.id).toEqual(
        [...expectedSources[rule.id]].sort(),
      )
    }
  })

  it('gives low-Might and low-Intellect builds a Level-driven offensive floor', () => {
    const lowOffense = { ...balancedAttributes, might: 2, intellect: 2 }
    const levelOne = calculateDerivedStats({ attributes: lowOffense, level: 1 })
    const levelHundred = calculateDerivedStats({ attributes: lowOffense, level: 100 })

    expect(levelOne.stats.physicalPower.value).toBe(26)
    expect(levelOne.stats.mysticPower.value).toBe(26)
    expect(levelHundred.stats.physicalPower.value).toBe(75)
    expect(levelHundred.stats.mysticPower.value).toBe(75)
  })

  it('keeps Level-1 mobility grounded even under an extreme starting allocation', () => {
    const snapshot = calculateDerivedStats({
      attributes: {
        might: 1,
        finesse: 1,
        vitality: 1,
        agility: 31,
        intellect: 1,
        resolve: 1,
      },
      level: 1,
    })

    expect(snapshot.stats.movement.value).toBe(2)
    expect(snapshot.stats.jump.value).toBe(0)
  })

  it('allows focused Level-100 builds to mature toward the approved ceilings', () => {
    const snapshot = calculateDerivedStats({
      attributes: {
        might: 40,
        finesse: 80,
        vitality: 40,
        agility: 80,
        intellect: 40,
        resolve: 80,
      },
      level: 100,
    })

    expect(snapshot.stats.accuracy.value).toBeLessThanOrEqual(9500)
    expect(snapshot.stats.evasion.value).toBeLessThanOrEqual(1500)
    expect(snapshot.stats.criticalChance.value).toBeGreaterThanOrEqual(2700)
    expect(snapshot.stats.criticalChance.value).toBeLessThanOrEqual(3000)
    expect(snapshot.stats.statusResistance.value).toBeGreaterThanOrEqual(7000)
    expect(snapshot.stats.statusResistance.value).toBeLessThanOrEqual(7500)
    expect(snapshot.stats.movement.value).toBe(5)
    expect(snapshot.stats.jump.value).toBeGreaterThanOrEqual(1)
    expect(snapshot.stats.jump.value).toBeLessThanOrEqual(3)
  })

  it('clamps bounded percentage and mobility stats at configured limits', () => {
    const snapshot = calculateDerivedStats({
      attributes: {
        might: 1000,
        finesse: 1000,
        vitality: 1000,
        agility: 1000,
        intellect: 1000,
        resolve: 1000,
      },
      level: 100,
    })

    expect(snapshot.stats.accuracy.value).toBe(9500)
    expect(snapshot.stats.evasion.value).toBe(1500)
    expect(snapshot.stats.criticalChance.value).toBe(3000)
    expect(snapshot.stats.statusResistance.value).toBe(7500)
    expect(snapshot.stats.movement.value).toBe(5)
    expect(snapshot.stats.jump.value).toBe(3)
  })

  it('rejects invalid character inputs', () => {
    expect(() =>
      calculateDerivedStats({ attributes: { ...balancedAttributes, agility: 0 }, level: 1 }),
    ).toThrow(RangeError)
    expect(() => calculateDerivedStats({ attributes: balancedAttributes, level: 0 })).toThrow(
      RangeError,
    )
    expect(() => calculateDerivedStats({ attributes: balancedAttributes, level: 101 })).toThrow(
      RangeError,
    )
  })

  it('validates both versioned configurations for completeness and arithmetic safety', () => {
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V1)).toEqual([])
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V2)).toEqual([])
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V3)).toEqual([])

    const duplicateAndMissing: DerivedStatRuleset = {
      version: 3,
      rules: [
        ...DERIVED_STAT_RULESET_V3.rules.filter((rule) => rule.id !== 'jump'),
        { ...DERIVED_STAT_RULESET_V3.rules[0] },
      ],
    }
    const unsafeDivisor: DerivedStatRuleset = {
      version: 3,
      rules: DERIVED_STAT_RULESET_V3.rules.map((rule) =>
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
