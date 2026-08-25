'use client'

import { useMemo, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import {
  buildBattleLogPresentation,
  countPresentedBattleLogActions,
  type BattleLogSegment,
  type PresentedBattleLogRound,
} from './battle-log-presentation'
import styles from './battle-log-feed.module.css'

interface BattleLogFeedProps {
  entries: BattleLogView['entries']
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
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

function kindGlyph(kind: string): string {
  if (kind === 'offense') return '⚔'
  if (kind === 'movement') return '↗'
  if (kind === 'defense') return '◇'
  if (kind === 'recovery') return '✚'
  if (kind === 'status') return '◆'
  if (kind === 'resource') return '◈'
  if (kind === 'turn') return '◷'
  return '•'
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

export function countBattleLogActions(entries: BattleLogView['entries']): number {
  return countPresentedBattleLogActions(entries)
}

export function BattleLogFeed({
  entries,
  playerName,
  combatantNames,
  emptyMessage = 'No committed battle actions yet.',
}: BattleLogFeedProps) {
  const rounds = useMemo(
    () => buildBattleLogPresentation(entries, { playerName, combatantNames }),
    [combatantNames, entries, playerName],
  )
  const [requestedRound, setRequestedRound] = useState<string | null | undefined>(undefined)
  const expandedRound = expandedRoundKey(rounds, requestedRound)

  if (rounds.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

  return (
    <div className={styles.feed} data-testid="battle-log-feed">
      {rounds.map((round) => {
        const open = expandedRound === round.key
        const roundLabel = round.round === null ? 'Recent' : `Round ${round.round}`
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
              <span className={styles.roundTitle}>
                <strong>{roundLabel}</strong>
                <small>
                  {round.actions.length} action{round.actions.length === 1 ? '' : 's'}
                </small>
              </span>
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
                      <span className={styles.glyph} aria-hidden="true">
                        {kindGlyph(action.kind)}
                      </span>
                      <div className={styles.actionMain}>
                        <p className={styles.primaryLine}>{renderSegments(action.primary)}</p>
                        {action.secondary ? (
                          <p className={styles.secondaryLine}>{renderSegments(action.secondary)}</p>
                        ) : null}
                        {action.details.length > 0 ? (
                          <details className={styles.details}>
                            <summary>Details</summary>
                            <p>
                              {action.details.map((item, index) => (
                                <span data-tone={item.tone} key={`${item.tone}:${item.label}`}>
                                  {index > 0 ? ' · ' : ''}
                                  {item.label}
                                </span>
                              ))}
                            </p>
                          </details>
                        ) : null}
                      </div>
                      <div className={styles.actionMeta} aria-hidden="true">
                        {action.turnNumber !== null ? (
                          <small>Turn {action.turnNumber}</small>
                        ) : null}
                        <time dateTime={action.occurredAt}>{timeLabel(action.occurredAt)}</time>
                      </div>
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
