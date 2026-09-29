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

function abilityApBounds(ability: SummonAbilityDefinition): {
  readonly minimum: number
  readonly maximum: number
} {
  const attack =
    ability.tags.includes('attack') || ability.effects.some((effect) => effect.type === 'damage')
  const recovery = ability.effects.some((effect) => effect.type === 'healing')
  return attack || recovery ? { minimum: 45, maximum: 60 } : { minimum: 35, maximum: 50 }
}

function validAbilityTarget(target: CombatTargetSpec): boolean {
  if (target.kind === 'self') {
    return (
      target.minimumRange === 0 &&
      target.maximumRange === 0 &&
      target.maximumElevationDifference === null
    )
  }

  return (
    Number.isSafeInteger(target.minimumRange) &&
    target.minimumRange >= 0 &&
    Number.isSafeInteger(target.maximumRange) &&
    target.maximumRange >= 1 &&
    target.maximumRange <= 5 &&
    target.minimumRange <= target.maximumRange &&
    target.maximumElevationDifference !== null &&
    Number.isSafeInteger(target.maximumElevationDifference) &&
    target.maximumElevationDifference >= 0 &&
    target.maximumElevationDifference <= 2
  )
}

function validAbilityEffect(effect: CombatEffectDefinition): boolean {
  const durationTurns = effect.durationTurns ?? 0
  if (!Number.isSafeInteger(durationTurns) || durationTurns < 0 || durationTurns > 4) return false
  if (
    effect.potencyBasisPoints !== undefined &&
    (!Number.isSafeInteger(effect.potencyBasisPoints) ||
      effect.potencyBasisPoints < 100 ||
      effect.potencyBasisPoints > 5_000)
  ) {
    return false
  }
  if (
    effect.power !== undefined &&
    (!Number.isSafeInteger(effect.power) || effect.power < 1 || effect.power > 20)
  ) {
    return false
  }

  if (effect.type === 'damage') {
    const minimum = effect.vengeance === undefined ? 1 : 0
    return Number.isSafeInteger(effect.amount) && effect.amount >= minimum && effect.amount <= 20
  }
  if (effect.type === 'healing' || effect.type === 'barrier-change') {
    return Number.isSafeInteger(effect.amount) && effect.amount >= 1 && effect.amount <= 20
  }
  if (effect.type === 'resource-change') {
    const magnitude = Math.abs(effect.delta)
    return Number.isSafeInteger(magnitude) && magnitude >= 1 && magnitude <= 20
  }
  if (effect.type === 'bleed') {
    return (
      Number.isSafeInteger(effect.damagePerTick) &&
      effect.damagePerTick >= 1 &&
      effect.damagePerTick <= 20
    )
  }
  return true
}

function validAbility(ability: SummonAbilityDefinition): boolean {
  const apBounds = abilityApBounds(ability)
  return (
    STABLE_ID_PATTERN.test(ability.id) &&
    ability.name.trim().length > 0 &&
    ability.description.trim().length > 0 &&
    positiveSafeInteger(ability.apCost) &&
    ability.apCost >= apBounds.minimum &&
    ability.apCost <= apBounds.maximum &&
    nonNegativeSafeInteger(ability.mpCost) &&
    ability.mpCost <= 20 &&
    ability.tags.length > 0 &&
    ability.tags.every((tag) => tag.trim().length > 0) &&
    validAbilityTarget(ability.target) &&
    ability.effects.length > 0 &&
    ability.effects.every(validAbilityEffect) &&
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
