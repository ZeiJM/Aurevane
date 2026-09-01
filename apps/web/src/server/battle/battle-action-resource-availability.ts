import { PV1F_MP_RECOVER_ACTION_ID } from '@aurevane/game-core/combat/pv1f-skills'
import type { StatDrivenCombatEncounterState } from '@aurevane/game-core/combat/stat-driven-combat'
import type { BattleIntent } from '@aurevane/validation/combat/battle-session'

export interface BattleActionResourceIssue {
  code: string
  message: string
}

export function battleActionResourceIssue(
  state: StatDrivenCombatEncounterState,
  intent: BattleIntent,
): BattleActionResourceIssue | null {
  if (intent.kind !== 'action' || intent.actionId !== PV1F_MP_RECOVER_ACTION_ID) return null

  const actorId = state.tactical.battle.currentTurn?.combatantId
  if (!actorId) return null
  const actor = state.tactical.battle.combatants.find((combatant) => combatant.id === actorId)
  if (!actor || actor.mp < actor.maxMp) return null

  return {
    code: 'actor-mp-full',
    message: 'MP is already full.',
  }
}
