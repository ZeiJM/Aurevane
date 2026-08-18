import { isFoundationDisciplineId, type FoundationDisciplineId } from './foundation-disciplines'

export const CHARACTER_ATTRIBUTE_IDS = [
  'might',
  'finesse',
  'vitality',
  'agility',
  'intellect',
  'resolve',
] as const
export type CharacterAttributeId = (typeof CHARACTER_ATTRIBUTE_IDS)[number]
export type CharacterAttributeBonuses = Record<CharacterAttributeId, number>
export type CharacterAttributes = Record<CharacterAttributeId, number>

export const CHARACTER_PRESENTATIONS = [
  { id: 'masculine', label: 'Masculine' },
  { id: 'feminine', label: 'Feminine' },
  { id: 'androgynous', label: 'Androgynous' },
] as const
export type CharacterPresentationId = (typeof CHARACTER_PRESENTATIONS)[number]['id']

export const PRONOUN_PRESETS = [
  {
    id: 'he_him',
    label: 'He / Him',
    subject: 'he',
    object: 'him',
    possessiveAdjective: 'his',
    possessivePronoun: 'his',
    reflexive: 'himself',
  },
  {
    id: 'she_her',
    label: 'She / Her',
    subject: 'she',
    object: 'her',
    possessiveAdjective: 'her',
    possessivePronoun: 'hers',
    reflexive: 'herself',
  },
  {
    id: 'they_them',
    label: 'They / Them',
    subject: 'they',
    object: 'them',
    possessiveAdjective: 'their',
    possessivePronoun: 'theirs',
    reflexive: 'themself',
  },
] as const
export type PronounPresetId = (typeof PRONOUN_PRESETS)[number]['id']

export type CharacterPortraitRef = `portrait.${string}`
export type StarterAppearanceRef = `appearance.${string}`

export const CHARACTER_CREATION_RULES_V1 = {
  version: 1,
  name: {
    minimumCodePoints: 3,
    maximumCodePoints: 24,
  },
  attributes: {
    baseline: 5,
    bonusBudget: 6,
    maximumBonusPerAttribute: 4,
  },
  initialProgression: {
    level: 1,
    xp: 0,
    cycleNumber: 1,
  },
} as const

const presentationIds = new Set<string>(CHARACTER_PRESENTATIONS.map((entry) => entry.id))
const pronounPresetIds = new Set<string>(PRONOUN_PRESETS.map((entry) => entry.id))
const reservedCharacterNameKeys = new Set([
  'admin',
  'administrator',
  'aurevane',
  'developer',
  'gamemaster',
  'gm',
  'moderator',
  'owner',
  'staff',
  'support',
  'system',
])

