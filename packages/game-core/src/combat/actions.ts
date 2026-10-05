import {
  forecastCombatStatusResistance,
  rollCombatStatusResistance,
  type CombatTargetStatusResistance,
} from './combat-status-resistance'
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
import { materializeBeneficialCombatCopyAction } from './combat-status-copy'
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

export interface CombatEffectAuthoringTuning {
  /** 0 is immediate. Positive values count full future owner turns. */
  readonly durationTurns?: number
  /** Optional bounded non-percentage power for effects whose native payload has no amount field. */
  readonly power?: number
  /** Optional status magnitude override in basis points (100 = 1 percentage point). */
  readonly potencyBasisPoints?: number
}

export type CombatEffectDefinition = (
  | Exclude<legacy.CombatEffectDefinition, { type: 'damage' }>
  | (LegacyDamageEffect & { scaling?: CombatDamageScaling; vengeance?: CombatVengeanceDefinition })
  | CombatSensoryEffect
) &
  CombatEffectAuthoringTuning

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
      statusResistance?: number
    }[]
  }
}

export interface CombatActionEvaluation extends legacy.CombatActionEvaluation {
  vengeanceBasis?: readonly CombatVengeanceBasis[]
  targetHitChances?: readonly CombatTargetHitChance[]
  targetCriticalChances?: readonly CombatTargetCriticalChance[]
  targetStatusResistances?: readonly CombatTargetStatusResistance[]
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
  /** Transient result of an engine-owned effect group; never an authored hit override. */
  hitDependentEffectsActivated?: boolean
}

export interface CombatHitDependentEffects {
  readonly effectOrdinals: readonly number[]
}

export function evaluateCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: legacy.CombatTargetSelection,
  content: legacy.CombatContentCatalog,
): CombatActionEvaluation {
  action = materializeBeneficialCombatCopyAction(state, action)
  validateCombatAccuracyDefinition(action)
  const csrPreviewAction = materializeCsrPreviewAction(action)
  let materialized = materializeVengeanceDamage(state, csrPreviewAction)
  let evaluation = legacy.evaluateCombatAction(
    state,
    materializeStatScaledDamage(state, materialized.action),
    selection,
    content,
  )
  const csrForecast =
    state.statBalancePolicyVersion === 1 && evaluation.legal
      ? materializeCsrCommittedAction({
          state,
          action,
          selection,
          evaluation,
          content,
          missedCombatantIds: new Set(),
        })
      : { action: csrPreviewAction, content }
  if (state.statBalancePolicyVersion === 1 && evaluation.legal) {
    materialized = materializeVengeanceDamage(state, csrForecast.action)
    evaluation = legacy.evaluateCombatAction(
      state,
      materializeStatScaledDamage(state, materialized.action),
      selection,
      csrForecast.content,
    )
  }
  const preview =
    evaluation.legal && materialized.basis.length > 0
      ? { ...evaluation, vengeanceBasis: materialized.basis }
      : evaluation
  const accuracyPreview = forecastCombatSkillAccuracy(state, action, preview, content)
  const criticalPreview = forecastCombatCritical(
    state,
    csrForecast.action,
    accuracyPreview,
    new Set(),
  )
  const result =
    criticalPreview.targetCriticalChances.length > 0
      ? { ...accuracyPreview, targetCriticalChances: criticalPreview.targetCriticalChances }
      : accuracyPreview
  return state.statBalancePolicyVersion === 1
    ? {
        ...result,
        targetStatusResistances: forecastCombatStatusResistance(
          state,
          csrForecast.action,
          result,
          csrForecast.content,
        ),
      }
    : result
}

export function executeCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: legacy.CombatTargetSelection,
  content: legacy.CombatContentCatalog,
  context?: CombatResolutionContext,
  hitDependentEffects?: CombatHitDependentEffects,
): CombatResolutionTransition {
  action = materializeBeneficialCombatCopyAction(state, action)
  validateCombatAccuracyDefinition(action)
  const round = state.tactical.battle.round
  const actorId = state.tactical.battle.currentTurn?.combatantId ?? null
  const previewAction = materializeCsrPreviewAction(action)
  const previewMaterializedAction = materializeStatScaledDamage(
    state,
    materializeVengeanceDamage(state, previewAction).action,
  )
  const requiresEvaluation =
    state.statBalancePolicyVersion === 1 ||
    Boolean(context) ||
    Boolean(hitDependentEffects) ||
    action.accuracyMode === 'per-target' ||
    action.effects.some((effect) => effect.type === 'sensory') ||
    (state.statBridge?.rulesVersion === 4 && hasCriticalEligibleDamage(action))
  const evaluation = requiresEvaluation
    ? legacy.evaluateCombatAction(state, previewMaterializedAction, selection, content)
    : null
  const accuracy = rollCombatSkillAccuracy(state, action, evaluation, content)
  const hitDependentEffectsActivated = hitDependentEffects
    ? evaluation?.affectedCombatantIds.some((id) => {
        const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
        const target = state.tactical.battle.combatants.find((unit) => unit.id === id)
        return (
          target &&
          actor &&
          target.hp > 0 &&
          target.teamId !== actor.teamId &&
          !accuracy.missedCombatantIds.has(id)
        )
      }) === true
    : undefined
  if (hitDependentEffects && !hitDependentEffectsActivated) {
    const omitted = new Set(hitDependentEffects.effectOrdinals)
    action = {
      ...action,
      effects: action.effects.filter((_effect, index) => !omitted.has(index)),
      ...(action.effectOrigins
        ? { effectOrigins: action.effectOrigins.filter((_origin, index) => !omitted.has(index)) }
        : {}),
      ...(action.effectTimingTags
        ? { effectTimingTags: action.effectTimingTags.filter((_tag, index) => !omitted.has(index)) }
        : {}),
    }
  }
  const csr = materializeCsrCommittedAction({
    state: accuracy.state,
    action,
    selection,
    evaluation,
    content,
    missedCombatantIds: accuracy.missedCombatantIds,
  })
  const resistance = rollCombatStatusResistance(
    accuracy.state,
    csr.action,
    evaluation,
    csr.content,
    accuracy.missedCombatantIds,
  )
  const critical = rollCombatCritical(
    resistance.state,
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
    resistance.resistedEffectOrdinalsByTarget,
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
    ...(hitDependentEffects ? { hitDependentEffectsActivated } : {}),
  }
  const preCommitEvents = [...accuracy.events, ...resistance.events, ...critical.events]
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
    ...(hitDependentEffects ? { hitDependentEffectsActivated } : {}),
    state: attachCombatEffectProvenance(
      state,
      transition.state,
      csr.action,
      provenanceEvaluation,
      context,
      csr.content,
      resistance.resistedEffectOrdinalsByTarget,
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
    state: recordTurnDamageHistory(transition.state, transition.events, round),
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
    state: recordTurnDamageHistory(transition.state, transition.events, round),
    events: transition.events,
  }
}

/** Delayed damage belongs to its activation round; outgoing periodic ticks retain their turn round. */
function recordTurnDamageHistory(
  state: CombatEncounterState,
  events: readonly legacy.CombatResolutionEvent[],
  turnRound: number,
): CombatEncounterState {
  const rounds = new Map<number, legacy.CombatResolutionEvent[]>()
  for (const event of events) {
    const round = event.effectActivationRound ?? turnRound
    rounds.set(round, [...(rounds.get(round) ?? []), event])
  }
  let next = state
  for (const [round, receipts] of rounds)
    next = recordCommittedDamageHistory(next, receipts, { round })
  return next
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
