import {
  validateCombatAccuracyDefinition,
  forecastCombatSkillAccuracy,
  rollCombatSkillAccuracy,
  type CombatAccuracyAuthoring,
  type CombatTargetHitChance,
} from './combat-skill-accuracy'
import {
  materializeVengeanceDamage,
  type CombatVengeanceDefinition,
  type CombatVengeanceBasis,
} from './combat-vengeance'
import { applyCommittedReflect } from './combat-reflect'
import type { CombatDamageScaling } from './damage-scaling'
import { calculateScaledRawDamage, validateCombatDamageScaling } from './damage-scaling'
import { applyCommittedAbsorbRecovery } from './combat-absorb-recovery'
import { recordCommittedDamageHistory } from './combat-damage-history'
import { attachCombatEffectProvenance } from './combat-effect-provenance'
import {
  COMBAT_RESOLUTION_PIPELINE_VERSION,
  type CombatActionProvenance,
  type CombatTriggerGuard,
} from './combat-kernel-types'
import * as legacy from './actions-legacy'

export * from './actions-legacy'

type LegacyDamageEffect = Extract<legacy.CombatEffectDefinition, { type: 'damage' }>

export type CombatEffectDefinition =
  | Exclude<legacy.CombatEffectDefinition, { type: 'damage' }>
  | (LegacyDamageEffect & { scaling?: CombatDamageScaling; vengeance?: CombatVengeanceDefinition })

export interface CombatActionDefinition
  extends Omit<legacy.CombatActionDefinition, 'effects'>, CombatAccuracyAuthoring {
  effects: readonly CombatEffectDefinition[]
}

export interface CombatEncounterState extends Omit<legacy.CombatEncounterState, 'statBridge'> {
  statBridge?: {
    combatants: readonly {
      combatantId: string
      armor: number
      ward: number
      physicalPower?: number
      mysticPower?: number
      accuracy?: number
      evasion?: number
    }[]
  }
}

export interface CombatActionEvaluation extends legacy.CombatActionEvaluation {
  vengeanceBasis?: readonly CombatVengeanceBasis[]
  targetHitChances?: readonly CombatTargetHitChance[]
  projectionsAssumeHits?: true
}

export interface CombatResolutionContext {
  provenance: CombatActionProvenance
  triggerGuard: CombatTriggerGuard
}

export interface CombatResolutionMetadata {
  pipelineVersion: typeof COMBAT_RESOLUTION_PIPELINE_VERSION
  provenance: CombatActionProvenance
  triggerGuard: CombatTriggerGuard
}

export interface CombatResolutionTransition extends Omit<
  legacy.CombatResolutionTransition,
  'state'
> {
  state: CombatEncounterState
  resolution?: CombatResolutionMetadata
}

export function evaluateCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: legacy.CombatTargetSelection,
  content: legacy.CombatContentCatalog,
): CombatActionEvaluation {
  validateCombatAccuracyDefinition(action)
  const materialized = materializeVengeanceDamage(state, action)
  const evaluation = legacy.evaluateCombatAction(
    state,
    materializeStatScaledDamage(state, materialized.action),
    selection,
    content,
  )
  const preview =
    evaluation.legal && materialized.basis.length > 0
      ? { ...evaluation, vengeanceBasis: materialized.basis }
      : evaluation
  return forecastCombatSkillAccuracy(state, action, preview, content)
}

