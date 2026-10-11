import type { SkillNarrationTemplate } from '@aurevane/game-core/combat/battle-narration'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import {
  buildBattleChronicle,
  type ChronicleAction,
  type ChronicleNames,
} from './battle-log-chronicle-model'
import {
  chronicleActionNarration,
  chronicleActionTitle,
  chronicleMissingResult,
} from './battle-log-chronicle-text'

interface BattleLogClipboardOptions extends ChronicleNames {
  currentRound?: number
  /** Retained for existing callers; Chronicle narration comes from viewer-safe pinned history. */
  skillNarrations?: Readonly<Record<string, SkillNarrationTemplate>>
}

function actionLines(action: ChronicleAction, actorName: string): string[] {
  const title = chronicleActionTitle(action)
  const narration = chronicleActionNarration(action, actorName)
  const missingResult = chronicleMissingResult(action)
  const outcomes = action.outcomes
    .map((result) => `${result.text}${result.recipient ?? ''}`)
    .join(' · ')
  return [
    ...(title ? [title] : []),
    ...(narration ? [narration] : []),
    ...(outcomes ? [outcomes] : []),
    ...(missingResult ? [missingResult] : []),
    ...action.specials.flatMap((special) => actionLines(special, actorName)),
  ]
}

/** Copy every round from the same viewer-safe model as the reader, even when collapsed. */
export function formatBattleLogForClipboard(
  entries: BattleLogView['entries'],
  options: BattleLogClipboardOptions = {},
): string {
  return buildBattleChronicle(entries, options)
    .map((round) =>
      [
        `ROUND ${round.round}`,
        ...round.actors.flatMap((actor) => [
          actor.name,
          ...actor.actions.flatMap((action) => actionLines(action, actor.name)),
        ]),
      ].join('\n'),
    )
    .join('\n\n')
}
