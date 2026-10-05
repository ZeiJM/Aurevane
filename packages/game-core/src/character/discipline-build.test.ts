import { describe, expect, it } from 'vitest'

import type { CharacterAttributes } from './creation'
import {
  calculateCharacterBuildDerivedStats,
  buildPrimaryDisciplinePreview,
} from './discipline-build'
import { calculateDerivedStats, DERIVED_STAT_RULESET_V3, DERIVED_STAT_IDS } from './derived-stats'
import { FOUNDATION_DISCIPLINES } from './foundation-disciplines'
import { ADVANCED_DISCIPLINES } from './advanced-disciplines'

const attributes: CharacterAttributes = {
  might: 7,
  finesse: 6,
  vitality: 5,
  agility: 6,
  intellect: 5,
  resolve: 7,
}

const vanguard = {
  id: 'vanguard',
  definitionVersion: 1,
  name: 'Vanguard',
  summary: 'Balanced armed combat.',
  enabledForPrimary: true,
  enabledForSecondary: true,
} as const

it('adds the Primary base profile without mutating player-assigned attributes', () => {
  const before = { ...attributes }
  const result = calculateCharacterBuildDerivedStats(
    {
      attributes,
      level: 10,
      primaryDefinition: vanguard,
      primaryProfile: {
        disciplineId: 'vanguard',
        profileVersion: 1,
        statOffsets: { maxHp: 20, armor: 5, initiative: -1 },
      },
    },
    DERIVED_STAT_RULESET_V3,
  )

  expect(attributes).toEqual(before)
  expect(result.stats.maxHp.contributions.at(-1)).toMatchObject({
    sourceKind: 'modifier',
    sourceId: 'discipline.primary.vanguard.profile.1',
    inputValue: 20,
  })
})

