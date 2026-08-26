import type { PresentedBattleLogAction, PresentedBattleLogRound } from './battle-log-presentation'

interface MutablePresentedBattleLogRound {
  key: string
  round: number | null
  occurredAt: string
  actions: PresentedBattleLogAction[]
}

/**
 * The presentation layer emits action groups in newest-first commit order. A round can therefore
 * appear in more than one non-contiguous segment when history is reconstructed from persisted
 * events. The feed should still render exactly one section per numbered round.
 */
export function consolidatePresentedBattleLogRounds(
  rounds: readonly PresentedBattleLogRound[],
): PresentedBattleLogRound[] {
  const grouped = new Map<string, MutablePresentedBattleLogRound>()

  for (const round of rounds) {
    const existing = grouped.get(round.key)
    if (existing) {
      existing.actions.push(...round.actions)
      continue
    }

    grouped.set(round.key, {
      key: round.key,
      round: round.round,
      occurredAt: round.occurredAt,
      actions: [...round.actions],
    })
  }

  return [...grouped.values()].sort((left, right) => {
    if (left.round === null && right.round === null) return 0
    if (left.round === null) return 1
    if (right.round === null) return -1
    return right.round - left.round
  })
}
