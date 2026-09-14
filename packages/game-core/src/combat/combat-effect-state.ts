import type { CombatStatusDefinition } from './actions'

export type EffectPolarity = 'positive' | 'negative' | 'neutral' | 'mixed'

export type ReactionClass = 'ordinary' | 'periodic' | 'reactive' | 'self-cost' | 'system'

declare module './actions' {
  interface CombatStatusDefinition {
    polarity?: EffectPolarity
    amplifyCopyable?: boolean
    curseCopyable?: boolean
    reactionClass?: ReactionClass
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
}

export interface CombatPoisonInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  movementRemainder: number
}

export interface CombatBleedStack {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  damagePerTick: number
  remainingTicks: number
  applicationOrder: number
}

export interface CombatBurnInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  stage: number
}

export interface CombatTemporarySkillGrant {
  combatantId: string
  skillId: string
  contentVersion: number
  sourceCombatantId: string
}

export interface CombatDamageHistoryEntry {
  combatantId: string
  round: number
  amount: number
}

export interface CombatEffectState {
  ongoingRecovery: CombatOngoingRecovery[]
  poison: CombatPoisonInstance[]
  bleed: CombatBleedStack[]
  burn: CombatBurnInstance[]
  temporarySkills: CombatTemporarySkillGrant[]
  damageHistory: CombatDamageHistoryEntry[]
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
    temporarySkills: Array.isArray(input.temporarySkills) ? input.temporarySkills : [],
    damageHistory: Array.isArray(input.damageHistory) ? input.damageHistory : [],
  }
}
