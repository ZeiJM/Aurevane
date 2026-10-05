import { describe, expect, it } from 'vitest'

import {
  calculateDerivedStats,
  DERIVED_STAT_RULESET_V1,
  DERIVED_STAT_RULESET_V2,
  DERIVED_STAT_RULESET_V3,
  DERIVED_STAT_RULESET_V4,
  validateDerivedStatRuleset,
  type DerivedStatRuleset,
  type DerivedStatId,
} from './derived-stats'
import type { CharacterAttributeId } from './creation'

const balancedAttributes = {
  might: 6,
  finesse: 6,
  vitality: 6,
  agility: 6,
  intellect: 6,
  resolve: 6,
}

const currentAnchors: Record<DerivedStatId, readonly [number, number, number]> = {
  maxHp: [80, 160, 200],
  maxMp: [16, 32, 48],
  physicalPower: [40, 120, 160],
  mysticPower: [40, 120, 160],
  armor: [40, 120, 160],
  ward: [40, 120, 160],
  accuracy: [8500, 11000, 14000],
  evasion: [0, 2500, 5500],
  criticalChance: [0, 1500, 2000],
  initiative: [10, 100, 120],
  movement: [2, 4, 4],
  jump: [0, 3, 3],
  statusResistance: [0, 1000, 1500],
}

