import { combatStatusTuning } from './combat-status-tuning'
import type { CombatStatusInstance } from './actions'

/** Reapplications share the status lifetime, but never rewrite earlier magnitude or source. */
export function combatStatusApplications(status: CombatStatusInstance) {
  return (
    status.applicationModifiers ?? [
      {
        stacks: status.stacks,
        ...combatStatusTuning(status),
        ...(status.counter ? { counter: status.counter } : {}),
        sourceCombatantId: status.sourceCombatantId,
        ...(status.sourceCommandVisibility
          ? { sourceCommandVisibility: status.sourceCommandVisibility }
          : {}),
        ...(status.blindsideModifiersBasisPoints === undefined
          ? {}
          : { blindsideModifiersBasisPoints: status.blindsideModifiersBasisPoints }),
        ...(status.potencyBasisPoints === undefined
          ? {}
          : { potencyBasisPoints: status.potencyBasisPoints }),
      },
    ]
  )
}
