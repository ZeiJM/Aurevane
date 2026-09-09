import { describe, expect, it } from 'vitest'

import { CHARACTER_CREATION_RULES_V1 } from './creation'
import {
  FOUNDATION_DISCIPLINES,
  FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL,
} from './foundation-disciplines'

const expectedBases = {
  vanguard: { might: 7, finesse: 4, vitality: 7, agility: 4, intellect: 3, resolve: 6 },
  farstrider: { might: 3, finesse: 8, vitality: 4, agility: 8, intellect: 4, resolve: 4 },
  shadehand: { might: 3, finesse: 7, vitality: 3, agility: 8, intellect: 6, resolve: 4 },
  ironfist: { might: 8, finesse: 4, vitality: 5, agility: 8, intellect: 2, resolve: 4 },
  aetherist: { might: 2, finesse: 3, vitality: 4, agility: 3, intellect: 10, resolve: 9 },
  lifebinder: { might: 2, finesse: 3, vitality: 6, agility: 3, intellect: 8, resolve: 9 },
} as const

describe('Foundation Discipline attribute identities', () => {
  it('gives every Foundation Discipline a unique fixed 31-point base profile', () => {
    const fingerprints = new Set<string>()
    for (const discipline of FOUNDATION_DISCIPLINES) {
      const spent = Object.values(discipline.baseAttributes).reduce<number>(
        (total, value) => total + value,
        0,
      )
      expect(spent).toBe(FOUNDATION_DISCIPLINE_BASE_ATTRIBUTE_TOTAL)
      expect(discipline.baseAttributes).toEqual(expectedBases[discipline.id])
      expect(Object.values(discipline.baseAttributes).every((value) => value >= 1)).toBe(true)
      fingerprints.add(JSON.stringify(discipline.baseAttributes))
    }
    expect(fingerprints.size).toBe(FOUNDATION_DISCIPLINES.length)
  })

  it('keeps the five personal creation points separate from the Discipline base', () => {
    for (const discipline of FOUNDATION_DISCIPLINES) {
      const spent = Object.values(discipline.startingAttributeBonuses).reduce<number>(
        (total, value) => total + value,
        0,
      )
      expect(spent).toBe(CHARACTER_CREATION_RULES_V1.attributes.bonusBudget)
    }
  })

  it('supports both two-stat and three-stat class identities', () => {
    expect(FOUNDATION_DISCIPLINES.map(({ id, focusAttributes }) => [id, focusAttributes])).toEqual([
      ['vanguard', ['might', 'vitality', 'resolve']],
      ['farstrider', ['finesse', 'agility']],
      ['shadehand', ['finesse', 'agility', 'intellect']],
      ['ironfist', ['might', 'agility']],
      ['aetherist', ['intellect', 'resolve']],
      ['lifebinder', ['intellect', 'resolve', 'vitality']],
    ])

    const focusCounts = new Set(FOUNDATION_DISCIPLINES.map((entry) => entry.focusAttributes.length))
    expect(focusCounts).toEqual(new Set([2, 3]))
  })
})
