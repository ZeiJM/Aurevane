import type { CharacterAttributes } from './creation'
import {
  calculateDerivedStats,
  DERIVED_STAT_IDS,
  DERIVED_STAT_RULESET_V1,
  type DerivedStatId,
  type DerivedStatRuleset,
  type DerivedStatSnapshot,
} from './derived-stats'

export interface DisciplineDefinition {
  id: string
  definitionVersion: number
  name: string
  summary: string
  enabledForPrimary: boolean
}

export interface PrimaryDisciplineBaseProfile {
  disciplineId: string
  profileVersion: number
  statOffsets: Readonly<Partial<Record<DerivedStatId, number>>>
}

export interface BuildDerivedStatModifier {
  sourceId: string
  statId: DerivedStatId
  amount: number
}

export interface CharacterBuildDerivedStatInput {
  attributes: CharacterAttributes
  level: number
  primaryDefinition: DisciplineDefinition
  primaryProfile: PrimaryDisciplineBaseProfile
  modifiers?: readonly BuildDerivedStatModifier[]
}

export interface PrimaryDisciplinePreview {
  definition: DisciplineDefinition
  profile: PrimaryDisciplineBaseProfile
  derived: DerivedStatSnapshot
}

export function validateDisciplineDefinition(definition: DisciplineDefinition): readonly string[] {
  const issues: string[] = []
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(definition.id)) issues.push('id')
  if (!Number.isInteger(definition.definitionVersion) || definition.definitionVersion <= 0) {
    issues.push('definitionVersion')
  }
  if (!definition.name.trim()) issues.push('name')
  if (!definition.summary.trim()) issues.push('summary')
  return issues
}

export function validatePrimaryDisciplineBaseProfile(
  profile: PrimaryDisciplineBaseProfile,
): readonly string[] {
  const issues: string[] = []
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(profile.disciplineId)) issues.push('disciplineId')
  if (!Number.isInteger(profile.profileVersion) || profile.profileVersion <= 0) {
    issues.push('profileVersion')
  }
  for (const [statId, amount] of Object.entries(profile.statOffsets)) {
    if (!DERIVED_STAT_IDS.includes(statId as DerivedStatId) || !Number.isInteger(amount)) {
      issues.push(`statOffsets.${statId}`)
    }
  }
  return issues
}

export function calculateCharacterBuildDerivedStats(
  input: CharacterBuildDerivedStatInput,
  ruleset: DerivedStatRuleset = DERIVED_STAT_RULESET_V1,
): DerivedStatSnapshot {
  if (validateDisciplineDefinition(input.primaryDefinition).length > 0) {
    throw new TypeError('Primary Discipline definition is invalid.')
  }
  if (!input.primaryDefinition.enabledForPrimary) {
    throw new RangeError('Primary Discipline is disabled.')
  }
  if (validatePrimaryDisciplineBaseProfile(input.primaryProfile).length > 0) {
    throw new TypeError('Primary Discipline base profile is invalid.')
  }
  if (input.primaryDefinition.id !== input.primaryProfile.disciplineId) {
    throw new RangeError('Primary Discipline definition/profile mismatch.')
  }

  const base = calculateDerivedStats(
    { attributes: input.attributes, level: input.level },
    ruleset,
  )
  const primaryModifiers: BuildDerivedStatModifier[] = DERIVED_STAT_IDS.flatMap((statId) => {
    const amount = input.primaryProfile.statOffsets[statId]
    return amount === undefined || amount === 0
      ? []
      : [
          {
            sourceId: `discipline.primary.${input.primaryDefinition.id}.profile.${input.primaryProfile.profileVersion}`,
            statId,
            amount,
          },
        ]
  })

  return applyBuildDerivedStatModifiers(base, [...primaryModifiers, ...(input.modifiers ?? [])], ruleset)
}

export function buildPrimaryDisciplinePreview(
  input: CharacterBuildDerivedStatInput,
  ruleset: DerivedStatRuleset = DERIVED_STAT_RULESET_V1,
): PrimaryDisciplinePreview {
  return {
    definition: input.primaryDefinition,
    profile: input.primaryProfile,
    derived: calculateCharacterBuildDerivedStats(input, ruleset),
  }
}

function applyBuildDerivedStatModifiers(
  snapshot: DerivedStatSnapshot,
  modifiers: readonly BuildDerivedStatModifier[],
  ruleset: DerivedStatRuleset,
): DerivedStatSnapshot {
  const stats = { ...snapshot.stats }
  for (const modifier of modifiers) {
    if (!modifier.sourceId.trim() || !DERIVED_STAT_IDS.includes(modifier.statId)) {
      throw new TypeError('Derived-stat modifier source is invalid.')
    }
    if (!Number.isInteger(modifier.amount)) {
      throw new TypeError('Derived-stat modifier amount must be an integer.')
    }
    const rule = ruleset.rules.find((candidate) => candidate.id === modifier.statId)
    const current = stats[modifier.statId]
    if (!rule || !current) throw new TypeError('Derived-stat modifier targets an unknown rule.')

    const unclampedValue = current.unclampedValue + modifier.amount
    let value = unclampedValue
    if (rule.minimum !== undefined) value = Math.max(value, rule.minimum)
    if (rule.maximum !== undefined) value = Math.min(value, rule.maximum)

    stats[modifier.statId] = {
      ...current,
      value,
      unclampedValue,
      contributions: [
        ...current.contributions,
        {
          sourceKind: 'modifier',
          sourceId: modifier.sourceId,
          inputValue: modifier.amount,
          coefficient: rule.divisor,
          numeratorAmount: modifier.amount * rule.divisor,
        },
      ],
    }
  }
  return { ...snapshot, stats }
}
