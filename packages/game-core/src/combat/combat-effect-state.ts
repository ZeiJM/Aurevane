import type { CombatStatusDefinition } from './actions'
import type { CombatEffectCategory } from './combat-effect-categories'
import type { CombatEffectInstanceProvenance } from './combat-kernel-types'
import type { SummonProfileDefinition } from './summon-content'

export type EffectPolarity = 'positive' | 'negative' | 'neutral' | 'mixed'

export type ReactionClass = 'ordinary' | 'periodic' | 'reactive' | 'self-cost' | 'system'

declare module './actions' {
  interface CombatStatusDefinition {
    polarity?: EffectPolarity
    amplifyCopyable?: boolean
    curseCopyable?: boolean
    reactionClass?: ReactionClass
    effectCategories?: readonly CombatEffectCategory[]
    absorbHpBasisPoints?: number
    absorbMpBasisPoints?: number
    reflectBasisPoints?: number
    markAccuracyBonusBasisPoints?: number
    blindAccuracyPenaltyBasisPoints?: number
  }
}

export interface CombatStatusMetadata {
  polarity: EffectPolarity
  amplifyCopyable: boolean
  curseCopyable: boolean
  reactionClass: ReactionClass
}

export function combatStatusMetadata(status: CombatStatusDefinition): CombatStatusMetadata {
  return {
    polarity: status.polarity ?? 'neutral',
    amplifyCopyable: status.amplifyCopyable ?? false,
    curseCopyable: status.curseCopyable ?? false,
    reactionClass: status.reactionClass ?? (status.endOfTurn ? 'periodic' : 'ordinary'),
  }
}

export function combatStatusEffectCategories(
  status: CombatStatusDefinition,
): readonly CombatEffectCategory[] {
  return status.effectCategories ?? []
}

export interface DamageProvenance {
  kind: 'direct-hostile' | 'periodic-hostile' | 'reactive' | 'self-cost' | 'system'
  sourceCombatantId: string | null
  sourceActionId: string | null
  commandExecutionId: string | null
}

export interface CombatOngoingRecovery {
  kind: 'hp' | 'mp'
  sourceCombatantId: string
  targetCombatantId: string
  sourceActionId: string
  amountPerTick: number
  remainingFutureTicks: number
  /** A recovery applied during the target's active turn must not tick again at that same turn end. */
  skipCurrentOwnerTurnEnd?: boolean
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatPoisonInstance {
  /** Stable identity for independently accumulated applications in stacking policy 1. */
  applicationOrder?: number
  skipCurrentOwnerTurnEnd?: boolean
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  movementRemainder: number
  /** Current authored Poison may pin bounded power and remaining future turns. */
  damagePerTick?: number
  remainingTicks?: number
  /** Explicit current Curse eligibility; omitted historical Poison remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatBleedStack {
  skipCurrentOwnerTurnEnd?: boolean
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  damagePerTick: number
  remainingTicks: number
  applicationOrder: number
  /** Explicit current Curse eligibility; omitted historical Bleed remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatBurnInstance {
  /** Stable identity for independently accumulated applications in stacking policy 1. */
  applicationOrder?: number
  skipCurrentOwnerTurnEnd?: boolean
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  stage: number
  /** Current authored Burn may override the canonical stage-one power and duration. */
  basePower?: number
  remainingTicks?: number
  /** Explicit current Curse eligibility; omitted historical Burn remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatDamageHistoryEntry {
  combatantId: string
  round: number
  amount: number
}

export interface CombatBarrierInstance {
  /** Stable identity for independent Barrier pools in stacking policy 1. */
  applicationOrder?: number
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  amount: number
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatSummonInstance {
  combatantId: string
  ownerCombatantId: string
  sourceSkillId: string
  sourceSkillVersion: number
  profile: SummonProfileDefinition
  spawnedRound: number
  turnsCompleted: number
}

export interface CombatEffectState {
  ongoingRecovery: CombatOngoingRecovery[]
  poison: CombatPoisonInstance[]
  bleed: CombatBleedStack[]
  burn: CombatBurnInstance[]
  damageHistory: CombatDamageHistoryEntry[]
  barriers?: CombatBarrierInstance[]
  summons?: CombatSummonInstance[]
}

export function normalizeCombatEffectState(value: unknown): CombatEffectState {
  const input =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Partial<CombatEffectState>)
      : {}

  return {
    ongoingRecovery: Array.isArray(input.ongoingRecovery) ? input.ongoingRecovery : [],
    poison: Array.isArray(input.poison) ? input.poison : [],
    bleed: Array.isArray(input.bleed) ? input.bleed : [],
    burn: Array.isArray(input.burn) ? input.burn : [],
    damageHistory: Array.isArray(input.damageHistory) ? input.damageHistory : [],
    ...(Array.isArray(input.barriers) ? { barriers: input.barriers } : {}),
    ...(Array.isArray(input.summons) ? { summons: input.summons } : {}),
  }
}
