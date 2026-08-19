import { describe, expect, it } from 'vitest'

import { parseCharacterCreationPayload } from './character-creation'

function payload() {
  return {
    name: 'Arlen Vale',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.traveler-01',
    attributeBonuses: {
      might: 1,
      finesse: 1,
      vitality: 1,
      agility: 1,
      intellect: 1,
      resolve: 1,
    },
    foundationDisciplineId: 'vanguard',
  }
}

describe('character creation payload boundary', () => {
  it('accepts the strict transport shape without owning gameplay meaning', () => {
    expect(parseCharacterCreationPayload(payload())).toEqual(payload())
  })

  it('rejects unknown top-level fields', () => {
    expect(parseCharacterCreationPayload({ ...payload(), targetUserId: 'someone-else' })).toBeNull()
  })

  it('rejects missing or additional attribute keys', () => {
    expect(
      parseCharacterCreationPayload({
        ...payload(),
        attributeBonuses: {
          might: 1,
          finesse: 1,
          vitality: 1,
          agility: 1,
          intellect: 2,
        },
      }),
    ).toBeNull()
    expect(
      parseCharacterCreationPayload({
        ...payload(),
        attributeBonuses: {
          might: 1,
          finesse: 1,
          vitality: 1,
          agility: 1,
          intellect: 1,
          resolve: 1,
          luck: 0,
        },
      }),
    ).toBeNull()
  })

  it('rejects non-finite and non-numeric transport values', () => {
    expect(
      parseCharacterCreationPayload({
        ...payload(),
        attributeBonuses: { ...payload().attributeBonuses, might: Number.NaN },
      }),
    ).toBeNull()
    expect(
      parseCharacterCreationPayload({
        ...payload(),
        attributeBonuses: { ...payload().attributeBonuses, might: '1' },
      }),
    ).toBeNull()
  })
})
