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
import {
  consolidatePresentedBattleLogRounds,
  limitPresentedBattleLogTurns,
} from './battle-log-round-groups'
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
  skillNarrations,
  emptyMessage = 'No committed battle actions yet.',
}: BattleLogFeedProps) {
  const rounds = useMemo(() => {
    const presented = buildBattleLogPresentation(entries, {
      playerName,
      combatantNames,
      skillNarrations,
    })
    const consolidated = consolidatePresentedBattleLogRounds(presented)
    return limitPresentedBattleLogTurns(consolidated)
  }, [combatantNames, entries, playerName, skillNarrations])
  const [requestedRound, setRequestedRound] = useState<string | null | undefined>(undefined)
  const expandedRound = expandedRoundKey(rounds, requestedRound)

  if (rounds.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

  return (
    <div className={styles.feed} data-testid="battle-log-feed">
      {rounds.map((round, index) => {
        const open = expandedRound === round.key
        const latest = index === 0 && round.round !== null
        const roundLabel = round.round === null ? 'Battle' : `Round ${round.round}`
        return (
          <section
            className={styles.round}
            data-latest={latest || undefined}
            data-open={open || undefined}
            key={round.key}
          >
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
                {latest ? <em>Latest</em> : null}
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
                              {action.details.map((item, detailIndex) => (
                                <span data-tone={item.tone} key={`${item.tone}:${item.label}`}>
                                  {detailIndex > 0 ? ' · ' : ''}
                                  {item.label}
                                </span>
                              ))}
                            </p>
                          </details>
                        ) : null}
                      </div>
                      {action.turnNumber !== null ? (
                        <div className={styles.actionMeta} aria-hidden="true">
                          <small>Turn {action.turnNumber}</small>
                        </div>
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