describe('Primary Discipline build calculation', () => {
  it.each([...FOUNDATION_DISCIPLINES, ...ADVANCED_DISCIPLINES])(
    'ignores retired Adventure offsets and caps for current Primary $id',
    (discipline) => {
      const core = { might: 40, finesse: 40, vitality: 40, agility: 40, intellect: 40, resolve: 40 }
      const primaryDefinition = { ...vanguard, id: discipline.id, name: discipline.name }
      const input = {
        attributes: core,
        level: 100,
        primaryDefinition,
        primaryProfile: {
          disciplineId: discipline.id,
          profileVersion: 1,
          statOffsets: Object.fromEntries(DERIVED_STAT_IDS.map((id) => [id, 9999])),
          statCaps: Object.fromEntries(DERIVED_STAT_IDS.map((id) => [id, 0])),
        },
      }
      const result = calculateCharacterBuildDerivedStats(input)
      expect(result).toEqual(calculateDerivedStats({ attributes: core, level: 100 }))
      expect(result.stats.accuracy.value).toBe(11000)
      expect(result.stats.evasion.value).toBe(2500)
      expect(result.stats.movement.value).toBe(4)
      expect(buildPrimaryDisciplinePreview(input).derived).toEqual(result)
      expect(input.attributes).toEqual(core)
      expect(
        result.stats.maxHp.contributions.some((entry) => entry.sourceKind === 'modifier'),
      ).toBe(false)
    },
  )

  it('retains separate equipment contributions and current global caps without applying a retired Primary cap', () => {
    const result = calculateCharacterBuildDerivedStats({
      attributes: { might: 40, finesse: 40, vitality: 40, agility: 40, intellect: 40, resolve: 40 },
      level: 1,
      primaryDefinition: vanguard,
      primaryProfile: {
        disciplineId: 'vanguard',
        profileVersion: 1,
        statOffsets: { armor: 5 },
        statCaps: { armor: 50, accuracy: 9000 },
      },
      modifiers: [
        { sourceId: 'equipment.shield', statId: 'armor', amount: 3 },
        { sourceId: 'equipment.aim', statId: 'accuracy', amount: 9999 },
        { sourceId: 'equipment.evasion', statId: 'evasion', amount: 9999 },
        { sourceId: 'equipment.crit', statId: 'criticalChance', amount: 9999 },
        { sourceId: 'equipment.tempo', statId: 'initiative', amount: 9999 },
        { sourceId: 'equipment.mobility', statId: 'movement', amount: 5 },
        { sourceId: 'equipment.jump', statId: 'jump', amount: 5 },
        { sourceId: 'equipment.resistance', statId: 'statusResistance', amount: 9999 },
      ],
    })
    expect(result.stats.armor.value).toBe(123)
    expect(result.stats.armor.contributions.at(-1)).toMatchObject({
      sourceKind: 'modifier',
      sourceId: 'equipment.shield',
      inputValue: 3,
    })
    expect(result.stats.accuracy.value).toBe(14000)
    expect(result.stats.accuracy.unclampedValue).toBe(20999)
    expect(result.stats.evasion.value).toBe(5500)
    expect(result.stats.criticalChance.value).toBe(2000)
    expect(result.stats.initiative.value).toBe(120)
    expect(result.stats.movement.value).toBe(4)
    expect(result.stats.jump.value).toBe(3)
    expect(result.stats.statusResistance.value).toBe(1500)
  })

  it('keeps effective Primary Core bases as real curve inputs', () => {
    const result = calculateCharacterBuildDerivedStats({
      attributes: FOUNDATION_DISCIPLINES[0]!.baseAttributes,
      level: 1,
      primaryDefinition: vanguard,
      primaryProfile: { disciplineId: 'vanguard', profileVersion: 1, statOffsets: { maxHp: 20 } },
    })
    expect(result.stats.maxHp.value).toBe(94)
    expect(result.stats.physicalPower.value).toBe(54)
    expect(result.stats.ward.value).toBe(52)
  })

  it('uses the current derived-stat ruleset by default', () => {
    const result = calculateCharacterBuildDerivedStats({
      attributes,
      level: 1,
      primaryDefinition: vanguard,
      primaryProfile: { disciplineId: 'vanguard', profileVersion: 1, statOffsets: {} },
    })
    expect(result.rulesVersion).toBe(4)
  })

  it('is deterministic for the same versioned build inputs', () => {
    const input = {
      attributes,
      level: 10,
      primaryDefinition: vanguard,
      primaryProfile: {
        disciplineId: 'vanguard',
        profileVersion: 1,
        statOffsets: { maxHp: 20, armor: 5 },
      },
      modifiers: [{ sourceId: 'effect.test', statId: 'armor' as const, amount: 3 }],
    }
    expect(calculateCharacterBuildDerivedStats(input)).toEqual(
      calculateCharacterBuildDerivedStats(input),
    )
  })

  it('fails closed for disabled or mismatched Primary definitions', () => {
    expect(() =>
      calculateCharacterBuildDerivedStats({
        attributes,
        level: 1,
        primaryDefinition: { ...vanguard, enabledForPrimary: false },
        primaryProfile: { disciplineId: 'vanguard', profileVersion: 1, statOffsets: {} },
      }),
    ).toThrow('disabled')

    expect(() =>
      calculateCharacterBuildDerivedStats({
        attributes,
        level: 1,
        primaryDefinition: vanguard,
        primaryProfile: { disciplineId: 'aetherist', profileVersion: 1, statOffsets: {} },
      }),
    ).toThrow('mismatch')
  })

  it('preserves global clamps when Primary or other modifiers are applied', () => {
    const result = calculateCharacterBuildDerivedStats(
      {
        attributes,
        level: 1,
        primaryDefinition: vanguard,
        primaryProfile: {
          disciplineId: 'vanguard',
          profileVersion: 1,
          statOffsets: {
            accuracy: 10_000,
            evasion: 10_000,
            criticalChance: 10_000,
            movement: 10,
            jump: 10,
          },
        },
      },
      DERIVED_STAT_RULESET_V3,
    )
    expect(result.stats.accuracy.value).toBe(9500)
    expect(result.stats.evasion.value).toBe(1500)
    expect(result.stats.criticalChance.value).toBe(3000)
    expect(result.stats.movement.value).toBe(5)
    expect(result.stats.jump.value).toBe(3)
    expect(result.stats.accuracy.unclampedValue).toBeGreaterThan(9500)
  })

  it('uses the lower of the global maximum and a Primary-specific derived-stat cap', () => {
    const stricter = calculateCharacterBuildDerivedStats(
      {
        attributes,
        level: 1,
        primaryDefinition: vanguard,
        primaryProfile: {
          disciplineId: 'vanguard',
          profileVersion: 1,
          statOffsets: { accuracy: 10_000 },
          statCaps: { accuracy: 9000 },
        },
      },
      DERIVED_STAT_RULESET_V3,
    )
    const looser = calculateCharacterBuildDerivedStats(
      {
        attributes,
        level: 1,
        primaryDefinition: vanguard,
        primaryProfile: {
          disciplineId: 'vanguard',
          profileVersion: 1,
          statOffsets: { accuracy: 10_000 },
          statCaps: { accuracy: 9900 },
        },
      },
      DERIVED_STAT_RULESET_V3,
    )

    expect(stricter.stats.accuracy.value).toBe(9000)
    expect(looser.stats.accuracy.value).toBe(9500)
    expect(stricter.stats.accuracy.unclampedValue).toBeGreaterThan(9500)
  })

  it('allows a Primary cap on a derived stat with no global maximum', () => {
    const result = calculateCharacterBuildDerivedStats(
      {
        attributes,
        level: 10,
        primaryDefinition: vanguard,
        primaryProfile: {
          disciplineId: 'vanguard',
          profileVersion: 1,
          statOffsets: { maxHp: 500 },
          statCaps: { maxHp: 300 },
        },
      },
      DERIVED_STAT_RULESET_V3,
    )

    expect(result.stats.maxHp.unclampedValue).toBeGreaterThan(300)
    expect(result.stats.maxHp.value).toBe(300)
  })
})
