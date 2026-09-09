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
  type CharacterCreationCommandV1,
  type CharacterCreationIntent,
} from './creation'
import { FOUNDATION_DISCIPLINES, getFoundationDiscipline } from './foundation-disciplines'

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
      vitality: 1,
      agility: 1,
      intellect: 1,
      resolve: 0,
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

  it('requires the exact configurable five-point personal budget', () => {
    expect(CHARACTER_CREATION_RULES_V1.attributes.bonusBudget).toBe(5)
    const tooFew = validateCharacterCreationIntent({
      ...validIntent(),
      attributeBonuses: {
        might: 1,
        finesse: 1,
        vitality: 1,
        agility: 1,
        intellect: 0,
        resolve: 0,
      },
    })
    const tooMany = validateCharacterCreationIntent({
      ...validIntent(),
      attributeBonuses: {
        might: 2,
        finesse: 1,
        vitality: 1,
        agility: 1,
        intellect: 1,
        resolve: 0,
      },
    })

    expect(tooFew.ok).toBe(false)
    expect(tooMany.ok).toBe(false)
  })

  it('allows the full five-point personal budget to be placed into one attribute', () => {
    const input = {
      ...validIntent(),
      attributeBonuses: {
        might: 5,
        finesse: 0,
        vitality: 0,
        agility: 0,
        intellect: 0,
        resolve: 0,
      },
    }
    expect(validateCharacterCreationIntent(input).ok).toBe(true)

    const character = buildInitialCharacterState(input)
    expect(character.attributes.might).toBe(12)
    expect(character.attributes.finesse).toBe(4)
  })

  it('rejects invalid, missing, or unexpected personal attribute values', () => {
    const manipulated = [
      { might: -1, finesse: 1, vitality: 1, agility: 1, intellect: 2, resolve: 1 },
      { might: 0.5, finesse: 1, vitality: 1, agility: 1, intellect: 1, resolve: 0.5 },
      { might: 6, finesse: 0, vitality: 0, agility: 0, intellect: 0, resolve: -1 },
      { might: 1, finesse: 1, vitality: 1, agility: 1, intellect: 1 },
      { might: 1, finesse: 1, vitality: 1, agility: 1, intellect: 1, resolve: 0, luck: 0 },
    ]

    for (const attributeBonuses of manipulated) {
      expect(validateCharacterCreationIntent({ ...validIntent(), attributeBonuses }).ok).toBe(false)
    }
  })

  it('layers personal choices on top of the chosen Discipline base without rewriting it', () => {
    const discipline = getFoundationDiscipline('vanguard')!
    const character = buildInitialCharacterState({
      ...validIntent(),
      attributeBonuses: {
        might: 4,
        finesse: 0,
        vitality: 1,
        agility: 0,
        intellect: 0,
        resolve: 0,
      },
    })

    expect(character.attributes.might).toBe(discipline.baseAttributes.might + 4)
    for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
      expect(character.attributes[attributeId]).toBeGreaterThanOrEqual(
        discipline.baseAttributes[attributeId],
      )
    }
  })

  it('produces a distinct Level-1 Core Stat identity for every starter Discipline', () => {
    expect(FOUNDATION_DISCIPLINES).toHaveLength(6)
    const fingerprints = new Set<string>()

    for (const discipline of FOUNDATION_DISCIPLINES) {
      const character = buildInitialCharacterState({
        ...validIntent(),
        foundationDisciplineId: discipline.id,
        attributeBonuses: { ...discipline.startingAttributeBonuses },
      })
      expect(character.foundationDisciplineId).toBe(discipline.id)
      expect(Object.values(character.attributes).reduce((total, value) => total + value, 0)).toBe(
        36,
      )
      fingerprints.add(JSON.stringify(character.attributes))
    }
    expect(fingerprints.size).toBe(6)
  })

  it('rejects invented Discipline identifiers', () => {
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

  it('builds deterministic canonical Level-1 state from Vanguard base plus five personal points', () => {
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
    expect(first.attributes).toEqual({
      might: 8,
      finesse: 5,
      vitality: 8,
      agility: 5,
      intellect: 4,
      resolve: 6,
    })
  })

  it('reconstructs authoritative progression instead of trusting extra input fields', () => {
    const untrustedIntent = {
      ...validIntent(),
      level: 100,
      xp: 999_999_999,
      progressionCycle: { number: 99 },
    } as unknown as CharacterCreationIntent
    const character = buildInitialCharacterState(untrustedIntent)

    expect(character.level).toBe(1)
    expect(character.xp).toBe(0)
    expect(character.progressionCycle).toEqual({ number: 1 })
  })

  it('rejects unsupported creation command versions', () => {
    const unsupportedCommand = {
      version: 2,
      intent: validIntent(),
    } as unknown as CharacterCreationCommandV1
    expect(() => buildCharacterCreationResult(unsupportedCommand)).toThrowError(
      CharacterCreationRuleError,
    )
  })

  it('wraps a valid seed in the versioned creation result contract', () => {
    const result = buildCharacterCreationResult({ version: 1, intent: validIntent() })

    expect(result.version).toBe(1)
    expect(result.character.nameKey).toBe('arlenvale')
  })
})
