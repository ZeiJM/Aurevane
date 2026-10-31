import { validateCombatReversalPayload } from './combat-reversal'
import { CHARACTER_ATTRIBUTE_IDS, type CharacterAttributes } from '../character/creation'
import { calculateDerivedStats, DERIVED_STAT_RULESET_V5 } from '../character/derived-stats'
import { abilityPresentationTextIssues, type AbilityPresentationText } from './battle-narration'
import { finalizedContentMediaIssues, type FinalizedContentMediaSlots } from './content-media'
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

export interface SummonAbilityMediaHooks extends FinalizedContentMediaSlots {
  readonly iconKey: string | null
  readonly audioCueKey: string | null
  readonly vfxKey: string | null
}

export interface SummonAbilityDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly presentation?: AbilityPresentationText
  readonly battleText?: string
  readonly apCost: number
  readonly mpCost: number
  /** Absent historical costs remain free; authored HP costs must leave the summon alive. */
  readonly hpCost?: number
  /** Zero/absence preserve the historical no-cooldown ability. */
  readonly cooldownOwnerTurns?: number
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
  /** Optional authoring provenance; absent historical profiles retain their literal derived values. */
  readonly coreAttributes?: Readonly<CharacterAttributes>
  readonly derivedStatRulesVersion?: 5
  /** Optional current authoring ceiling; omitted profiles retain historical damage. */
  readonly potencyBasisPoints?: number
  readonly maxHp: number
  readonly maxMp: number
  readonly initiative: number
  readonly movementBudget: number
  /** Explicitly anchors the summon against voluntary and forced movement. Absent historical profiles remain mobile. */
  readonly neverMoves?: boolean
  readonly stats: {
    readonly accuracy: number
    readonly evasion: number
    readonly armor: number
    readonly ward: number
    readonly jump: number
    readonly physicalPower: number
    readonly mysticPower: number
    readonly criticalChance?: number
    readonly statusResistance?: number
  }
  readonly aiProfile: SummonAiProfile
  readonly aiPurposeTags: readonly string[]
  readonly lifetimeTurns: number
  readonly abilities: readonly SummonAbilityDefinition[]
}

/** A neutral starting profile for newly authored summons; no owner build or allocation is read. */
export const DEFAULT_SUMMON_CORE_ATTRIBUTES: Readonly<CharacterAttributes> = Object.freeze({
  might: 10,
  finesse: 10,
  vitality: 10,
  agility: 10,
  intellect: 10,
  resolve: 10,
})

/** Explicit authoring conversion only. Readers and spawning consume the pinned derived snapshot. */
export function withCurrentSummonCoreAttributes(
  profile: SummonProfileDefinition,
  attributes: Readonly<CharacterAttributes> = profile.coreAttributes ??
    DEFAULT_SUMMON_CORE_ATTRIBUTES,
): SummonProfileDefinition {
  const { stats } = calculateDerivedStats({ level: 1, attributes }, DERIVED_STAT_RULESET_V5)
  return {
    ...profile,
    coreAttributes: { ...attributes },
    derivedStatRulesVersion: 5,
    maxHp: stats.maxHp.value,
    maxMp: stats.maxMp.value,
    initiative: stats.initiative.value,
    movementBudget: stats.movement.value,
    stats: {
      ...profile.stats,
      accuracy: stats.accuracy.value,
      evasion: stats.evasion.value,
      armor: stats.armor.value,
      ward: stats.ward.value,
      jump: stats.jump.value,
      physicalPower: stats.physicalPower.value,
      mysticPower: stats.mysticPower.value,
      criticalChance: stats.criticalChance.value,
      statusResistance: stats.statusResistance.value,
    },
  }
}

function coreSnapshotIssues(profile: SummonProfileDefinition): readonly string[] {
  if (profile.coreAttributes === undefined && profile.derivedStatRulesVersion === undefined)
    return []
  const issues: string[] = []
  if (profile.derivedStatRulesVersion !== 5) issues.push('derivedStatRulesVersion')
  const core = profile.coreAttributes
  if (
    !core ||
    Object.keys(core).length !== CHARACTER_ATTRIBUTE_IDS.length ||
    CHARACTER_ATTRIBUTE_IDS.some(
      (id) => !Number.isSafeInteger(core[id]) || core[id] < 1 || core[id] > 60,
    )
  )
    return [...issues, 'coreAttributes']
  // Ruleset V5 remains explicit so a future default change cannot reinterpret a saved profile.
  const expected = withCurrentSummonCoreAttributes(profile, core)
  for (const field of ['maxHp', 'maxMp', 'initiative', 'movementBudget'] as const) {
    if (profile[field] !== expected[field]) issues.push(field)
  }
  for (const field of Object.keys(expected.stats) as (keyof SummonProfileDefinition['stats'])[]) {
    if (profile.stats[field] !== expected.stats[field]) issues.push(`stats.${field}`)
  }
  return issues
}

