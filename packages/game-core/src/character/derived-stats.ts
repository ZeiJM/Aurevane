import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from './creation'

export const DERIVED_STAT_IDS = [
  'maxHp',
  'maxMp',
  'physicalPower',
  'mysticPower',
  'armor',
  'ward',
  'accuracy',
  'evasion',
  'criticalChance',
  'initiative',
  'movement',
  'jump',
  'statusResistance',
] as const

export type DerivedStatId = (typeof DERIVED_STAT_IDS)[number]
export type DerivedStatUnit = 'points' | 'rating' | 'basisPoints' | 'steps' | 'height'
export type DerivedStatSourceKind = 'base' | 'level' | 'attribute' | 'modifier'

export interface DerivedStatRule {
  id: DerivedStatId
  label: string
  unit: DerivedStatUnit
  baseNumerator: number
  perLevelNumerator: number
  attributeWeights: Partial<Record<CharacterAttributeId, number>>
  divisor: number
  minimum?: number
  maximum?: number
}

export interface DerivedStatRuleset {
  version: number
  rules: readonly DerivedStatRule[]
}

export interface DerivedStatContribution {
  sourceKind: DerivedStatSourceKind
  sourceId: string
  inputValue: number
  coefficient: number
  numeratorAmount: number
}

export interface DerivedStatValue {
  id: DerivedStatId
  label: string
  unit: DerivedStatUnit
  value: number
  unclampedValue: number
  divisor: number
  contributions: readonly DerivedStatContribution[]
}

export interface DerivedStatSnapshot {
  rulesVersion: number
  stats: Readonly<Record<DerivedStatId, DerivedStatValue>>
}

export interface DerivedStatInput {
  attributes: CharacterAttributes
  level: number
}

export interface DerivedStatRulesetIssue {
  field: string
  message: string
}

/**
 * PV-1G six-attribute development balance. Every core attribute contributes to multiple
 * meaningful derived statistics so no attribute exists only as a cosmetic character-sheet value.
 */
