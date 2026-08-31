'use client'

import { useMemo, useState } from 'react'

import type { SkillNarrationTemplate } from '@aurevane/game-core/combat/battle-narration'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import {
  buildBattleLogPresentation,
  type BattleLogSegment,
  type PresentedBattleLogAction,
  type PresentedBattleLogRound,
} from './battle-log-presentation'
import { consolidatePresentedBattleLogRounds } from './battle-log-round-groups'
import {
  countSummarizedBattleLogActions,
  summarizeConsecutiveBattleLogMovement,
} from './battle-log-movement-summary'
import { useBattleCombatantAccents } from './battle-runtime-context'
import styles from './battle-log-feed.module.css'

interface BattleLogFeedProps {
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  skillNarrations?: Readonly<Record<string, SkillNarrationTemplate>>
  emptyMessage?: string
}

export interface BattleLogTranscriptLines {
  primary: readonly BattleLogSegment[]
  secondaryLines: readonly (readonly BattleLogSegment[])[]
}

type TranscriptLineKind = 'primary' | 'secondary'

interface EffectMetadata {
  name: string
  kind: 'Buff' | 'Debuff' | 'Effect'
  duration: string | null
}

function expandedRoundKey(
  rounds: readonly PresentedBattleLogRound[],
  requestedRound: string | null | undefined,
): string | null {
  const defaultRound = rounds[0]?.key ?? null
  if (requestedRound === undefined) return defaultRound
  if (requestedRound === null) return null
  return rounds.some((round) => round.key === requestedRound) ? requestedRound : defaultRound
}

function timeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function combatantAccent(
  item: BattleLogSegment,
  combatantAccents: Readonly<Record<string, string>>,
): string | undefined {
  if (item.role !== 'actor' && item.role !== 'target') return undefined
  const label = item.text
    .trim()
    .replace(/[’']s$/u, '')
    .replace(/[,:;.]$/u, '')
  return combatantAccents[label]
}

function effectDuration(segments: readonly BattleLogSegment[]): string | null {
  const text = segments.map((item) => item.text).join(' ')
  const explicit = text.match(/·\s*([^·]+)$/u)?.[1]?.trim()
  if (explicit) return explicit
  const turns = text.match(/\b(\d+)\s+turns?\b/iu)
  return turns?.[0] ?? null
}

function effectMetadata(
  item: BattleLogSegment,
  action: PresentedBattleLogAction,
  lineKind: TranscriptLineKind,
  segments: readonly BattleLogSegment[],
): EffectMetadata | null {
  const role = item.role ?? 'text'
  const text = item.text.trim()
  if (!text || /\bmiss(?:ed)?\b/iu.test(text)) return null

  const standaloneStatus =
    lineKind === 'primary' && action.kind === 'status' && (role === 'action' || role === 'outcome')
  const consequenceEffect =
    lineKind === 'secondary' &&
    role === 'outcome' &&
    (item.tone === 'benefit' || item.tone === 'warning')

  if (!standaloneStatus && !consequenceEffect) return null

  return {
    name: text,
    kind: item.tone === 'warning' ? 'Debuff' : item.tone === 'benefit' ? 'Buff' : 'Effect',
    duration: effectDuration(segments),
  }
}

function renderTranscriptSegments(
  segments: readonly BattleLogSegment[],
  action: PresentedBattleLogAction,
  lineKind: TranscriptLineKind,
  combatantAccents: Readonly<Record<string, string>>,
) {
  return segments.map((item, index) => {
    const text = lineKind === 'secondary' && index === 0 && item.text === '↳ ' ? '- ' : item.text
    const accent = combatantAccent(item, combatantAccents)
    const effect = effectMetadata(item, action, lineKind, segments)

    return (
      <span
        data-role={item.role ?? 'text'}
        data-tone={item.tone}
        data-semantic={effect ? 'effect' : undefined}
        data-battle-effect-trigger={effect ? 'true' : undefined}
        data-battle-effect-name={effect?.name}
        data-battle-effect-kind={effect?.kind}
        data-battle-effect-duration={effect?.duration ?? undefined}
        role={effect ? 'button' : undefined}
        tabIndex={effect ? 0 : undefined}
        aria-label={effect ? `Explain ${effect.name}` : undefined}
        style={accent ? { color: accent } : undefined}
        key={`${index}:${item.role ?? 'text'}:${text}`}
      >
        {text}
      </span>
    )
  })
}

function trimOutcomeConnector(segments: readonly BattleLogSegment[]): readonly BattleLogSegment[] {
  const trimmed = [...segments]
  const last = trimmed.at(-1)
  if (!last || (last.role ?? 'text') !== 'text') return trimmed

  const text = last.text
    .replace(/\s*—\s*$/u, '')
    .replace(/\s+for\s*$/iu, '')
    .replace(/\s+$/u, '')

  if (!text) trimmed.pop()
  else trimmed[trimmed.length - 1] = { ...last, text }
  return trimmed
}

function lastSegmentWithRole(
  segments: readonly BattleLogSegment[],
  role: BattleLogSegment['role'],
): BattleLogSegment | null {
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const item = segments[index]
    if (item?.role === role) return item
  }
  return null
}

/**
 * Keep each transcript entry focused on the action first, then list the authoritative consequence
 * underneath it. This mirrors Guard's already-readable "action -> status" treatment without
 * changing the underlying battle event model or Battle Log container.
 */
export function buildBattleLogTranscriptLines(
  action: PresentedBattleLogAction,
): BattleLogTranscriptLines {
  const existingSecondary = action.secondary ? [action.secondary] : []
  if (action.kind !== 'offense' && action.kind !== 'recovery') {
    return { primary: action.primary, secondaryLines: existingSecondary }
  }

  const outcomeIndex = action.primary.findIndex((item) => item.role === 'outcome')
  if (outcomeIndex < 0 || outcomeIndex !== action.primary.length - 1) {
    return { primary: action.primary, secondaryLines: existingSecondary }
  }

  const outcome = action.primary[outcomeIndex]
  if (!outcome) return { primary: action.primary, secondaryLines: existingSecondary }

  const primary = trimOutcomeConnector(action.primary.slice(0, outcomeIndex))
  if (primary.length === 0) return { primary: action.primary, secondaryLines: existingSecondary }

  if (action.kind === 'offense') {
    const target = lastSegmentWithRole(primary, 'target')
    // Self-damage and other effect-only offense lines are already consequences, not action prose.
    if (!target) return { primary: action.primary, secondaryLines: existingSecondary }

    const resultLine: readonly BattleLogSegment[] = /\bmiss(?:ed)?\b/iu.test(outcome.text)
      ? [{ text: '↳ ' }, outcome]
      : [{ text: '↳ ' }, target, { text: ' takes ' }, outcome]

    return {
      primary,
      secondaryLines: [resultLine, ...existingSecondary],
    }
  }

  const recipient = lastSegmentWithRole(primary, 'target') ?? lastSegmentWithRole(primary, 'actor')
  if (!recipient) return { primary: action.primary, secondaryLines: existingSecondary }

  const resultLine: readonly BattleLogSegment[] = [
    { text: '↳ ' },
    recipient,
    { text: ' recovers ' },
    outcome,
  ]

  return {
    primary,
    secondaryLines: [resultLine, ...existingSecondary],
  }
}

export function buildBattleLogActionNumbers(
  rounds: readonly PresentedBattleLogRound[],
): ReadonlyMap<string, number> {
  const actions = rounds.flatMap((round) => round.actions)
  const chronological = [...actions].sort((left, right) => {
    if (left.battleVersion !== right.battleVersion) {
      return left.battleVersion - right.battleVersion
    }

    const timeOrder = left.occurredAt.localeCompare(right.occurredAt)
    if (timeOrder !== 0) return timeOrder
    return left.key.localeCompare(right.key)
  })

  return new Map(chronological.map((action, index) => [action.key, index + 1]))
}

export function countBattleLogActions(entries: BattleLogView['entries']): number {
  return countSummarizedBattleLogActions(entries)
}

export function BattleLogFeed({
  entries,
  playerName,
  combatantNames,
  skillNarrations,
  emptyMessage = 'No committed battle actions yet.',
}: BattleLogFeedProps) {
  const combatantAccents = useBattleCombatantAccents()
  const rounds = useMemo(() => {
    const presented = buildBattleLogPresentation(entries, {
      playerName,
      combatantNames,
      skillNarrations,
    })
    const consolidated = consolidatePresentedBattleLogRounds(presented)
    return summarizeConsecutiveBattleLogMovement(consolidated, entries)
  }, [combatantNames, entries, playerName, skillNarrations])
  const actionNumbers = useMemo(() => buildBattleLogActionNumbers(rounds), [rounds])
  const [requestedRound, setRequestedRound] = useState<string | null | undefined>(undefined)
  const expandedRound = expandedRoundKey(rounds, requestedRound)

  if (rounds.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

  return (
    <div className={styles.feed} data-testid="battle-log-feed">
      {rounds.map((round) => {
        const open = expandedRound === round.key
        const roundLabel = round.round === null ? 'Battle' : `Round ${round.round}`
        return (
          <section className={styles.round} data-open={open || undefined} key={round.key}>
            <button
              type="button"
              className={styles.roundHeader}
              aria-expanded={open}
              onClick={() =>
                setRequestedRound((current) =>
                  expandedRoundKey(rounds, current) === round.key ? null : round.key,
                )
              }
            >
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
              <strong className={styles.roundTitle}>{roundLabel}</strong>
              <time dateTime={round.occurredAt}>{timeLabel(round.occurredAt)}</time>
            </button>

            {open ? (
              <ol className={styles.actions} aria-label={`${roundLabel} battle events`}>
                {round.actions.map((action) => {
                  const transcript = buildBattleLogTranscriptLines(action)
                  return (
                    <li
                      className={styles.action}
                      data-kind={action.kind}
                      data-tone={action.tone}
                      data-significance={action.significance}
                      key={action.key}
                    >
                      <article tabIndex={0} aria-label={action.ariaLabel}>
                        <p className={styles.primaryLine}>
                          <span className={styles.eventNumber}>
                            #{actionNumbers.get(action.key)}:
                          </span>
                          <span className={styles.primaryContent}>
                            {renderTranscriptSegments(
                              transcript.primary,
                              action,
                              'primary',
                              combatantAccents,
                            )}
                          </span>
                        </p>
                        {transcript.secondaryLines.map((line, index) => (
                          <p className={styles.secondaryLine} key={`${action.key}:result:${index}`}>
                            {renderTranscriptSegments(line, action, 'secondary', combatantAccents)}
                          </p>
                        ))}
                      </article>
                    </li>
                  )
                })}
              </ol>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
