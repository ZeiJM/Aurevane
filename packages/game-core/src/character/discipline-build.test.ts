import { describe, expect, it } from 'vitest'

import type { CharacterAttributes } from './creation'
import { calculateCharacterBuildDerivedStats } from './discipline-build'

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
} as const

it('adds the Primary base profile without mutating player-assigned attributes', () => {
  const before = { ...attributes }
  const result = calculateCharacterBuildDerivedStats({
    attributes,
    level: 10,
    primaryDefinition: vanguard,
    primaryProfile: {
      disciplineId: 'vanguard',
      profileVersion: 1,
      statOffsets: { maxHp: 20, armor: 5, initiative: -1 },
    },
  })

  expect(attributes).toEqual(before)
  expect(result.stats.maxHp.contributions.at(-1)).toMatchObject({
    sourceKind: 'modifier',
    sourceId: 'discipline.primary.vanguard.profile.1',
    inputValue: 20,
  })
})

describe('Primary Discipline build calculation', () => {
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

  it('preserves clamps when Primary or other modifiers are applied', () => {
    const result = calculateCharacterBuildDerivedStats({
      attributes,
      level: 1,
      primaryDefinition: vanguard,
      primaryProfile: {
        disciplineId: 'vanguard',
        profileVersion: 1,
        statOffsets: { accuracy: 10_000 },
      },
    })
    expect(result.stats.accuracy.value).toBe(9500)
    expect(result.stats.accuracy.unclampedValue).toBeGreaterThan(9500)
  })
})