describe('current Core-driven derived curves', () => {
  it('uses V4 with exact mathematical intercepts and Core40/Core60 anchors', () => {
    for (const [core, anchor] of [
      [1, 0],
      [40, 1],
      [60, 2],
    ] as const) {
      const snapshot = calculateDerivedStats({
        attributes: {
          might: core,
          finesse: core,
          vitality: core,
          agility: core,
          intellect: core,
          resolve: core,
        },
        level: 1,
      })
      expect(snapshot.rulesVersion).toBe(4)
      for (const stat of Object.values(snapshot.stats)) {
        // Core0 is a mathematical intercept, never an illegal character input.
        const value =
          core === 1
            ? stat.contributions.find((contribution) => contribution.sourceKind === 'base')!
                .numeratorAmount / stat.divisor
            : stat.value
        expect(value, `${stat.id} at ${core === 1 ? 'intercept' : core}`).toBe(
          currentAnchors[stat.id][anchor],
        )
      }
    }
  })

  it.each([
    [39, 31, 10937, 2437, 1462, 97],
    [40, 32, 11000, 2500, 1500, 100],
    [41, 32, 11150, 2650, 1525, 101],
    [59, 47, 13850, 5350, 1975, 119],
    [60, 48, 14000, 5500, 2000, 120],
  ])(
    'rounds the correct side of the Core40 breakpoint at Core%i',
    (core, mp, accuracy, evasion, critical, initiative) => {
      const snapshot = calculateDerivedStats({
        attributes: {
          might: core,
          finesse: core,
          vitality: core,
          agility: core,
          intellect: core,
          resolve: core,
        },
        level: 37,
      })
      expect(snapshot.stats.maxMp.value).toBe(mp)
      expect(snapshot.stats.accuracy.value).toBe(accuracy)
      expect(snapshot.stats.evasion.value).toBe(evasion)
      expect(snapshot.stats.criticalChance.value).toBe(critical)
      expect(snapshot.stats.initiative.value).toBe(initiative)
    },
  )

  it('retains the same baseline at every Level and reconstructs its integer contributions', () => {
    const attributes = {
      might: 41,
      finesse: 41,
      vitality: 41,
      agility: 41,
      intellect: 41,
      resolve: 41,
    }
    const first = calculateDerivedStats({ attributes, level: 1 })
    const last = calculateDerivedStats({ attributes, level: 100 })
    expect(first).toEqual(last)
    for (const stat of Object.values(last.stats)) {
      expect(stat.contributions.some((contribution) => contribution.sourceKind === 'level')).toBe(
        false,
      )
      expect(
        Math.floor(
          stat.contributions.reduce((sum, contribution) => sum + contribution.numeratorAmount, 0) /
            stat.divisor,
        ),
      ).toBe(stat.unclampedValue)
    }
  })

  it('keeps every current Core contribution on its declared Adventure Stats', () => {
    const affected: Record<CharacterAttributeId, readonly DerivedStatId[]> = {
      might: ['physicalPower'],
      finesse: ['accuracy', 'criticalChance'],
      vitality: ['maxHp', 'armor'],
      agility: ['evasion', 'initiative', 'movement', 'jump'],
      intellect: ['maxMp', 'mysticPower'],
      resolve: ['ward', 'statusResistance'],
    }
    const base = calculateDerivedStats({ attributes: balancedAttributes, level: 1 })
    for (const attributeId of Object.keys(affected) as CharacterAttributeId[]) {
      const next = calculateDerivedStats({
        attributes: { ...balancedAttributes, [attributeId]: 40 },
        level: 1,
      })
      const changed = Object.values(next.stats)
        .filter((stat) => stat.value !== base.stats[stat.id].value)
        .map((stat) => stat.id)
      expect(changed.sort(), attributeId).toEqual([...affected[attributeId]].sort())
    }
  })

  it.each([
    [1, 2, 0],
    [13, 2, 0],
    [14, 2, 1],
    [19, 2, 1],
    [20, 3, 1],
    [27, 3, 2],
    [39, 3, 2],
    [40, 4, 3],
    [60, 4, 3],
  ])('enforces whole-tile mobility at Agility%i', (agility, movement, jump) => {
    const snapshot = calculateDerivedStats({
      attributes: { ...balancedAttributes, agility },
      level: 100,
    })
    expect(snapshot.stats.movement.value).toBe(movement)
    expect(snapshot.stats.jump.value).toBe(jump)
  })

  it('rejects Core inputs beyond the current legal maximum instead of silently clamping them', () => {
    expect(() =>
      calculateDerivedStats({ attributes: { ...balancedAttributes, might: 61 }, level: 1 }),
    ).toThrow(RangeError)
  })

  it('presents current defense labels while keeping internal identifiers stable', () => {
    const snapshot = calculateDerivedStats({ attributes: balancedAttributes, level: 1 })
    expect(snapshot.stats.armor.label).toBe('Physical Defense')
    expect(snapshot.stats.ward.label).toBe('Mystic Defense')
  })

  it('applies an above-breakpoint weight even when the earlier band contributes zero', () => {
    const ruleset = {
      ...DERIVED_STAT_RULESET_V4,
      rules: DERIVED_STAT_RULESET_V4.rules.map((rule) =>
        rule.id === 'accuracy' ? { ...rule, attributeWeights: { finesse: 0 } } : rule,
      ),
    }
    const snapshot = calculateDerivedStats(
      { attributes: { ...balancedAttributes, finesse: 41 }, level: 1 },
      ruleset,
    )
    expect(snapshot.stats.accuracy.value).toBe(8650)
  })

  it.each([
    { finesse: { at: 0, weightAbove: 300 } },
    { finesse: { at: 40.5, weightAbove: 300 } },
    { finesse: { at: 40, weightAbove: 300.5 } },
    { agility: { at: 40, weightAbove: 300 } },
  ])('rejects invalid or unrelated attribute breakpoints %j', (attributeBreakpoints) => {
    const rules = DERIVED_STAT_RULESET_V3.rules.map((rule) =>
      rule.id === 'accuracy' ? { ...rule, attributeBreakpoints } : rule,
    )
    expect(
      validateDerivedStatRuleset({ version: 4, rules }).some((issue) =>
        issue.field.includes('attributeBreakpoints'),
      ),
    ).toBe(true)
  })
})

