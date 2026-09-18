import type { CombatStatusDefinition } from './actions'
import type { CombatEffectCategory } from './combat-effect-categories'
import type { CombatEffectInstanceProvenance } from './combat-kernel-types'

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
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatPoisonInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  movementRemainder: number
  /** Explicit current Curse eligibility; omitted historical Poison remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatBleedStack {
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
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  profileVersion: number
  stage: number
  /** Explicit current Curse eligibility; omitted historical Burn remains non-copyable. */
  curseCopyable?: boolean
  provenance?: CombatEffectInstanceProvenance
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

export interface CombatBarrierInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  amount: number
  provenance?: CombatEffectInstanceProvenance
}

export interface CombatEffectState {
  ongoingRecovery: CombatOngoingRecovery[]
  poison: CombatPoisonInstance[]
  bleed: CombatBleedStack[]
  burn: CombatBurnInstance[]
  temporarySkills: CombatTemporarySkillGrant[]
  damageHistory: CombatDamageHistoryEntry[]
  barriers?: CombatBarrierInstance[]
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
    ...(Array.isArray(input.barriers) ? { barriers: input.barriers } : {}),
  }
}

export interface CombatTemporarySkillStateIssue {
  field: string
  message: string
}

export function validateCombatTemporarySkillState(state: {
  tactical: { battle: { combatants: readonly { id: string }[] } }
  effectState?: unknown
}): readonly CombatTemporarySkillStateIssue[] {
  const effectState = state.effectState
  if (effectState === undefined) return []
  if (!effectState || typeof effectState !== 'object' || Array.isArray(effectState)) {
    return [{ field: 'effectState', message: 'Combat effect state must be an object.' }]
  }

  const temporarySkills = (effectState as { temporarySkills?: unknown }).temporarySkills
  if (temporarySkills === undefined) return []
  if (!Array.isArray(temporarySkills)) {
    return [
      {
        field: 'effectState.temporarySkills',
        message: 'Temporary Skill grants must be an array.',
      },
    ]
  }

  const combatantIds = new Set(state.tactical.battle.combatants.map((combatant) => combatant.id))
  const seen = new Set<string>()
  const issues: CombatTemporarySkillStateIssue[] = []

  temporarySkills.forEach((value, index) => {
    const field = `effectState.temporarySkills.${index}`
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      issues.push({ field, message: 'Temporary Skill grant must be an object.' })
      return
    }

    const grant = value as Partial<CombatTemporarySkillGrant>
    if (
      typeof grant.combatantId !== 'string' ||
      grant.combatantId.length === 0 ||
      typeof grant.skillId !== 'string' ||
      grant.skillId.length === 0 ||
      !Number.isSafeInteger(grant.contentVersion) ||
      (grant.contentVersion as number) < 1 ||
      typeof grant.sourceCombatantId !== 'string' ||
      grant.sourceCombatantId.length === 0
    ) {
      issues.push({
        field,
        message: 'Temporary Skill grant identity and pinned version must be valid.',
      })
      return
    }

    if (!combatantIds.has(grant.combatantId) || !combatantIds.has(grant.sourceCombatantId)) {
      issues.push({
        field,
        message: 'Temporary Skill grant combatants must belong to this encounter.',
      })
    }
    if (grant.combatantId === grant.sourceCombatantId) {
      issues.push({
        field,
        message: 'Temporary Skill Copy source must be a different combatant.',
      })
    }

    const identity = `${grant.combatantId}\u0000${grant.skillId}\u0000${grant.contentVersion}`
    if (seen.has(identity)) {
      issues.push({
        field,
        message: 'Temporary copied pinned Skill identities must be unique per combatant.',
      })
    }
    seen.add(identity)
  })

  return issues
}
