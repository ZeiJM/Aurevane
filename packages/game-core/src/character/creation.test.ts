import { describe, expect, it } from 'vitest'

import {
  buildCharacterCreationResult,
  buildInitialCharacterState,
  CHARACTER_ATTRIBUTE_IDS,
  CHARACTER_CREATION_RULES_V1,
  CharacterCreationRuleError,
  normalizeCharacterName,
  toCharacterNameKey,
  validateCharacterCreationIntent,
} from './creation'
import { FOUNDATION_DISCIPLINES } from './foundation-disciplines'

function validIntent() {
  return {
    name: 'Arlen Vale',
    presentationId: 'androgynous',
    pronounPresetId: 'they_them',
    portraitRef: 'portrait.starter.wayfarer-01',
    starterAppearanceRef: 'appearance.starter.traveler-01',
    attributeBonuses: {
      might: 1,
      finesse: 1,
      intellect: 1,
      resolve: 1,
    },
    foundationDisciplineId: 'vanguard',
  }
}

describe('character creation domain', () => {
  it('normalizes display names and produces a stable uniqueness key', () => {
    expect(normalizeCharacterName('  Élan   D’Arc  ')).toBe('Élan D’Arc')
    expect(toCharacterNameKey('  Élan   D’Arc  ')).toBe('élandarc')
    expect(toCharacterNameKey("Élan D'Arc")).toBe('élandarc')
  })

  it('rejects reserved names after Unicode compatibility normalization', () => {
    const validation = validateCharacterCreationIntent({
      ...validIntent(),
      name: 'Ａｕｒｅｖａｎｅ',
    })

    expect(validation.ok).toBe(false)
    if (!validation.ok) {
      expect(validation.issues.some((issue) => issue.code === 'name_reserved')).toBe(true)
    }
  })

  it('rejects unsupported characters and malformed separators in names', () => {
    for (const name of ['Rook7', '-Rook', 'Rook--Vale', 'Rook ✦ Vale']) {
      expect(validateCharacterCreationIntent({ ...validIntent(), name }).ok).toBe(false)
    }
  })

  it('rejects unsupported presentation and pronoun identifiers', () => {
    expect(
      validateCharacterCreationIntent({ ...validIntent(), presentationId: 'unsupported' }).ok,
    ).toBe(false)
    expect(
      validateCharacterCreationIntent({ ...validIntent(), pronounPresetId: 'unsupported' }).ok,
    ).toBe(false)
  })

  it('requires the exact configurable bonus budget', () => {
    const tooFew = validateCharacterCreationIntent({
      ...validIntent(),
      attributeBonuses: { might: 1, finesse: 1, intellect: 1, resolve: 0 },
    })
    const tooMany = validateCharacterCreationIntent({
      ...validIntent(),
      attributeBonuses: { might: 2, finesse: 2, intellect: 1, resolve: 0 },
    })

    expect(tooFew.ok).toBe(false)
    expect(tooMany.ok).toBe(false)
  })

  it('rejects invalid or unexpected attribute values', () => {
    const manipulated = [
      { might: -1, finesse: 1, intellect: 2, resolve: 2 },
      { might: 0.5, finesse: 1, intellect: 1, resolve: 1.5 },
      { might: 5, finesse: 0, intellect: 0, resolve: -1 },
      { might: 1, finesse: 1, intellect: 2 },
      { might: 1, finesse: 1, intellect: 1, resolve: 1, luck: 0 },
    ]

    for (const attributeBonuses of manipulated) {
      expect(validateCharacterCreationIntent({ ...validIntent(), attributeBonuses }).ok).toBe(false)
    }
  })

  it('never allows creation choices to lower an attribute below the shared baseline', () => {
    const character = buildInitialCharacterState({
      ...validIntent(),
      attributeBonuses: { might: 4, finesse: 0, intellect: 0, resolve: 0 },
    })

    expect(character.attributes.might).toBe(9)
    for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
      expect(character.attributes[attributeId]).toBeGreaterThanOrEqual(
        CHARACTER_CREATION_RULES_V1.attributes.baseline,
      )
    }
  })

  it('references all six Foundation Disciplines without implementing Discipline gameplay', () => {
    expect(FOUNDATION_DISCIPLINES).toHaveLength(6)

    for (const discipline of FOUNDATION_DISCIPLINES) {
      const character = buildInitialCharacterState({
        ...validIntent(),
        foundationDisciplineId: discipline.id,
      })
      expect(character.foundationDisciplineId).toBe(discipline.id)
    }
  })

  it('rejects invented Foundation Discipline identifiers', () => {
    expect(
      validateCharacterCreationIntent({
        ...validIntent(),
        foundationDisciplineId: 'unsupported',
      }).ok,
    ).toBe(false)
  })

  it('requires category-correct stable portrait and appearance references', () => {
    expect(
      validateCharacterCreationIntent({ ...validIntent(), portraitRef: 'invalid-ref' }).ok,
    ).toBe(false)
    expect(
      validateCharacterCreationIntent({ ...validIntent(), starterAppearanceRef: 'invalid-ref' }).ok,
    ).toBe(false)
    expect(
      validateCharacterCreationIntent({
        ...validIntent(),
        portraitRef: 'appearance.starter.traveler-01',
      }).ok,
    ).toBe(false)
    expect(
      validateCharacterCreationIntent({
        ...validIntent(),
        starterAppearanceRef: 'portrait.starter.wayfarer-01',
      }).ok,
    ).toBe(false)
  })

  it('builds deterministic canonical level-1 seed state', () => {
    const first = buildInitialCharacterState(validIntent())
    const second = buildInitialCharacterState(validIntent())

    expect(first).toEqual(second)
    expect(first).toMatchObject({
      rulesVersion: 1,
      name: 'Arlen Vale',
      nameKey: 'arlenvale',
      level: 1,
      xp: 0,
      progressionCycle: { number: 1 },
    })
  })

  it('reconstructs authoritative progression instead of trusting extra input fields', () => {
    const character = buildInitialCharacterState({
      ...validIntent(),
      level: 100,
      xp: 999_999_999,
      progressionCycle: { number: 99 },
    })

    expect(character.level).toBe(1)
    expect(character.xp).toBe(0)
    expect(character.progressionCycle).toEqual({ number: 1 })
  })

  it('rejects unsupported creation command versions', () => {
    expect(() => buildCharacterCreationResult({ version: 2, intent: validIntent() })).toThrowError(
      CharacterCreationRuleError,
    )
  })

  it('wraps a valid seed in the versioned creation result contract', () => {
    const result = buildCharacterCreationResult({ version: 1, intent: validIntent() })

    expect(result.version).toBe(1)
    expect(result.character.nameKey).toBe('arlenvale')
  })
})