export const DERIVED_STAT_RULESET_V2: DerivedStatRuleset = {
  version: 2,
  rules: [
    {
      id: 'maxHp',
      label: 'Maximum HP',
      unit: 'points',
      baseNumerator: 70,
      perLevelNumerator: 5,
      attributeWeights: { vitality: 10, might: 2, resolve: 2 },
      divisor: 1,
      minimum: 1,
    },
    {
      id: 'maxMp',
      label: 'Maximum MP',
      unit: 'points',
      baseNumerator: 24,
      perLevelNumerator: 3,
      attributeWeights: { intellect: 7, insight: 4, resolve: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'physicalPower',
      label: 'Physical Power',
      unit: 'rating',
      baseNumerator: 10,
      perLevelNumerator: 1,
      attributeWeights: { might: 3, finesse: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'mysticPower',
      label: 'Mystic Power',
      unit: 'rating',
      baseNumerator: 10,
      perLevelNumerator: 1,
      attributeWeights: { intellect: 3, insight: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'armor',
      label: 'Armor',
      unit: 'rating',
      baseNumerator: 5,
      perLevelNumerator: 1,
      attributeWeights: { vitality: 2, might: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'ward',
      label: 'Ward',
      unit: 'rating',
      baseNumerator: 5,
      perLevelNumerator: 1,
      attributeWeights: { resolve: 2, intellect: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'accuracy',
      label: 'Accuracy',
      unit: 'basisPoints',
      baseNumerator: 6200,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 90, insight: 70 },
      divisor: 1,
      minimum: 0,
      maximum: 9500,
    },
    {
      id: 'evasion',
      label: 'Evasion',
      unit: 'basisPoints',
      baseNumerator: 250,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 70, insight: 30 },
      divisor: 1,
      minimum: 0,
      maximum: 7500,
    },
    {
      id: 'criticalChance',
      label: 'Critical Chance',
      unit: 'basisPoints',
      baseNumerator: 450,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 35, insight: 25 },
      divisor: 1,
      minimum: 0,
      maximum: 5000,
    },
    {
      id: 'initiative',
      label: 'Initiative',
      unit: 'rating',
      baseNumerator: 10,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 1, insight: 2 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'movement',
      label: 'Movement',
      unit: 'steps',
      baseNumerator: 40,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 1 },
      divisor: 10,
      minimum: 4,
      maximum: 8,
    },
    {
      id: 'jump',
      label: 'Jump',
      unit: 'height',
      baseNumerator: 20,
      perLevelNumerator: 0,
      attributeWeights: { might: 1, finesse: 1 },
      divisor: 20,
      minimum: 1,
      maximum: 4,
    },
    {
      id: 'statusResistance',
      label: 'Status Resistance',
      unit: 'basisPoints',
      baseNumerator: 0,
      perLevelNumerator: 0,
      attributeWeights: { resolve: 70, vitality: 30 },
      divisor: 1,
      minimum: 0,
      maximum: 7500,
    },
  ],
}

/** Backward-compatible export name for callers that have not yet renamed their import. */
export const DERIVED_STAT_RULESET_V1 = DERIVED_STAT_RULESET_V2

export function validateDerivedStatRuleset(
  ruleset: DerivedStatRuleset,
): readonly DerivedStatRulesetIssue[] {
  const issues: DerivedStatRulesetIssue[] = []

  if (!Number.isInteger(ruleset.version) || ruleset.version <= 0) {
    issues.push({ field: 'version', message: 'Ruleset version must be a positive integer.' })
  }

  const seen = new Set<DerivedStatId>()
  for (const [index, rule] of ruleset.rules.entries()) {
    const prefix = `rules.${index}`

    if (seen.has(rule.id)) {
      issues.push({ field: `${prefix}.id`, message: `Duplicate derived stat id: ${rule.id}.` })
    }
    seen.add(rule.id)

    if (!rule.label.trim()) {
      issues.push({ field: `${prefix}.label`, message: 'Derived stat label is required.' })
    }

    if (!Number.isInteger(rule.baseNumerator)) {
      issues.push({ field: `${prefix}.baseNumerator`, message: 'Base numerator must be an integer.' })
    }

    if (!Number.isInteger(rule.perLevelNumerator)) {
      issues.push({
        field: `${prefix}.perLevelNumerator`,
        message: 'Per-level numerator must be an integer.',
      })
    }

    if (!Number.isInteger(rule.divisor) || rule.divisor <= 0) {
      issues.push({ field: `${prefix}.divisor`, message: 'Divisor must be a positive integer.' })
    }

    if (rule.minimum !== undefined && !Number.isInteger(rule.minimum)) {
      issues.push({ field: `${prefix}.minimum`, message: 'Minimum must be an integer.' })
    }

    if (rule.maximum !== undefined && !Number.isInteger(rule.maximum)) {
      issues.push({ field: `${prefix}.maximum`, message: 'Maximum must be an integer.' })
    }

    if (rule.minimum !== undefined && rule.maximum !== undefined && rule.minimum > rule.maximum) {
      issues.push({ field: prefix, message: 'Minimum cannot exceed maximum.' })
    }

    for (const [attributeId, weight] of Object.entries(rule.attributeWeights)) {
      if (!CHARACTER_ATTRIBUTE_IDS.includes(attributeId as CharacterAttributeId)) {
        issues.push({
          field: `${prefix}.attributeWeights.${attributeId}`,
          message: 'Unknown character attribute.',
        })
      }
      if (!Number.isInteger(weight)) {
        issues.push({
          field: `${prefix}.attributeWeights.${attributeId}`,
          message: 'Attribute weight must be an integer.',
        })
      }
    }
  }

  for (const id of DERIVED_STAT_IDS) {
    if (!seen.has(id)) issues.push({ field: 'rules', message: `Missing derived stat rule: ${id}.` })
  }

  return issues
}

export function calculateDerivedStats(
  input: DerivedStatInput,
  ruleset: DerivedStatRuleset = DERIVED_STAT_RULESET_V2,
): DerivedStatSnapshot {
  const issues = validateDerivedStatRuleset(ruleset)
  if (issues.length > 0) {
    throw new Error(`Invalid derived-stat ruleset: ${issues[0].field}: ${issues[0].message}`)
  }

  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 100) {
    throw new RangeError('Character level must be a whole number from 1 to 100.')
  }

  for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
    const value = input.attributes[attributeId]
    if (!Number.isInteger(value) || value < 1) {
      throw new RangeError(`${attributeId} must be a positive whole number.`)
    }
  }

  const stats = {} as Record<DerivedStatId, DerivedStatValue>

  for (const rule of ruleset.rules) {
    const contributions: DerivedStatContribution[] = [
      {
        sourceKind: 'base',
        sourceId: `derived.${rule.id}.base`,
        inputValue: 1,
        coefficient: rule.baseNumerator,
        numeratorAmount: rule.baseNumerator,
      },
    ]

    if (rule.perLevelNumerator !== 0) {
      const levelSteps = input.level - 1
      contributions.push({
        sourceKind: 'level',
        sourceId: 'character.level',
        inputValue: levelSteps,
        coefficient: rule.perLevelNumerator,
        numeratorAmount: levelSteps * rule.perLevelNumerator,
      })
    }

    for (const attributeId of CHARACTER_ATTRIBUTE_IDS) {
      const coefficient = rule.attributeWeights[attributeId]
      if (coefficient === undefined || coefficient === 0) continue

      contributions.push({
        sourceKind: 'attribute',
        sourceId: `character.attribute.${attributeId}`,
        inputValue: input.attributes[attributeId],
        coefficient,
        numeratorAmount: input.attributes[attributeId] * coefficient,
      })
    }

    const numerator = contributions.reduce(
      (total, contribution) => total + contribution.numeratorAmount,
      0,
    )
    const unclampedValue = Math.floor(numerator / rule.divisor)
    const value = clamp(unclampedValue, rule.minimum, rule.maximum)

    stats[rule.id] = {
      id: rule.id,
      label: rule.label,
      unit: rule.unit,
      value,
      unclampedValue,
      divisor: rule.divisor,
      contributions,
    }
  }

  return { rulesVersion: ruleset.version, stats }
}

function clamp(value: number, minimum: number | undefined, maximum: number | undefined): number {
  let result = value
  if (minimum !== undefined) result = Math.max(result, minimum)
  if (maximum !== undefined) result = Math.min(result, maximum)
  return result
}