const STABLE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

function nonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function validAbility(ability: SummonAbilityDefinition): boolean {
  const reversals = ability.effects.filter((effect) => effect.type === 'reversal')
  if (reversals.length) {
    if (
      reversals.length !== 1 ||
      ability.target.kind !== 'self' ||
      ability.tags.includes('attack') ||
      ability.effects.some((effect) => ['damage', 'poison', 'burn', 'bleed'].includes(effect.type))
    )
      return false
    try {
      validateCombatReversalPayload(reversals[0]!)
    } catch {
      return false
    }
  }
  return (
    STABLE_ID_PATTERN.test(ability.id) &&
    ability.name.trim().length > 0 &&
    ability.description.trim().length > 0 &&
    abilityPresentationTextIssues(ability).length === 0 &&
    (ability.battleText === undefined ||
      battleFlavorTemplateIssues(ability.battleText).length === 0) &&
    (ability.cooldownOwnerTurns === undefined ||
      (nonNegativeSafeInteger(ability.cooldownOwnerTurns) && ability.cooldownOwnerTurns <= 99)) &&
    positiveSafeInteger(ability.apCost) &&
    ability.apCost <= 100 &&
    nonNegativeSafeInteger(ability.mpCost) &&
    ability.mpCost <= 20 &&
    (ability.hpCost === undefined || nonNegativeSafeInteger(ability.hpCost)) &&
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
  const issues: string[] = [...coreSnapshotIssues(profile)]

  if (profile.schemaVersion !== SUMMON_PROFILE_SCHEMA_VERSION) issues.push('schemaVersion')
  if (!STABLE_ID_PATTERN.test(profile.id)) issues.push('id')
  if (!profile.name.trim()) issues.push('name')
  if (!profile.description.trim()) issues.push('description')
  if (!profile.flavorLine.trim()) issues.push('flavorLine')
  if (!STABLE_ID_PATTERN.test(profile.portraitKey)) issues.push('portraitKey')
  if (profile.tags.length === 0 || profile.tags.some((tag) => !tag.trim())) issues.push('tags')
  if (
    profile.potencyBasisPoints !== undefined &&
    (!nonNegativeSafeInteger(profile.potencyBasisPoints) || profile.potencyBasisPoints > 10000)
  )
    issues.push('potencyBasisPoints')
  if (!positiveSafeInteger(profile.maxHp)) issues.push('maxHp')
  if (!nonNegativeSafeInteger(profile.maxMp)) issues.push('maxMp')
  if (!nonNegativeSafeInteger(profile.initiative)) issues.push('initiative')
  if (!positiveSafeInteger(profile.movementBudget)) issues.push('movementBudget')
  if (profile.neverMoves !== undefined && typeof profile.neverMoves !== 'boolean')
    issues.push('neverMoves')

  for (const [field, value] of Object.entries(profile.stats)) {
    if (!nonNegativeSafeInteger(value)) issues.push(`stats.${field}`)
  }

  if (!['standard', 'high'].includes(profile.aiProfile)) issues.push('aiProfile')
  if (profile.aiPurposeTags.some((tag) => !tag.trim())) issues.push('aiPurposeTags')
  if (!positiveSafeInteger(profile.lifetimeTurns)) issues.push('lifetimeTurns')

  if (
    profile.abilities.length < 1 ||
    profile.abilities.length > 2 ||
    profile.abilities.some(
      (ability) => !validAbility(ability) || finalizedContentMediaIssues(ability.media).length > 0,
    )
  ) {
    issues.push('abilities')
  } else if (
    new Set(profile.abilities.map((ability) => ability.id)).size !== profile.abilities.length
  ) {
    issues.push('abilities')
  }

  return issues
}

/** Shared immutable-profile explanation for authoring previews and battle inspection. */
export function summonPotencyDescription(
  profile: Pick<SummonProfileDefinition, 'potencyBasisPoints'>,
): string | null {
  return profile.potencyBasisPoints === undefined
    ? null
    : `Each complete attack deals at most ${profile.potencyBasisPoints / 100}% of the summoner’s normal noncritical Basic Attack damage against the same target, before Barrier. Repeated hits share this limit. Each damage-over-time tick has a separate limit.`
}
