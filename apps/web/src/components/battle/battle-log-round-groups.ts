import type { PresentedBattleLogAction, PresentedBattleLogRound } from './battle-log-presentation'

interface MutablePresentedBattleLogRound {
  key: string
  round: number | null
  occurredAt: string
  actions: PresentedBattleLogAction[]
}

export const BATTLE_LOG_VISIBLE_TURN_LIMIT = 10

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

/**
 * Keep the battle log bounded to the newest distinct turn numbers while preserving every action
 * that belongs to those turns. Recent roundless/system events are kept only when they happened
 * within the retained turn window; older battle-start bookkeeping naturally falls away.
 */
export function limitPresentedBattleLogTurns(
  rounds: readonly PresentedBattleLogRound[],
  maxTurns = BATTLE_LOG_VISIBLE_TURN_LIMIT,
): PresentedBattleLogRound[] {
  if (maxTurns <= 0) return []

  const actionsNewestFirst = rounds
    .flatMap((round) => round.actions)
    .sort((left, right) => right.battleVersion - left.battleVersion)
  const retainedTurns = new Set<number>()

  for (const action of actionsNewestFirst) {
    if (action.turnNumber === null || retainedTurns.has(action.turnNumber)) continue
    retainedTurns.add(action.turnNumber)
    if (retainedTurns.size >= maxTurns) break
  }

  if (retainedTurns.size === 0 || retainedTurns.size < maxTurns) return [...rounds]

  const oldestRetainedVersion = actionsNewestFirst.reduce<number | null>((oldest, action) => {
    if (action.turnNumber === null || !retainedTurns.has(action.turnNumber)) return oldest
    return oldest === null ? action.battleVersion : Math.min(oldest, action.battleVersion)
  }, null)

  if (oldestRetainedVersion === null) return [...rounds]

  return rounds.flatMap((round) => {
    const actions = round.actions.filter((action) => {
      if (action.turnNumber !== null) return retainedTurns.has(action.turnNumber)
      return action.battleVersion >= oldestRetainedVersion
    })

    return actions.length > 0 ? [{ ...round, actions }] : []
  })
}