export function executeCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: legacy.CombatTargetSelection,
  content: legacy.CombatContentCatalog,
  context?: CombatResolutionContext,
): CombatResolutionTransition {
  validateCombatAccuracyDefinition(action)
  const round = state.tactical.battle.round
  const actorId = state.tactical.battle.currentTurn?.combatantId ?? null
  const materializedAction = materializeStatScaledDamage(
    state,
    materializeVengeanceDamage(state, action).action,
  )
  const evaluation =
    context || action.accuracyMode === 'per-target'
      ? legacy.evaluateCombatAction(state, materializedAction, selection, content)
      : null
  const accuracy = rollCombatSkillAccuracy(state, action, evaluation, content)
  let triggerGuard = context?.triggerGuard
  const committedTransition = legacy.executeCombatAction(
    accuracy.state,
    materializedAction,
    selection,
    content,
    (committed) => {
      if (!actorId) return committed
      const command = { sourceCombatantId: actorId, actionId: action.id }
      const historyState = recordCommittedDamageHistory(committed.state, committed.events, {
        round,
        commandSourceCombatantId: actorId,
      })
      const recovered = applyCommittedAbsorbRecovery(
        historyState,
        committed.events,
        content,
        command,
      )
      // Both reactions read only original receipts, never each other's output.
      const reflected = applyCommittedReflect(
        recovered.state,
        committed.events,
        content,
        command,
        triggerGuard,
      )
      triggerGuard = reflected.triggerGuard
      return { state: reflected.state, events: [...recovered.events, ...reflected.events] }
    },
    accuracy.missedCombatantIds,
  )
  const transition =
    accuracy.events.length > 0
      ? { ...committedTransition, events: [...accuracy.events, ...committedTransition.events] }
      : committedTransition
  if (!context || !evaluation) return transition
  // A miss must not reattribute an existing status or persistent effect.
  const provenanceEvaluation =
    accuracy.missedCombatantIds.size === 0
      ? evaluation
      : {
          ...evaluation,
          primaryCombatantId:
            evaluation.primaryCombatantId &&
            accuracy.missedCombatantIds.has(evaluation.primaryCombatantId)
              ? null
              : evaluation.primaryCombatantId,
          affectedCombatantIds: evaluation.affectedCombatantIds.filter(
            (id) => !accuracy.missedCombatantIds.has(id),
          ),
        }
  return {
    state: attachCombatEffectProvenance(
      state,
      transition.state,
      action,
      provenanceEvaluation,
      context,
      content,
    ),
    events: transition.events,
    resolution: {
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance: context.provenance,
      triggerGuard: triggerGuard ?? context.triggerGuard,
    },
  }
}

export function endCombatTurn(
  state: CombatEncounterState,
  content: legacy.CombatContentCatalog,
  outgoingDefeatedAtTurnEnd = false,
): CombatResolutionTransition {
  const round = state.tactical.battle.round
  const transition = legacy.endCombatTurn(state, content, outgoingDefeatedAtTurnEnd)
  return {
    state: recordCommittedDamageHistory(transition.state, transition.events, { round }),
    events: transition.events,
  }
}

export function waitCurrentTurn(
  state: CombatEncounterState,
  content: legacy.CombatContentCatalog,
): CombatResolutionTransition {
  const round = state.tactical.battle.round
  const transition = legacy.waitCurrentTurn(state, content)
  return {
    state: recordCommittedDamageHistory(transition.state, transition.events, { round }),
    events: transition.events,
  }
}

function materializeStatScaledDamage(
  state: CombatEncounterState,
  action: CombatActionDefinition,
): legacy.CombatActionDefinition {
  const actorId =
    state.tactical.battle.lifecycle === 'active'
      ? (state.tactical.battle.currentTurn?.combatantId ?? null)
      : null

  const effects: legacy.CombatEffectDefinition[] = action.effects.map((effect) => {
    if (effect.type !== 'damage') return effect

    const { scaling, ...legacyEffect } = effect
    if (!scaling) return legacyEffect

    const issues = validateCombatDamageScaling(scaling)
    if (issues.length > 0) {
      throw new TypeError(`Invalid damage scaling: ${issues[0].field}: ${issues[0].message}`)
    }

    // Let the legacy evaluator report an inactive/invalid turn before requiring actor stats.
    if (!actorId) return legacyEffect

    const profile = state.statBridge?.combatants.find(
      (candidate) => candidate.combatantId === actorId,
    )
    const offensivePower =
      scaling.source === 'physical-power' ? profile?.physicalPower : profile?.mysticPower
    if (offensivePower === undefined) {
      throw new TypeError('Scaled Skill damage requires attacker offensive power.')
    }

    return {
      ...legacyEffect,
      amount: calculateScaledRawDamage(effect.amount, scaling, offensivePower),
    }
  })

  return { ...action, effects }
}
