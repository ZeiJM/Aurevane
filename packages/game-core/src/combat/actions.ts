import {
  consumeCommittedCombatExecution,
  committedCombatAction,
  type CommittedCombatExecution,
} from './combat-committed-execution'
import { terrainAdjustedDefense } from './combat-stat-balance'
import { airborneAttackAction } from './combat-airborne'
import {
  skillPacketGroups,
  rollSkillPacketAccuracy,
  rollSkillPacketOutcomes,
} from './combat-skill-packets'
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
export {
  createCombatGroundArea,
  advanceCombatGroundAreas,
  validateCombatGroundAreas,
} from './combat-ground-areas'

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
    schemaVersion?: number
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
}

export interface CombatResolutionContext {
  provenance: CombatActionProvenance
  triggerGuard: CombatTriggerGuard
  /** Engine-owned captured Automatic authority; never a client command field. */
  executionAuthority?: CombatAutomaticActionAuthority
  committedExecution?: CommittedCombatExecution
  resolveCommittedAbilityOutcomes?: (
    transition: CombatResolutionTransition,
    guard: CombatTriggerGuard,
  ) => CombatResolutionTransition
}
export interface CombatAutomaticActionAuthority {
  readonly activation: 'automatic'
  readonly actorId: string
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
  executionAuthority?: CombatAutomaticActionAuthority,
): CombatActionEvaluation {
  const executionActorId = executionAuthority?.actorId
  action = legacy.elementalActionIntent(
    state,
    airborneAttackAction(state, action, content, executionActorId),
    selection,
  )
  validateCombatAccuracyDefinition(action)
  const csrPreviewAction = materializeCsrPreviewAction(action)
  let materialized = materializeVengeanceDamage(state, csrPreviewAction, executionActorId)
  let evaluation = legacy.evaluateCombatAction(
    state,
    materializeStatScaledDamage(state, materialized.action, executionActorId),
    selection,
    content,
    executionActorId,
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
    materialized = materializeVengeanceDamage(state, csrForecast.action, executionActorId)
    evaluation = legacy.evaluateCombatAction(
      state,
      materializeStatScaledDamage(state, materialized.action, executionActorId),
      selection,
      csrForecast.content,
      executionActorId,
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
  if (context?.resolveCommittedAbilityOutcomes && !context.committedExecution)
    throw new TypeError('invalid-committed-execution-authority')
  if (context?.committedExecution) {
    consumeCommittedCombatExecution(context.committedExecution, state, action, selection, context)
    action = committedCombatAction(action)
  }
  const executionActorId = context?.executionAuthority?.actorId
  if (
    executionActorId &&
    (context?.provenance.sourceCombatantId !== executionActorId || action.cost.spendsAction)
  )
    throw new TypeError('invalid-automatic-execution-authority')
  action = legacy.elementalActionIntent(
    state,
    airborneAttackAction(state, action, content, executionActorId),
    selection,
  )
  validateCombatAccuracyDefinition(action)
  const round = state.tactical.battle.round
  const actorId = executionActorId ?? state.tactical.battle.currentTurn?.combatantId ?? null
  const previewAction = materializeCsrPreviewAction(action)
  const previewMaterializedAction = materializeStatScaledDamage(
    state,
    materializeVengeanceDamage(state, previewAction, executionActorId).action,
    executionActorId,
  )
  const packetGroups = skillPacketGroups(state, action)
  let originalOrdinals = action.effects.map((_effect, ordinal) => ordinal)
  const requiresEvaluation =
    Boolean(packetGroups) ||
    state.statBalancePolicyVersion === 1 ||
    Boolean(context) ||
    Boolean(hitDependentEffects) ||
    action.nativeBasicAttackCommand === true ||
    action.accuracyMode === 'per-target' ||
    action.accuracyRule !== undefined ||
    (state.airbornePolicyVersion === 1 && action.target.kind === 'ground-tile') ||
    action.effects.some((effect) => effect.type === 'sensory') ||
    (state.statBridge?.rulesVersion === 4 && hasCriticalEligibleDamage(action))
  const evaluation = requiresEvaluation
    ? legacy.evaluateCombatAction(
        state,
        previewMaterializedAction,
        selection,
        content,
        executionActorId,
      )
    : null
  const dependentOrdinals = new Set(hitDependentEffects?.effectOrdinals ?? [])
  const prerequisiteGroups = packetGroups
    ?.map((group) => group.filter((ordinal) => !dependentOrdinals.has(ordinal)))
    .filter((group) => group.length)
  let packetAccuracy = packetGroups
    ? rollSkillPacketAccuracy(
        state,
        action,
        evaluation,
        content,
        action.accuracyRule ? [originalOrdinals] : prerequisiteGroups!,
      )
    : null
  let accuracy = packetAccuracy ?? rollCombatSkillAccuracy(state, action, evaluation, content)
  const hitDependentEffectsActivated = hitDependentEffects
    ? (packetGroups === null || prerequisiteGroups!.length > 0) &&
      evaluation?.affectedCombatantIds.some((id) => {
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
  // Canonical accuracy shares one recipient result across every hit-dependent packet.
  // Historical packet groups still own their separate resistance and critical checks.
  if (
    packetGroups &&
    packetAccuracy &&
    hitDependentEffectsActivated &&
    action.accuracyRule === undefined
  ) {
    // Unique tags keep their shared prerequisite roll; repeated bonus tags roll only after confirmation.
    for (const group of packetGroups) {
      const prerequisite = group.filter((ordinal) => !dependentOrdinals.has(ordinal))
      const dependent = group.filter((ordinal) => dependentOrdinals.has(ordinal))
      if (!prerequisite.length || !dependent.length) continue
      for (const [, missed] of packetAccuracy.missedEffectOrdinalsByTarget)
        if (prerequisite.some((ordinal) => missed.has(ordinal)))
          dependent.forEach((ordinal) => missed.add(ordinal))
      packetAccuracy.events = packetAccuracy.events.map((event) =>
        event.effectOrdinals?.some((ordinal) => prerequisite.includes(ordinal))
          ? { ...event, effectOrdinals: group }
          : event,
      )
    }
    const bonus = rollSkillPacketAccuracy(
      packetAccuracy.state,
      action,
      evaluation,
      content,
      packetGroups.filter((group) => group.every((ordinal) => dependentOrdinals.has(ordinal))),
    )
    for (const [id, ordinals] of bonus.missedEffectOrdinalsByTarget) {
      const missed = packetAccuracy.missedEffectOrdinalsByTarget.get(id) ?? new Set<number>()
      ordinals.forEach((ordinal) => missed.add(ordinal))
      packetAccuracy.missedEffectOrdinalsByTarget.set(id, missed)
    }
    const events = [...packetAccuracy.events, ...bonus.events]
    packetAccuracy = {
      ...packetAccuracy,
      state: bonus.state,
      events,
      missedCombatantIds: new Set(
        events
          .filter(
            (event) =>
              !event.hit &&
              !events.some(
                (other) => other.targetCombatantId === event.targetCombatantId && other.hit,
              ),
          )
          .map((event) => event.targetCombatantId),
      ),
    }
    accuracy = packetAccuracy
  }
  if (hitDependentEffects && !hitDependentEffectsActivated) {
    const omitted = new Set(hitDependentEffects.effectOrdinals)
    originalOrdinals = originalOrdinals.filter((_ordinal, index) => !omitted.has(index))
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
  const packets =
    packetGroups && packetAccuracy
      ? rollSkillPacketOutcomes(
          accuracy.state,
          csr.action,
          evaluation,
          csr.content,
          packetGroups,
          csr.effectSourceOrdinals.map((ordinal) => originalOrdinals[ordinal]!),
          packetAccuracy.missedEffectOrdinalsByTarget,
        )
      : null
  const resistance = packets
    ? {
        state: packets.state,
        events: packets.resistanceEvents,
        resistedEffectOrdinalsByTarget: packets.resistedEffectOrdinalsByTarget,
      }
    : rollCombatStatusResistance(
        accuracy.state,
        csr.action,
        evaluation,
        csr.content,
        accuracy.missedCombatantIds,
      )
  const critical = packets
    ? {
        state: packets.state,
        events: packets.criticalEvents,
        criticalEffectOrdinalsByTarget: packets.criticalEffectOrdinalsByTarget,
      }
    : rollCombatCritical(resistance.state, csr.action, evaluation, accuracy.missedCombatantIds)
  const materializedAction = materializeStatScaledDamage(
    critical.state,
    materializeVengeanceDamage(critical.state, csr.action, executionActorId).action,
    executionActorId,
  )
  const provenanceEvaluation =
    evaluation && accuracy.missedCombatantIds.size > 0
      ? {
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
      : evaluation
  let triggerGuard = context?.triggerGuard
  const committed = legacy.executeCombatAction(
    critical.state,
    materializedAction,
    selection,
    csr.content,
    (resolved) => {
      if (!actorId) return resolved
      if (context?.resolveCommittedAbilityOutcomes && provenanceEvaluation)
        resolved = {
          ...resolved,
          state: attachCombatEffectProvenance(
            state,
            resolved.state,
            csr.action,
            provenanceEvaluation,
            context,
            csr.content,
            resistance.resistedEffectOrdinalsByTarget,
          ),
        }
      const reactions = resolveNativeCommittedReactions(
        resolved,
        content,
        actorId,
        action.id,
        round,
        context,
        triggerGuard,
      )
      triggerGuard = reactions.guard
      return reactions.transition
    },
    accuracy.missedCombatantIds,
    critical.criticalEffectOrdinalsByTarget,
    resistance.resistedEffectOrdinalsByTarget,
    packets?.missedEffectOrdinalsByTarget,
    executionActorId,
    context?.committedExecution,
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
  const accuracyEvents: legacy.CombatResolutionEvent[] = action.nativeBasicAttackCommand
    ? accuracy.events.map((event) => {
        const defenseKind = action.tags.includes('mystic') ? 'ward' : 'armor'
        const profile = state.statBridge?.combatants.find(
          (row) => row.combatantId === event.targetCombatantId,
        )
        if (!profile || ![1, 2, 3, 4].includes(state.statBridge?.rulesVersion ?? 0))
          throw new TypeError('native-basic-command-stat-bridge-required')
        return {
          event: 'stat_driven_attack_resolved',
          actorId: event.sourceCombatantId,
          targetId: event.targetCombatantId,
          hitChanceBasisPoints: event.hitChanceBasisPoints,
          rollBasisPoints: event.rollBasisPoints,
          hit: event.hit,
          defenseKind,
          defenseRating: terrainAdjustedDefense(
            state,
            event.targetCombatantId,
            profile[defenseKind],
          ),
          rulesVersion: state.statBridge!.rulesVersion as 1 | 2 | 3 | 4,
        }
      })
    : [...accuracy.events]
  const preCommitEvents = [...accuracyEvents, ...resistance.events, ...critical.events]
  const transition =
    preCommitEvents.length > 0
      ? { ...committedTransition, events: [...preCommitEvents, ...committedTransition.events] }
      : committedTransition
  if (!context || !evaluation) return transition
  return {
    ...(hitDependentEffects ? { hitDependentEffectsActivated } : {}),
    state: context.resolveCommittedAbilityOutcomes
      ? transition.state
      : attachCombatEffectProvenance(
          state,
          transition.state,
          csr.action,
          provenanceEvaluation!,
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

function resolveNativeCommittedReactions(
  resolved: CombatResolutionTransition,
  content: legacy.CombatContentCatalog,
  actorId: string,
  actionId: string,
  round: number,
  context: CombatResolutionContext | undefined,
  guard: CombatTriggerGuard | undefined,
): { transition: CombatResolutionTransition; guard: CombatTriggerGuard | undefined } {
  const command = { sourceCombatantId: actorId, actionId }
  const historyState = recordCommittedDamageHistory(resolved.state, resolved.events, {
    round,
    commandSourceCombatantId: actorId,
  })
  const recovered = applyCommittedAbsorbRecovery(historyState, resolved.events, content, command)
  const reflected = applyCommittedReflect(
    recovered.state,
    resolved.events,
    content,
    command,
    guard,
    Boolean(context?.executionAuthority),
  )
  const native = { state: reflected.state, events: [...recovered.events, ...reflected.events] }
  if (!context?.resolveCommittedAbilityOutcomes)
    return { transition: native, guard: reflected.triggerGuard }
  const children = context.resolveCommittedAbilityOutcomes(
    native,
    reflected.triggerGuard ?? context.triggerGuard,
  )
  return {
    transition: children,
    guard: children.resolution?.triggerGuard ?? reflected.triggerGuard,
  }
}

/** Only an admitted, still-living actor can settle original independent actor packets. */
export function executeCommittedCombatActorEffects(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: legacy.CombatTargetSelection,
  content: legacy.CombatContentCatalog,
  context: CombatResolutionContext,
): CombatResolutionTransition {
  if (!context.committedExecution) throw new TypeError('invalid-committed-execution-authority')
  consumeCommittedCombatExecution(context.committedExecution, state, action, selection, context)
  const actorId = context.provenance.sourceCombatantId
  if (
    state.tactical.battle.lifecycle !== 'active' ||
    !state.tactical.battle.combatants.some((unit) => unit.id === actorId && unit.hp > 0)
  )
    throw new TypeError('committed-actor-settlement-unavailable')
  const evaluation: CombatActionEvaluation = {
    legal: true,
    actionId: action.id,
    actorId,
    primaryPosition: null,
    primaryCombatantId: null,
    affectedTiles: [],
    affectedCombatantIds: [],
    projectedEffects: [],
    projectedTerrain: [],
    projectedEvents: [],
    mpCost: 0,
    spendsAction: false,
    issues: [],
  }
  let guard = context.triggerGuard
  const out = legacy.executeCommittedCombatActorEffects(
    state,
    actorId,
    action,
    content,
    context.committedExecution,
    (resolved, settledEffectOrdinals) => {
      resolved = {
        ...resolved,
        state: attachCombatEffectProvenance(
          state,
          resolved.state,
          action,
          evaluation,
          context,
          content,
          undefined,
          settledEffectOrdinals,
        ),
      }
      const reactions = resolveNativeCommittedReactions(
        resolved,
        content,
        actorId,
        action.id,
        state.tactical.battle.round,
        context,
        guard,
      )
      guard = reactions.guard ?? guard
      return reactions.transition
    },
  )
  const filtered = filterBlockedCovertApplication({
    before: state,
    after: out.state,
    events: out.events,
  })
  return {
    state: filtered.state,
    events: filtered.events as legacy.CombatResolutionEvent[],
    resolution: {
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance: context.provenance,
      triggerGuard: guard,
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
  executionActorId?: string,
): legacy.CombatActionDefinition {
  const actorId =
    state.tactical.battle.lifecycle === 'active'
      ? (executionActorId ?? state.tactical.battle.currentTurn?.combatantId ?? null)
      : null

  const effects: legacy.CombatEffectDefinition[] = action.effects.map((effect) => {
    if (effect.type === 'sensory') {
      throw new TypeError('Sensory must be materialized before legacy effect resolution.')
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