const characterNamePattern = /^\p{L}[\p{L}\p{M}]*(?:[ '\u2019-]\p{L}[\p{L}\p{M}]*)*$/u
const characterNameSeparatorPattern = /[ '\u2019-]/gu
const contentReferencePattern = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
const maximumContentReferenceLength = 80

export interface CharacterCreationIntent {
  name: string
  presentationId: string
  pronounPresetId: string
  portraitRef: string
  starterAppearanceRef: string
  attributeBonuses: CharacterAttributeBonuses
  foundationDisciplineId: string
}

export interface CanonicalCharacterCreationIntent {
  name: string
  nameKey: string
  presentationId: CharacterPresentationId
  pronounPresetId: PronounPresetId
  portraitRef: CharacterPortraitRef
  starterAppearanceRef: StarterAppearanceRef
  attributeBonuses: CharacterAttributeBonuses
  foundationDisciplineId: FoundationDisciplineId
}

export interface InitialCharacterStateV1 {
  rulesVersion: 1
  name: string
  nameKey: string
  presentationId: CharacterPresentationId
  pronounPresetId: PronounPresetId
  portraitRef: CharacterPortraitRef
  starterAppearanceRef: StarterAppearanceRef
  foundationDisciplineId: FoundationDisciplineId
  attributes: CharacterAttributes
  level: 1
  xp: 0
  progressionCycle: {
    number: 1
  }
}

export interface CharacterCreationCommandV1 {
  version: 1
  intent: CharacterCreationIntent
}

export interface CharacterCreationResultV1 {
  version: 1
  character: InitialCharacterStateV1
}

export type CharacterCreationRuleIssueCode =
  | 'invalid_shape'
  | 'invalid_name_type'
  | 'name_length'
  | 'name_characters'
  | 'name_reserved'
  | 'invalid_presentation'
  | 'invalid_pronouns'
  | 'invalid_portrait_ref'
  | 'invalid_appearance_ref'
  | 'invalid_attribute_shape'
  | 'invalid_attribute_bonus'
  | 'attribute_budget_mismatch'
  | 'invalid_foundation_discipline'
  | 'unsupported_command_version'

export interface CharacterCreationRuleIssue {
  code: CharacterCreationRuleIssueCode
  field: string
  message: string
}

export type CharacterCreationValidationResult =
  | { ok: true; value: CanonicalCharacterCreationIntent }
  | { ok: false; issues: readonly CharacterCreationRuleIssue[] }

export class CharacterCreationRuleError extends Error {
  readonly issues: readonly CharacterCreationRuleIssue[]

  constructor(issues: readonly CharacterCreationRuleIssue[]) {
    super('Character creation intent violates the active rules.')
    this.name = 'CharacterCreationRuleError'
    this.issues = issues
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPresentationId(value: string): value is CharacterPresentationId {
  return presentationIds.has(value)
}

function isPronounPresetId(value: string): value is PronounPresetId {
  return pronounPresetIds.has(value)
}

function isContentReference(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximumContentReferenceLength &&
    contentReferencePattern.test(value)
  )
}

function isCharacterPortraitRef(value: unknown): value is CharacterPortraitRef {
  return isContentReference(value) && value.startsWith('portrait.')
}

function isStarterAppearanceRef(value: unknown): value is StarterAppearanceRef {
  return isContentReference(value) && value.startsWith('appearance.')
}

export function normalizeCharacterName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
}

export function toCharacterNameKey(value: string): string {
  return normalizeCharacterName(value).toLowerCase().replace(characterNameSeparatorPattern, '')
}

function validateAttributeBonuses(
  value: unknown,
  issues: CharacterCreationRuleIssue[],
): CharacterAttributeBonuses | null {
  if (!isRecord(value)) {
    issues.push({
      code: 'invalid_attribute_shape',
      field: 'attributeBonuses',
      message: 'Attribute bonuses must provide Might, Finesse, Vitality, Agility, Intellect, and Resolve.',
    })
    return null
  }

  const allowedKeys = new Set<string>(CHARACTER_ATTRIBUTE_IDS)
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.has(key))
  if (unexpectedKeys.length > 0) {
    issues.push({
      code: 'invalid_attribute_shape',
      field: 'attributeBonuses',
      message: 'Attribute bonuses contain an unknown attribute.',
    })
  }

  const bonuses: Partial<CharacterAttributeBonuses> = {}
  let bonusValuesAreValid = true

  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const bonus = value[attributeId]
    if (
      typeof bonus !== 'number' ||
      !Number.isInteger(bonus) ||
      bonus < 0 ||
      bonus > CHARACTER_CREATION_RULES_V1.attributes.maximumBonusPerAttribute
    ) {
      bonusValuesAreValid = false
      issues.push({
        code: 'invalid_attribute_bonus',
        field: `attributeBonuses.${attributeId}`,
        message: `${attributeId} bonus must be a whole number from 0 to ${CHARACTER_CREATION_RULES_V1.attributes.maximumBonusPerAttribute}.`,
      })
      continue
    }

    bonuses[attributeId] = bonus
  }

  if (!bonusValuesAreValid || unexpectedKeys.length > 0) {
    return null
  }

  const canonicalBonuses = bonuses as CharacterAttributeBonuses
  const spent = CHARACTER_ATTRIBUTE_IDS.reduce(
    (total, attributeId) => total + canonicalBonuses[attributeId],
    0,
  )

  if (spent !== CHARACTER_CREATION_RULES_V1.attributes.bonusBudget) {
    issues.push({
      code: 'attribute_budget_mismatch',
      field: 'attributeBonuses',
      message: `Exactly ${CHARACTER_CREATION_RULES_V1.attributes.bonusBudget} starting attribute points must be assigned.`,
    })
    return null
  }

  return canonicalBonuses
}

export function validateCharacterCreationIntent(input: unknown): CharacterCreationValidationResult {
  const issues: CharacterCreationRuleIssue[] = []

  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid_shape',
          field: 'intent',
          message: 'Character creation intent must be an object.',
        },
      ],
    }
  }

  let normalizedName = ''
  let nameKey = ''
  if (typeof input.name !== 'string') {
    issues.push({
      code: 'invalid_name_type',
      field: 'name',
      message: 'Character name must be text.',
    })
  } else {
    normalizedName = normalizeCharacterName(input.name)
    nameKey = toCharacterNameKey(normalizedName)
    const codePointLength = Array.from(normalizedName).length

    if (
      codePointLength < CHARACTER_CREATION_RULES_V1.name.minimumCodePoints ||
      codePointLength > CHARACTER_CREATION_RULES_V1.name.maximumCodePoints
    ) {
      issues.push({
        code: 'name_length',
        field: 'name',
        message: `Character name must be ${CHARACTER_CREATION_RULES_V1.name.minimumCodePoints}-${CHARACTER_CREATION_RULES_V1.name.maximumCodePoints} characters after normalization.`,
      })
    }

    if (!characterNamePattern.test(normalizedName)) {
      issues.push({
        code: 'name_characters',
        field: 'name',
        message:
          'Character name may contain letters plus single spaces, apostrophes, or hyphens between name parts.',
      })
    }

    if (reservedCharacterNameKeys.has(nameKey)) {
      issues.push({
        code: 'name_reserved',
        field: 'name',
        message: 'That character name is reserved.',
      })
    }
  }

  const presentationId = input.presentationId
  if (typeof presentationId !== 'string' || !isPresentationId(presentationId)) {
    issues.push({
      code: 'invalid_presentation',
      field: 'presentationId',
      message: 'Choose one supported character presentation.',
    })
  }

  const pronounPresetId = input.pronounPresetId
  if (typeof pronounPresetId !== 'string' || !isPronounPresetId(pronounPresetId)) {
    issues.push({
      code: 'invalid_pronouns',
      field: 'pronounPresetId',
      message: 'Choose one supported pronoun preset.',
    })
  }

  if (!isCharacterPortraitRef(input.portraitRef)) {
    issues.push({
      code: 'invalid_portrait_ref',
      field: 'portraitRef',
      message: 'Portrait selection must use a stable portrait content reference.',
    })
  }

  if (!isStarterAppearanceRef(input.starterAppearanceRef)) {
    issues.push({
      code: 'invalid_appearance_ref',
      field: 'starterAppearanceRef',
      message: 'Starter appearance must use a stable appearance content reference.',
    })
  }

  const attributeBonuses = validateAttributeBonuses(input.attributeBonuses, issues)

  const foundationDisciplineId = input.foundationDisciplineId
  if (
    typeof foundationDisciplineId !== 'string' ||
    !isFoundationDisciplineId(foundationDisciplineId)
  ) {
    issues.push({
      code: 'invalid_foundation_discipline',
      field: 'foundationDisciplineId',
      message: 'Choose one of the six Disciplines.',
    })
  }

  if (issues.length > 0 || attributeBonuses === null) {
    return { ok: false, issues }
  }

  return {
    ok: true,
    value: {
      name: normalizedName,
      nameKey,
      presentationId: presentationId as CharacterPresentationId,
      pronounPresetId: pronounPresetId as PronounPresetId,
      portraitRef: input.portraitRef as CharacterPortraitRef,
      starterAppearanceRef: input.starterAppearanceRef as StarterAppearanceRef,
      attributeBonuses,
      foundationDisciplineId: foundationDisciplineId as FoundationDisciplineId,
    },
  }
}

