import { battleFlavorTemplateIssues } from './battle-narration'
import type { CombatEffectDefinition, CombatTargetSpec, CombatUseRequirement } from './actions'

export const SUMMON_PROFILE_SCHEMA_VERSION = 1 as const
export const CURRENT_SUMMON_LIFETIME_TURNS = 5 as const

export interface CombatSummonEffect {
  readonly type: 'summon'
  readonly recipient: 'selected-tile'
  readonly durationTurns?: 0
}

export function isMaterializedCombatEffect(
  effect: CombatEffectDefinition | CombatSummonEffect,
): effect is CombatEffectDefinition {
  return effect.type !== 'summon'
}

export type SummonAiProfile = 'standard' | 'high'

export interface SummonAbilityMediaHooks {
  readonly iconKey: string | null
  readonly audioCueKey: string | null
  readonly vfxKey: string | null
}

export interface SummonAbilityDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly battleText?: string
  readonly apCost: number
  readonly mpCost: number
  readonly tags: readonly string[]
  readonly target: CombatTargetSpec
  readonly requirements: readonly CombatUseRequirement[]
  readonly effects: readonly CombatEffectDefinition[]
  readonly ai: {
    readonly baseUtility: number
    readonly purposeTags: readonly string[]
  }
  readonly media: SummonAbilityMediaHooks
}

export interface SummonProfileDefinition {
  readonly schemaVersion: typeof SUMMON_PROFILE_SCHEMA_VERSION
  readonly id: string
  readonly name: string
  readonly description: string
  readonly flavorLine: string
  readonly portraitKey: string
  readonly tags: readonly string[]
  readonly maxHp: number
  readonly maxMp: number
  readonly initiative: number
  readonly movementBudget: number
  readonly stats: {
    readonly accuracy: number
    readonly evasion: number
    readonly armor: number
    readonly ward: number
    readonly jump: number
    readonly physicalPower: number
    readonly mysticPower: number
  }
  readonly aiProfile: SummonAiProfile
  readonly aiPurposeTags: readonly string[]
  readonly lifetimeTurns: number
  readonly abilities: readonly SummonAbilityDefinition[]
}

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function nonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function validAbility(ability: SummonAbilityDefinition): boolean {
  return (
    STABLE_ID_PATTERN.test(ability.id) &&
    ability.name.trim().length > 0 &&
    ability.description.trim().length > 0 &&
    (ability.battleText === undefined ||
      battleFlavorTemplateIssues(ability.battleText).length === 0) &&
    positiveSafeInteger(ability.apCost) &&
    ability.apCost <= 100 &&
    nonNegativeSafeInteger(ability.mpCost) &&
    ability.mpCost <= 20 &&
    ability.tags.length > 0 &&
    ability.tags.every((tag) => tag.trim().length > 0) &&
    ability.effects.length > 0 &&
    Number.isFinite(ability.ai.baseUtility) &&
    ability.ai.purposeTags.every((tag) => tag.trim().length > 0)
  )
}

export function validateSummonProfileDefinition(
  profile: SummonProfileDefinition,
): readonly string[] {
  const issues: string[] = []

  if (profile.schemaVersion !== SUMMON_PROFILE_SCHEMA_VERSION) issues.push('schemaVersion')
  if (!STABLE_ID_PATTERN.test(profile.id)) issues.push('id')
  if (!profile.name.trim()) issues.push('name')
  if (!profile.description.trim()) issues.push('description')
  if (!profile.flavorLine.trim()) issues.push('flavorLine')
  if (!STABLE_ID_PATTERN.test(profile.portraitKey)) issues.push('portraitKey')
  if (profile.tags.length === 0 || profile.tags.some((tag) => !tag.trim())) issues.push('tags')
  if (!positiveSafeInteger(profile.maxHp)) issues.push('maxHp')
  if (!nonNegativeSafeInteger(profile.maxMp)) issues.push('maxMp')
  if (!nonNegativeSafeInteger(profile.initiative)) issues.push('initiative')
  if (!positiveSafeInteger(profile.movementBudget)) issues.push('movementBudget')

  for (const [field, value] of Object.entries(profile.stats)) {
    if (!nonNegativeSafeInteger(value)) issues.push(`stats.${field}`)
  }

  if (!['standard', 'high'].includes(profile.aiProfile)) issues.push('aiProfile')
  if (profile.aiPurposeTags.some((tag) => !tag.trim())) issues.push('aiPurposeTags')
  if (!positiveSafeInteger(profile.lifetimeTurns)) issues.push('lifetimeTurns')

  if (
    profile.abilities.length < 1 ||
    profile.abilities.length > 2 ||
    profile.abilities.some((ability) => !validAbility(ability))
  ) {
    issues.push('abilities')
  } else if (
    new Set(profile.abilities.map((ability) => ability.id)).size !== profile.abilities.length
  ) {
    issues.push('abilities')
  }

  return issues
}
