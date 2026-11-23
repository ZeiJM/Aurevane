import type { BattleLogView } from '@/server/battle/battle-log-service'
import type { PresentedBattleLogAction, PresentedBattleLogRound } from './battle-log-presentation'

export interface PresentedBattleLogTurn {
  key: string
  round: number | null
  turnNumber: number | null
  actions: PresentedBattleLogAction[]
}

/** Keep the authorized history intact; annotations define navigation, never icon capacity. */
export function buildPresentedBattleLogTurns(
  rounds: readonly PresentedBattleLogRound[],
  entries: BattleLogView['entries'],
): PresentedBattleLogTurn[] {
  const points = [
    ...entries
      .filter((entry) => entry.eventType === 'turn_started' && entry.turnNumber !== null)
      .map((entry) => ({
        version: entry.battleVersion,
        index: entry.eventIndex,
        round: entry.round,
        turnNumber: entry.turnNumber,
        action: null as PresentedBattleLogAction | null,
      })),
    ...rounds
      .flatMap((round) => round.actions)
      .map((action) => ({
        version: action.battleVersion,
        index: Math.min(...(action.sourceEntries?.map((entry) => entry.eventIndex) ?? [0])),
        round: action.round,
        turnNumber: action.turnNumber,
        action,
      })),
  ].sort((left, right) => left.version - right.version || left.index - right.index)
  const groups = new Map<string, PresentedBattleLogTurn>()
  let currentRound: number | null = null
  let currentTurn: number | null = null
  for (const point of points) {
    const turnNumber: number | null =
      point.turnNumber ?? (currentRound === point.round ? currentTurn : null)
    const key = `round:${point.round ?? 'battle'}:turn:${turnNumber ?? 'unrecorded'}`
    let group = groups.get(key)
    if (!group) {
      group = { key, round: point.round, turnNumber, actions: [] }
      groups.set(key, group)
    }
    if (point.action) group.actions.push(point.action)
    currentRound = point.round
    currentTurn = turnNumber
  }
  return [...groups.values()]
}

/** Null means follow live history; a stable key keeps older history open during updates. */
export function resolveBattleLogTurnIndex(
  turns: readonly PresentedBattleLogTurn[],
  requestedKey: string | null,
): number {
  if (requestedKey === null) return turns.length - 1
  const index = turns.findIndex((turn) => turn.key === requestedKey)
  return index < 0 ? turns.length - 1 : index
}
