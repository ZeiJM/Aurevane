import type { CombatEncounterState } from '@aurevane/game-core/combat/actions'
import {
  activePersistentCombatStatusRows,
  pendingCombatStatusRows,
} from '@aurevane/game-core/combat/combat-effect-timing'

/** Public, non-concealed fixture rows must follow the production presentation projection. */
export function projectPercentageDotFixtureState<T extends CombatEncounterState>(state: T): T {
  const presented = [...pendingCombatStatusRows(state), ...activePersistentCombatStatusRows(state)]
  return {
    ...state,
    statusState: state.statusState.map((row) => ({
      ...row,
      statuses: [
        ...row.statuses,
        ...presented
          .filter((item) => item.combatantId === row.combatantId)
          .map((item) => item.status),
      ],
    })),
  }
}
