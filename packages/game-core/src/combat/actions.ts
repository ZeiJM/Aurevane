import type { CombatDamageScaling } from './damage-scaling'
import { calculateScaledRawDamage, validateCombatDamageScaling } from './damage-scaling'
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

export interface CombatResolutionTransition
  extends Omit<legacy.CombatResolutionTransition, 'state'> {
  state: CombatEncounterState
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
): CombatResolutionTransition {
  const transition = legacy.executeCombatAction(
    state,
    materializeStatScaledDamage(state, action),
    selection,
    content,
  )
  return { state: transition.state, events: transition.events }
}

function materializeStatScaledDamage(
  state: CombatEncounterState,
  action: CombatActionDefinition,
): legacy.CombatActionDefinition {
  const actorId =
    state.tactical.battle.lifecycle === 'active'
      ? state.tactical.battle.currentTurn?.combatantId ?? null
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