describe('derived stat framework', () => {
  it('preserves the historical V3 balanced Level-1 profile', () => {
    const snapshot = calculateDerivedStats(
      { attributes: balancedAttributes, level: 1 },
      DERIVED_STAT_RULESET_V3,
    )

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
    const levelOne = calculateDerivedStats(
      { attributes: balancedAttributes, level: 1 },
      DERIVED_STAT_RULESET_V3,
    )
    const levelTen = calculateDerivedStats(
      { attributes: balancedAttributes, level: 10 },
      DERIVED_STAT_RULESET_V3,
    )

    expect(levelTen.stats.maxHp.value - levelOne.stats.maxHp.value).toBe(22)
    expect(levelTen.stats.maxMp.value - levelOne.stats.maxMp.value).toBe(13)
    expect(levelTen.stats.physicalPower.value - levelOne.stats.physicalPower.value).toBe(0)
    expect(levelTen.stats.mysticPower.value - levelOne.stats.mysticPower.value).toBe(0)
    expect(levelTen.stats.armor.value - levelOne.stats.armor.value).toBe(4)
    expect(levelTen.stats.accuracy.value - levelOne.stats.accuracy.value).toBe(90)
    expect(levelTen.stats.evasion.value - levelOne.stats.evasion.value).toBe(27)
    expect(levelTen.stats.criticalChance.value - levelOne.stats.criticalChance.value).toBe(63)
    expect(levelTen.stats.statusResistance.value - levelOne.stats.statusResistance.value).toBe(135)
  })

  it('keeps contribution provenance sufficient to reconstruct each unclamped value', () => {
    const snapshot = calculateDerivedStats(
      { attributes: balancedAttributes, level: 10 },
      DERIVED_STAT_RULESET_V3,
    )

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

  it('keeps offensive Power tied to Might and Intellect instead of Character Level', () => {
    const lowOffense = { ...balancedAttributes, might: 2, intellect: 2 }
    const levelOne = calculateDerivedStats(
      { attributes: lowOffense, level: 1 },
      DERIVED_STAT_RULESET_V3,
    )
    const levelHundred = calculateDerivedStats(
      { attributes: lowOffense, level: 100 },
      DERIVED_STAT_RULESET_V3,
    )

    expect(levelOne.stats.physicalPower.value).toBe(26)
    expect(levelOne.stats.mysticPower.value).toBe(26)
    expect(levelHundred.stats.physicalPower.value).toBe(26)
    expect(levelHundred.stats.mysticPower.value).toBe(26)
    expect(levelHundred.stats.physicalPower.contributions).not.toContainEqual(
      expect.objectContaining({ sourceKind: 'level' }),
    )
    expect(levelHundred.stats.mysticPower.contributions).not.toContainEqual(
      expect.objectContaining({ sourceKind: 'level' }),
    )
  })

  it('keeps Level-1 mobility grounded even under an extreme starting allocation', () => {
    const snapshot = calculateDerivedStats(
      {
        attributes: {
          might: 1,
          finesse: 1,
          vitality: 1,
          agility: 31,
          intellect: 1,
          resolve: 1,
        },
        level: 1,
      },
      DERIVED_STAT_RULESET_V3,
    )

    expect(snapshot.stats.movement.value).toBe(2)
    expect(snapshot.stats.jump.value).toBe(0)
  })

  it('allows focused Level-100 builds to mature toward the approved ceilings', () => {
    const snapshot = calculateDerivedStats(
      {
        attributes: {
          might: 40,
          finesse: 80,
          vitality: 40,
          agility: 80,
          intellect: 40,
          resolve: 80,
        },
        level: 100,
      },
      DERIVED_STAT_RULESET_V3,
    )

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
    const snapshot = calculateDerivedStats(
      {
        attributes: {
          might: 1000,
          finesse: 1000,
          vitality: 1000,
          agility: 1000,
          intellect: 1000,
          resolve: 1000,
        },
        level: 100,
      },
      DERIVED_STAT_RULESET_V3,
    )

    expect(snapshot.stats.accuracy.value).toBe(9500)
    expect(snapshot.stats.evasion.value).toBe(1500)
    expect(snapshot.stats.criticalChance.value).toBe(3000)
    expect(snapshot.stats.statusResistance.value).toBe(7500)
    expect(snapshot.stats.movement.value).toBe(5)
    expect(snapshot.stats.jump.value).toBe(3)
  })

  it('rejects invalid character inputs', () => {
    expect(() =>
      calculateDerivedStats(
        { attributes: { ...balancedAttributes, agility: 0 }, level: 1 },
        DERIVED_STAT_RULESET_V3,
      ),
    ).toThrow(RangeError)
    expect(() =>
      calculateDerivedStats({ attributes: balancedAttributes, level: 0 }, DERIVED_STAT_RULESET_V3),
    ).toThrow(RangeError)
    expect(() =>
      calculateDerivedStats(
        { attributes: balancedAttributes, level: 101 },
        DERIVED_STAT_RULESET_V3,
      ),
    ).toThrow(RangeError)
  })

  it('validates both versioned configurations for completeness and arithmetic safety', () => {
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V1)).toEqual([])
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V2)).toEqual([])
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V3)).toEqual([])
    expect(validateDerivedStatRuleset(DERIVED_STAT_RULESET_V4)).toEqual([])

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
