import type { CombatEncounterState, CombatStatusInstance } from './actions'

export const DEFAULT_SUPPRESS_BASIS_POINTS = 2500

/** Suppress is a single percentage reduction, independent of the modifier stacking budget. */
export function outgoingSuppressionBasisPoints(
  state: Pick<CombatEncounterState, 'statusState'>,
  combatantId: string,
): number {
  return Math.max(
    0,
    ...(state.statusState.find((row) => row.combatantId === combatantId)?.statuses ?? [])
      .filter((status) => status.statusId === 'suppress' && status.timingState !== 'pending')
      .map((status) => status.potencyBasisPoints ?? DEFAULT_SUPPRESS_BASIS_POINTS),
  )
}

/** Preserve the clock of the longer-lived application, and its remaining lifetime. */
export function mergeSuppressStatus(
  previous: CombatStatusInstance | undefined,
  incoming: CombatStatusInstance,
  state: CombatEncounterState,
  recipientId: string,
): CombatStatusInstance {
  const battle = state.tactical.battle
  const index = battle.initiativeOrder.indexOf(recipientId)
  const current = battle.currentTurn
  const acted =
    battle.dynamicInitiativePolicyVersion === 1
      ? battle.actedCombatantIds?.includes(recipientId) === true
      : current !== null && index < current.initiativeIndex
  const deferred = index < 0 || battle.deferredInitiativeCombatantIds?.includes(recipientId)
  // Compare expiry rounds, then boundary vs holder turn. Initiative may reorder
  // future actors, but every holder turn still lies between two round boundaries.
  const expiry = (status: CombatStatusInstance) => {
    if (status.durationScope === 'rounds') return 2 * status.remainingRoundBoundaries!
    const nextRound = acted || deferred ? 1 : 0
    if (status.remainingOwnerTurnEnds !== undefined)
      return (
        2 *
          (status.remainingOwnerTurnEnds -
            1 +
            nextRound +
            (status.skipCurrentOwnerTurnEnd && current?.combatantId === recipientId ? 1 : 0)) +
        1
      )
    const startsNextRound = nextRound || current?.combatantId === recipientId ? 1 : 0
    return 2 * (status.remainingOwnerTurnStarts - 1 + startsNextRound) + 0.5
  }
  const longer = previous && expiry(previous) >= expiry(incoming) ? previous : incoming
  const next: CombatStatusInstance = {
    ...incoming,
    stacks: 1,
    potencyBasisPoints: Math.max(
      previous?.potencyBasisPoints ?? (previous ? DEFAULT_SUPPRESS_BASIS_POINTS : 0),
      incoming.potencyBasisPoints ?? DEFAULT_SUPPRESS_BASIS_POINTS,
    ),
    remainingOwnerTurnStarts: longer.remainingOwnerTurnStarts,
  }
  delete next.applicationModifiers
  delete next.durationScope
  delete next.remainingRoundBoundaries
  delete next.remainingOwnerTurnEnds
  delete next.skipCurrentOwnerTurnEnd
  if (longer.durationScope !== undefined) next.durationScope = longer.durationScope
  if (longer.remainingRoundBoundaries !== undefined)
    next.remainingRoundBoundaries = longer.remainingRoundBoundaries
  if (longer.remainingOwnerTurnEnds !== undefined)
    next.remainingOwnerTurnEnds = longer.remainingOwnerTurnEnds
  if (longer.skipCurrentOwnerTurnEnd !== undefined)
    next.skipCurrentOwnerTurnEnd = longer.skipCurrentOwnerTurnEnd
  return next
}

/** One checked rounding boundary for the ordinary final modifier and Suppress. */
export function scaleSuppressedDirectDamage(
  amount: number,
  multiplier: number,
  suppression: number,
): number {
  if (
    ![amount, multiplier, suppression].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    suppression > 10000
  )
    throw new RangeError(
      'Direct damage modifiers must be safe non-negative integers; Suppress cannot exceed 100%.',
    )
  const scaled = (BigInt(amount) * BigInt(multiplier) * BigInt(10000 - suppression)) / 100000000n
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('Scaled combat value exceeds the safe integer range.')
  return Number(scaled)
}