export function buildInitialCharacterState(input: unknown): InitialCharacterStateV1 {
  const validation = validateCharacterCreationIntent(input)
  if (!validation.ok) {
    throw new CharacterCreationRuleError(validation.issues)
  }

  const attributes = Object.fromEntries(
    CHARACTER_ATTRIBUTE_IDS.map((attributeId) => [
      attributeId,
      CHARACTER_CREATION_RULES_V1.attributes.baseline +
        validation.value.attributeBonuses[attributeId],
    ]),
  ) as CharacterAttributes

  return {
    rulesVersion: CHARACTER_CREATION_RULES_V1.version,
    name: validation.value.name,
    nameKey,
    presentationId: validation.value.presentationId,
    pronounPresetId: validation.value.pronounPresetId,
    portraitRef: validation.value.portraitRef,
    starterAppearanceRef: validation.value.starterAppearanceRef,
    foundationDisciplineId: validation.value.foundationDisciplineId,
    attributes,
    level: CHARACTER_CREATION_RULES_V1.initialProgression.level,
    xp: CHARACTER_CREATION_RULES_V1.initialProgression.xp,
    progressionCycle: {
      number: CHARACTER_CREATION_RULES_V1.initialProgression.cycleNumber,
    },
  }
}

export function buildCharacterCreationResult(command: unknown): CharacterCreationResultV1 {
  if (!isRecord(command) || command.version !== 1 || !('intent' in command)) {
    throw new CharacterCreationRuleError([
      {
        code: 'unsupported_command_version',
        field: 'version',
        message: 'Character creation command version is not supported.',
      },
    ])
  }

  return {
    version: 1,
    character: buildInitialCharacterState(command.intent),
  }
}
