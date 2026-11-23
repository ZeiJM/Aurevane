import type { CombatContentCatalog, CombatEncounterState } from './actions'
import { combatStatusApplications } from './combat-status-applications'

/** Shared recovery reduction before resource caps; BigInt preserves large reactive totals. */
export function healingDownAdjustedRecovery(
  state: Pick<CombatEncounterState, 'statusState' | 'effectStackingPolicyVersion'>,
  recipientId: string,
  amount: bigint,
  content: CombatContentCatalog,
): bigint {
  const row = state.statusState.find((candidate) => candidate.combatantId === recipientId)
  if (!row) throw new Error(`Missing status state for combatant ${recipientId}.`)
  const hexedStatuses = row.statuses.filter((status) => {
    const definition = content.statuses.find((candidate) => candidate.id === status.statusId)
    if (!definition) throw new Error(`Unknown combat status definition ${status.statusId}.`)
    if (definition.version !== status.statusVersion)
      throw new Error(
        `Combat status ${status.statusId} version does not match the pinned status instance.`,
      )
    return definition.gameplayTags?.includes('Hexed')
  })
  let recovered = amount
  for (const hexed of state.effectStackingPolicyVersion === 1
    ? hexedStatuses
    : hexedStatuses.slice(0, 1))
    for (const application of state.effectStackingPolicyVersion === 1
      ? combatStatusApplications(hexed)
      : [{ ...hexed, stacks: 1 }])
      for (let count = 0; count < application.stacks && recovered > 0n; count += 1)
        recovered =
          (recovered * BigInt(Math.max(0, 10000 - (application.potencyBasisPoints ?? 2500)))) /
          10000n
  return recovered
}
