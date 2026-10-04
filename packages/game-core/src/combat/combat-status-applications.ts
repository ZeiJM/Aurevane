import type { CombatStatusInstance } from './actions'

/** Reapplications share the status lifetime, but never rewrite earlier magnitude or source. */
export function combatStatusApplications(status: CombatStatusInstance) {
  return (
    status.applicationModifiers ?? [
      {
        stacks: status.stacks,
        sourceCombatantId: status.sourceCombatantId,
        ...(status.potencyBasisPoints === undefined
          ? {}
          : { potencyBasisPoints: status.potencyBasisPoints }),
      },
    ]
  )
}
