import type { CombatTargetSelection } from './actions'
import type { MatureSkillCombatContext, MatureSkillDefinition } from './mature-skills'
import { executePv1fMatureSkill } from './pv1f-action-economy'
import {
  forecastResonanceForSkill,
  type ResonanceCombatEvent,
  type ResonanceCombatState,
  type ResonanceDefinition,
} from './resonance'
import type { StatDrivenCombatEncounterState } from './stat-driven-combat'

export interface Pv1fMatureSkillResonanceTransition {
  readonly state: StatDrivenCombatEncounterState
  readonly resonanceState: ResonanceCombatState
  readonly events: readonly unknown[]
}

export function executePv1fMatureSkillWithResonance(input: {
  readonly state: StatDrivenCombatEncounterState
  readonly resonance: ResonanceDefinition
  readonly resonanceState: ResonanceCombatState
  readonly skill: MatureSkillDefinition
  readonly combatContext: MatureSkillCombatContext
  readonly selection: CombatTargetSelection
}): Pv1fMatureSkillResonanceTransition {
  const forecast = forecastResonanceForSkill(input.resonance, input.resonanceState, input.skill)
  const resolvedSkill: MatureSkillDefinition = forecast.willActivate
    ? {
        ...input.skill,
        effects: [...input.skill.effects, ...forecast.bonusEffects],
      }
    : input.skill

  // Keep all Skill legality, cooldown and Action Economy authority on the canonical PV-1F path.
  // Resonance only contributes the bounded authored payoff effects before that path resolves.
  const resolution = executePv1fMatureSkill(
    input.state,
    resolvedSkill,
    input.selection,
    input.combatContext,
  )
  const actorId = readActionActorId(resolution.events)
  if (!actorId)
    throw new Error('PV-1F Resonance resolution did not emit a combat action event.')

  const resonanceEvents: ResonanceCombatEvent[] = []
  let nextArmedByActionId = input.resonanceState.armedByActionId

  if (forecast.willActivate && input.resonanceState.armedByActionId) {
    resonanceEvents.push({
      event: 'resonance_activated',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.resonanceState.armedByActionId,
      payoffActionId: input.skill.id,
    })
    nextArmedByActionId = null
  } else if (forecast.willExpireArmedSetup && input.resonanceState.armedByActionId) {
    resonanceEvents.push({
      event: 'resonance_expired',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.resonanceState.armedByActionId,
      interruptedByActionId: input.skill.id,
    })
    nextArmedByActionId = null
  }

  if (forecast.willArm) {
    resonanceEvents.push({
      event: 'resonance_armed',
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      actorId,
      setupActionId: input.skill.id,
    })
    nextArmedByActionId = input.skill.id
  }

  return {
    state: resolution.state,
    resonanceState: {
      resonanceId: input.resonance.id,
      contentVersion: input.resonance.contentVersion,
      armedByActionId: nextArmedByActionId,
    },
    events: insertResonanceEventsAfterActionUse(resolution.events, resonanceEvents),
  }
}

function readActionActorId(events: readonly unknown[]): string | null {
  const actionUsed = events.find((event) => readEventName(event) === 'combat_action_used')
  if (!actionUsed || typeof actionUsed !== 'object') return null
  const actorId = (actionUsed as { actorId?: unknown }).actorId
  return typeof actorId === 'string' && actorId.length > 0 ? actorId : null
}

function readEventName(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null
  const value = (event as { event?: unknown }).event
  return typeof value === 'string' ? value : null
}

function insertResonanceEventsAfterActionUse(
  combatEvents: readonly unknown[],
  resonanceEvents: readonly ResonanceCombatEvent[],
): readonly unknown[] {
  if (resonanceEvents.length === 0) return combatEvents
  const actionIndex = combatEvents.findIndex(
    (event) => readEventName(event) === 'combat_action_used',
  )
  if (actionIndex < 0) return [...resonanceEvents, ...combatEvents]
  return [
    ...combatEvents.slice(0, actionIndex + 1),
    ...resonanceEvents,
    ...combatEvents.slice(actionIndex + 1),
  ]
}
