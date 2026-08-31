'use client'

import { useMemo, useState } from 'react'

import type { SkillNarrationTemplate } from '@aurevane/game-core/combat/battle-narration'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import {
  buildBattleLogPresentation,
  countPresentedBattleLogActions,
  type BattleLogSegment,
  type PresentedBattleLogRound,
} from './battle-log-presentation'
import { consolidatePresentedBattleLogRounds } from './battle-log-round-groups'
import styles from './battle-log-feed.module.css'

interface BattleLogFeedProps {
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  skillNarrations?: Readonly<Record<string, SkillNarrationTemplate>>
  emptyMessage?: string
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

function renderSegments(segments: readonly BattleLogSegment[]) {
  return segments.map((item, index) => (
    <span
      data-role={item.role ?? 'text'}
      data-tone={item.tone}
      key={`${index}:${item.role ?? 'text'}:${item.text}`}
    >
      {item.text}
    </span>
  ))
}

function renderSecondarySegments(segments: readonly BattleLogSegment[]) {
  return segments.map((item, index) => {
    const text = index === 0 && item.text === '↳ ' ? '- ' : item.text
    return (
      <span
        data-role={item.role ?? 'text'}
        data-tone={item.tone}
        key={`${index}:${item.role ?? 'text'}:${text}`}
      >
        {text}
      </span>
    )
  })
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
  return countPresentedBattleLogActions(entries)
}

export function BattleLogFeed({
  entries,
  playerName,
  combatantNames,
  skillNarrations,
  emptyMessage = 'No committed battle actions yet.',
}: BattleLogFeedProps) {
  const rounds = useMemo(() => {
    const presented = buildBattleLogPresentation(entries, {
      playerName,
      combatantNames,
      skillNarrations,
    })
    return consolidatePresentedBattleLogRounds(presented)
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
                {round.actions.map((action) => (
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
                        </span>{' '}
                        {renderSegments(action.primary)}
                      </p>
                      {action.secondary ? (
                        <p className={styles.secondaryLine}>
                          {renderSecondarySegments(action.secondary)}
                        </p>
                      ) : null}
                    </article>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
