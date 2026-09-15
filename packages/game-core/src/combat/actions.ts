import type { CombatDamageScaling } from './damage-scaling'
import { calculateScaledRawDamage, validateCombatDamageScaling } from './damage-scaling'
import { applyCommittedAbsorbHp } from './combat-absorb-hp'
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
  | (LegacyDamageEffect & { scaling?: CombatDamageScaling })

export interface CombatActionDefinition extends Omit<legacy.CombatActionDefinition, 'effects'> {
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
    }[]
  }
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
): legacy.CombatActionEvaluation {
  return legacy.evaluateCombatAction(
    state,
    materializeStatScaledDamage(state, action),
    selection,
    content,
  )
}

export function executeCombatAction(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  selection: legacy.CombatTargetSelection,
  content: legacy.CombatContentCatalog,
  context?: CombatResolutionContext,
): CombatResolutionTransition {
  const round = state.tactical.battle.round
  const actorId = state.tactical.battle.currentTurn?.combatantId ?? null
  const materializedAction = materializeStatScaledDamage(state, action)
  const evaluation = context
    ? legacy.evaluateCombatAction(state, materializedAction, selection, content)
    : null
  const transition = legacy.executeCombatAction(state, materializedAction, selection, content)
  const historyState = actorId
    ? recordCommittedDamageHistory(transition.state, transition.events, {
        round,
        commandSourceCombatantId: actorId,
      })
    : transition.state
  const recovered = actorId
    ? applyCommittedAbsorbHp(historyState, transition.events, content, {
        sourceCombatantId: actorId,
        actionId: action.id,
      })
    : { state: historyState, events: transition.events }

  if (!context || !evaluation) {
    return recovered
  }

  return {
    state: attachCombatEffectProvenance(state, recovered.state, action, evaluation, context),
    events: recovered.events,
    resolution: {
      pipelineVersion: COMBAT_RESOLUTION_PIPELINE_VERSION,
      provenance: context.provenance,
      triggerGuard: context.triggerGuard,
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
