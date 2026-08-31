import type { BattleLogView } from '@/server/battle/battle-log-service'

import {
  buildBattleLogPresentation,
  type PresentedBattleLogAction,
  type PresentedBattleLogRound,
} from './battle-log-presentation'

function movementActorsByVersion(entries: BattleLogView['entries']): ReadonlyMap<number, string> {
  const actors = new Map<number, string>()

  for (const entry of entries) {
    if (entry.eventType !== 'combatant_moved' || !entry.actorCombatantId) continue
    actors.set(entry.battleVersion, entry.actorCombatantId)
  }

  return actors
}

/** Keep raw path-step events while showing one movement beat for a continuous move. */
export function summarizeConsecutiveBattleLogMovement(
  rounds: readonly PresentedBattleLogRound[],
  entries: BattleLogView['entries'],
): PresentedBattleLogRound[] {
  const movementActors = movementActorsByVersion(entries)

  return rounds.map((round) => {
    const summarized: PresentedBattleLogAction[] = []

    for (const action of round.actions) {
      const previous = summarized.at(-1)
      let actor: string | undefined
      let previousActor: string | undefined

      if (action.kind === 'movement') actor = movementActors.get(action.battleVersion)
      if (previous?.kind === 'movement') {
        previousActor = movementActors.get(previous.battleVersion)
      }

      const sameContinuousMove =
        Boolean(actor) &&
        previous?.kind === 'movement' &&
        actor === previousActor &&
        action.turnNumber === previous.turnNumber

      if (sameContinuousMove) continue
      summarized.push(action)
    }

    if (summarized.length === round.actions.length) return round
    return { ...round, actions: summarized }
  })
}

export function countSummarizedBattleLogActions(entries: BattleLogView['entries']): number {
  const rounds = summarizeConsecutiveBattleLogMovement(
    buildBattleLogPresentation(entries),
    entries,
  )

  return rounds.reduce((total, round) => total + round.actions.length, 0)
}
