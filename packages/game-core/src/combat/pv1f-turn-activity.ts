import type { CombatEncounterState } from './actions'
import { PV1F_BASIC_ATTACK_COST, PV1F_GUARD_COST } from './pv1f-skills'

export const PV1F_TURN_ACTIVITY_RESOURCE_KEY = 'pv1f.activity-turn' as const

/** Shared native Manual participation, after payment and before any reaction. */
export function markPv1fTurnActivity<State extends CombatEncounterState>(
  state: State,
  actorId: string,
): State {
  const battle = state.tactical.battle
  if (battle.lifecycle !== 'active' || battle.currentTurn?.combatantId !== actorId)
    throw new TypeError('manual-participation-turn-mismatch')
  const actor = battle.combatants.find((unit) => unit.id === actorId)!
  const ap = actor.temporaryResources.find((row) => row.key === 'pv1f.action-economy')
  if (!ap) return state
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...battle,
        combatants: battle.combatants.map((unit) =>
          unit.id === actorId
            ? {
                ...unit,
                temporaryResources: [
                  ...unit.temporaryResources.filter(
                    (row) => row.key !== PV1F_TURN_ACTIVITY_RESOURCE_KEY,
                  ),
                  {
                    key: PV1F_TURN_ACTIVITY_RESOURCE_KEY,
                    current: battle.turnNumber,
                    maximum: Number.MAX_SAFE_INTEGER,
                  },
                ].sort((left, right) => left.key.localeCompare(right.key)),
              }
            : unit,
        ),
        currentTurn: {
          ...battle.currentTurn,
          actionState:
            ap.current >= Math.min(PV1F_BASIC_ATTACK_COST, PV1F_GUARD_COST) ? 'ready' : 'spent',
        },
      },
    },
  }
}
