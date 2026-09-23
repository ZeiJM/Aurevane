import {
  validateCombatAccuracyDefinition,
  forecastCombatSkillAccuracy,
  rollCombatSkillAccuracy,
  type CombatAccuracyAuthoring,
  type CombatTargetHitChance,
} from './combat-skill-accuracy'
import {
  forecastCombatCritical,
  hasCriticalEligibleDamage,
  rollCombatCritical,
  type CombatTargetCriticalChance,
} from './combat-critical'
import {
  materializeVengeanceDamage,
  type CombatVengeanceDefinition,
  type CombatVengeanceBasis,
} from './combat-vengeance'
import { applyCommittedReflect } from './combat-reflect'
import type { CombatDamageScaling } from './damage-scaling'
import type { CombatSkillCopyPreview } from './combat-skill-copy'
import { calculateScaledRawDamage, validateCombatDamageScaling } from './damage-scaling'
import { applyCommittedAbsorbRecovery } from './combat-absorb-recovery'
import { recordCommittedDamageHistory } from './combat-damage-history'
import { attachCombatEffectProvenance } from './combat-effect-provenance'
import {
  filterBlockedCovertApplication,
  materializeCsrCommittedAction,
  materializeCsrPreviewAction,
  type CombatSensoryEffect,
} from './covert-sensory-revealed'
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
  | CombatSensoryEffect

export interface CombatActionDefinition
  extends Omit<legacy.CombatActionDefinition, 'effects'>, CombatAccuracyAuthoring {
  effects: readonly CombatEffectDefinition[]
}

export interface CombatEncounterState extends Omit<legacy.CombatEncounterState, 'statBridge'> {
  statBridge?: {
    rulesVersion?: number
    combatants: readonly {
      combatantId: string
      armor: number
      ward: number
      physicalPower?: number
      mysticPower?: number
      accuracy?: number
      evasion?: number
      level?: number
      criticalChance?: number
    }[]
  }
}

export interface CombatActionEvaluation extends legacy.CombatActionEvaluation {
  vengeanceBasis?: readonly CombatVengeanceBasis[]
  targetHitChances?: readonly CombatTargetHitChance[]
  targetCriticalChances?: readonly CombatTargetCriticalChance[]
  projectionsAssumeHits?: true
  skillCopy?: CombatSkillCopyPreview
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
  const csrPreviewAction = materializeCsrPreviewAction(action)
  const materialized = materializeVengeanceDamage(state, csrPreviewAction)
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
  const accuracyPreview = forecastCombatSkillAccuracy(state, action, preview, content)
  const criticalPreview = forecastCombatCritical(
    state,
    csrPreviewAction,
    accuracyPreview,
    new Set(),
  )
  return criticalPreview.targetCriticalChances.length > 0
    ? { ...accuracyPreview, targetCriticalChances: criticalPreview.targetCriticalChances }
    : accuracyPreview
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
  const previewAction = materializeCsrPreviewAction(action)
  const previewMaterializedAction = materializeStatScaledDamage(
    state,
    materializeVengeanceDamage(state, previewAction).action,
  )
  const requiresEvaluation =
    Boolean(context) ||
    action.accuracyMode === 'per-target' ||
    action.effects.some((effect) => effect.type === 'sensory') ||
    (state.statBridge?.rulesVersion === 4 && hasCriticalEligibleDamage(action))
  const evaluation = requiresEvaluation
    ? legacy.evaluateCombatAction(state, previewMaterializedAction, selection, content)
    : null
  const accuracy = rollCombatSkillAccuracy(state, action, evaluation, content)
  const csr = materializeCsrCommittedAction({
    state: accuracy.state,
    action,
    selection,
    evaluation,
    content,
    missedCombatantIds: accuracy.missedCombatantIds,
  })
  const critical = rollCombatCritical(
    accuracy.state,
    csr.action,
    evaluation,
    accuracy.missedCombatantIds,
  )
  const materializedAction = materializeStatScaledDamage(
    critical.state,
    materializeVengeanceDamage(critical.state, csr.action).action,
  )
  let triggerGuard = context?.triggerGuard
  const committed = legacy.executeCombatAction(
    critical.state,
    materializedAction,
    selection,
    csr.content,
    (resolved) => {
      if (!actorId) return resolved
      const command = { sourceCombatantId: actorId, actionId: action.id }
      const historyState = recordCommittedDamageHistory(resolved.state, resolved.events, {
        round,
        commandSourceCombatantId: actorId,
      })
      const recovered = applyCommittedAbsorbRecovery(
        historyState,
        resolved.events,
        content,
        command,
      )
      // Both reactions read only original receipts, never each other's output.
      const reflected = applyCommittedReflect(
        recovered.state,
        resolved.events,
        content,
        command,
        triggerGuard,
      )
      triggerGuard = reflected.triggerGuard
      return { state: reflected.state, events: [...recovered.events, ...reflected.events] }
    },
    accuracy.missedCombatantIds,
    critical.criticalEffectOrdinalsByTarget,
  )
  const covertFiltered = filterBlockedCovertApplication({
    before: critical.state,
    after: committed.state,
    events: committed.events,
  })
  const committedTransition: CombatResolutionTransition = {
    ...committed,
    state: covertFiltered.state,
    events: covertFiltered.events as legacy.CombatResolutionEvent[],
  }
  const preCommitEvents = [...accuracy.events, ...critical.events]
  const transition =
    preCommitEvents.length > 0
      ? { ...committedTransition, events: [...preCommitEvents, ...committedTransition.events] }
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
      csr.action,
      provenanceEvaluation,
      context,
      csr.content,
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
    if (effect.type === 'sensory') {
      throw new TypeError('Sensory must be materialized before legacy effect resolution.')
    }
    if (effect.type === 'copy') {
      throw new TypeError('Copy must be materialized by the mature Skill execution layer.')
    }
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
