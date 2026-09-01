import type { SkillNarrationTemplate } from '@aurevane/game-core/combat/battle-narration'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import { buildBattleLogActionNumbers, buildBattleLogTranscriptLines } from './battle-log-feed'
import {
  buildBattleLogPresentation,
  type BattleLogSegment,
  type PresentedBattleLogRound,
} from './battle-log-presentation'
import { summarizeConsecutiveBattleLogMovement } from './battle-log-movement-summary'
import { consolidatePresentedBattleLogRounds } from './battle-log-round-groups'

interface BattleLogClipboardOptions {
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  skillNarrations?: Readonly<Record<string, SkillNarrationTemplate>>
}

function segmentText(segments: readonly BattleLogSegment[], secondary = false): string {
  return segments
    .map((segment, index) =>
      secondary && index === 0 && segment.text === '↳ ' ? '- ' : segment.text,
    )
    .join('')
    .trimEnd()
}

function firstActionNumber(
  round: PresentedBattleLogRound,
  actionNumbers: ReadonlyMap<string, number>,
): number {
  return Math.min(...round.actions.map((action) => actionNumbers.get(action.key) ?? Infinity))
}

/**
 * Formats the authoritative event stream through the same player-facing presentation pipeline used
 * by the in-battle log. Raw event versions, coordinates, AI planning chatter, and internal timing
 * stay available to the server but are intentionally omitted from clipboard output.
 */
export function formatBattleLogForClipboard(
  entries: BattleLogView['entries'],
  options: BattleLogClipboardOptions = {},
): string {
  const presented = buildBattleLogPresentation(entries, options)
  const consolidated = consolidatePresentedBattleLogRounds(presented)
  const rounds = summarizeConsecutiveBattleLogMovement(consolidated, entries)
  const actionNumbers = buildBattleLogActionNumbers(rounds)
  const chronologicalRounds = [...rounds].sort(
    (left, right) =>
      firstActionNumber(left, actionNumbers) - firstActionNumber(right, actionNumbers),
  )

  const blocks = chronologicalRounds.map((round) => {
    const roundLabel = round.round === null ? 'Battle' : `Round ${round.round}`
    const actions = [...round.actions].sort(
      (left, right) =>
        (actionNumbers.get(left.key) ?? Infinity) - (actionNumbers.get(right.key) ?? Infinity),
    )
    const lines = [roundLabel]

    for (const action of actions) {
      const actionNumber = actionNumbers.get(action.key)
      if (!actionNumber) continue

      const transcript = buildBattleLogTranscriptLines(action)
      lines.push(`#${actionNumber}: ${segmentText(transcript.primary)}`)
      for (const secondary of transcript.secondaryLines) {
        lines.push(`   ${segmentText(secondary, true)}`)
      }
    }

    return lines.join('\n')
  })

  return blocks.join('\n\n')
}
