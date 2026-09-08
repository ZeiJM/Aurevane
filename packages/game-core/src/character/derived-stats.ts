import {
  CHARACTER_ATTRIBUTE_IDS,
  type CharacterAttributeId,
  type CharacterAttributes,
} from './creation'
import { CURRENT_LEVEL_CAP } from './progression'

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
 * Development balance for the universal six-attribute framework.
 *
 * Global percentage and mobility ceilings are hard gameplay guardrails. Primary Discipline identity
 * and player-assigned attributes may change the route to those ceilings, but cannot exceed them.
 */
export const DERIVED_STAT_RULESET_V1: DerivedStatRuleset = {
  version: 1,
  rules: [
    {
      id: 'maxHp',
      label: 'Maximum HP',
      unit: 'points',
      baseNumerator: 80,
      perLevelNumerator: 5,
      attributeWeights: { might: 2, vitality: 12 },
      divisor: 1,
      minimum: 1,
    },
    {
      id: 'maxMp',
      label: 'Maximum MP',
      unit: 'points',
      baseNumerator: 30,
      perLevelNumerator: 3,
      attributeWeights: { intellect: 8, resolve: 2 },
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
      attributeWeights: { intellect: 3, resolve: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'armor',
      label: 'Armor',
      unit: 'rating',
      baseNumerator: 5,
      perLevelNumerator: 1,
      attributeWeights: { might: 1, vitality: 2 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'ward',
      label: 'Ward',
      unit: 'rating',
      baseNumerator: 5,
      perLevelNumerator: 1,
      attributeWeights: { intellect: 1, resolve: 2 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'accuracy',
      label: 'Accuracy',
      unit: 'basisPoints',
      baseNumerator: 6500,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 125, intellect: 25 },
      divisor: 1,
      minimum: 0,
      maximum: 9500,
    },
    {
      id: 'evasion',
      label: 'Evasion',
      unit: 'basisPoints',
      baseNumerator: 0,
      perLevelNumerator: 0,
      attributeWeights: { agility: 40, resolve: 10 },
      divisor: 1,
      minimum: 0,
      maximum: 1500,
    },
    {
      id: 'criticalChance',
      label: 'Critical Chance',
      unit: 'basisPoints',
      baseNumerator: 100,
      perLevelNumerator: 0,
      attributeWeights: { finesse: 30 },
      divisor: 1,
      minimum: 0,
      maximum: 3000,
    },
    {
      id: 'initiative',
      label: 'Initiative',
      unit: 'rating',
      baseNumerator: 10,
      perLevelNumerator: 0,
      attributeWeights: { agility: 2, resolve: 1 },
      divisor: 1,
      minimum: 0,
    },
    {
      id: 'movement',
      label: 'Movement',
      unit: 'steps',
      baseNumerator: 20,
      perLevelNumerator: 0,
      attributeWeights: { agility: 1 },
      divisor: 10,
      minimum: 2,
      maximum: 5,
    },
    {
      id: 'jump',
      label: 'Jump',
      unit: 'height',
      baseNumerator: 0,
      perLevelNumerator: 0,
      attributeWeights: { might: 1, agility: 1 },
      divisor: 20,
      minimum: 0,
      maximum: 3,
    },
    {
      id: 'statusResistance',
      label: 'Status Resistance',
      unit: 'basisPoints',
      baseNumerator: 0,
      perLevelNumerator: 0,
      attributeWeights: { resolve: 100 },
      divisor: 1,
      minimum: 0,
      maximum: 7500,
    },
  ],
}

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
      issues.push({
        field: `${prefix}.baseNumerator`,
        message: 'Base numerator must be an integer.',
      })
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
    if (!seen.has(id)) {
      issues.push({ field: 'rules', message: `Missing derived stat rule: ${id}.` })
    }
  }

  return issues
}

export function calculateDerivedStats(
  input: DerivedStatInput,
  ruleset: DerivedStatRuleset = DERIVED_STAT_RULESET_V1,
): DerivedStatSnapshot {
  const issues = validateDerivedStatRuleset(ruleset)
  if (issues.length > 0) {
    throw new Error(`Invalid derived-stat ruleset: ${issues[0].field}: ${issues[0].message}`)
  }

  if (!Number.isInteger(input.level) || input.level < 1 || input.level > CURRENT_LEVEL_CAP) {
    throw new RangeError(`Character level must be a whole number from 1 to ${CURRENT_LEVEL_CAP}.`)
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
      if (coefficient === undefined || coefficient === 0) {
        continue
      }

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

  return {
    rulesVersion: ruleset.version,
    stats,
  }
}

function clamp(value: number, minimum: number | undefined, maximum: number | undefined): number {
  let result = value
  if (minimum !== undefined) {
    result = Math.max(result, minimum)
  }
  if (maximum !== undefined) {
    result = Math.min(result, maximum)
  }
  return result
}
