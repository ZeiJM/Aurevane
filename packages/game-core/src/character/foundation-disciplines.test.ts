import { describe, expect, it } from 'vitest'

import { CHARACTER_CREATION_RULES_V1 } from './creation'
import { FOUNDATION_DISCIPLINES } from './foundation-disciplines'

const expectedStartingBonuses = {
  vanguard: { might: 3, finesse: 0, vitality: 3, agility: 0, intellect: 0, resolve: 0 },
  farstrider: { might: 0, finesse: 4, vitality: 0, agility: 2, intellect: 0, resolve: 0 },
  shadehand: { might: 0, finesse: 2, vitality: 0, agility: 4, intellect: 0, resolve: 0 },
  ironfist: { might: 4, finesse: 0, vitality: 0, agility: 2, intellect: 0, resolve: 0 },
  aetherist: { might: 0, finesse: 0, vitality: 0, agility: 0, intellect: 4, resolve: 2 },
  lifebinder: { might: 0, finesse: 0, vitality: 0, agility: 0, intellect: 2, resolve: 4 },
} as const

describe('Foundation Discipline attribute identities', () => {
  it('keeps every recommended starter spread inside the shared six-point creation budget', () => {
    for (const discipline of FOUNDATION_DISCIPLINES) {
      const spent = Object.values(discipline.startingAttributeBonuses).reduce(
        (total, value) => total + value,
        0,
      )
      expect(spent).toBe(CHARACTER_CREATION_RULES_V1.attributes.bonusBudget)
      expect(discipline.startingAttributeBonuses).toEqual(expectedStartingBonuses[discipline.id])
    }
  })

  it('advertises the intended focus attributes without turning them into hard templates', () => {
    expect(FOUNDATION_DISCIPLINES.map(({ id, focusAttributes }) => [id, focusAttributes])).toEqual([
      ['vanguard', ['might', 'vitality']],
      ['farstrider', ['finesse', 'agility']],
      ['shadehand', ['finesse', 'agility']],
      ['ironfist', ['might', 'agility']],
      ['aetherist', ['intellect', 'resolve']],
      ['lifebinder', ['intellect', 'resolve']],
    ])
  })
})
