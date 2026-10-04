'use client'

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { renderBattleFlavorTemplate } from '@aurevane/game-core/combat/battle-narration'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { BattleInfoPopover } from './battle-info-popover'
import {
  buildBattleChronicle,
  type ChronicleAction,
  type ChronicleNames,
} from './battle-log-chronicle-model'
import styles from './battle-log-chronicle.module.css'

function story(action: ChronicleAction, actorName: string): string {
  return (
    renderBattleFlavorTemplate(action.flavorTemplate, {
      actor: { name: actorName, ...action.narrator?.actor },
      target: { name: action.targetName, ...action.narrator?.target },
      ability: action.title,
    }) ?? action.fallbackNarration
  )
}

function ChronicleTechnique({ action, actorName }: { action: ChronicleAction; actorName: string }) {
  const narration = story(action, actorName)
  return (
    <article
      className={styles.technique}
      data-chronicle-family={action.family}
      data-chronicle-action={action.key}
    >
      {action.title ? (
        <h4>
          <span className={styles.actionIcon} aria-hidden="true" data-chronicle-action-start="true">
            ◆
          </span>{' '}
          {action.family === 'skill' || action.family === 'movement' ? null : (
            <span>{action.family.toUpperCase()} · </span>
          )}
          {action.title}
        </h4>
      ) : null}
      {narration ? <p className={styles.narration}>{narration}</p> : null}
      {action.outcomes.length > 0 ? (
        <p className={styles.outcomes}>
          {action.outcomes.map((result, index) => (
            <span key={result.key} data-outcome-tone={result.tone}>
              {index > 0 ? <span className={styles.separator}> · </span> : null}
              {result.statusId ? (
                <BattleInfoPopover
                  hover
                  consumeOutsideClick
                  label={`Explain ${combatStatusDetails(result.statusId).name}`}
                  title={combatStatusDetails(result.statusId).name}
                  className={styles.effect}
                  trigger={result.text}
                >
                  <p>{combatStatusDetails(result.statusId).description}</p>
                  {result.duration ? <p>Recorded duration: {result.duration}.</p> : null}
                </BattleInfoPopover>
              ) : (
                result.text
              )}
              {result.recipient ? (
                <span className={styles.recipient}>{result.recipient}</span>
              ) : null}
            </span>
          ))}
        </p>
      ) : action.family !== 'movement' && action.family !== 'idle' ? (
        <p className={styles.outcomes}>Action recorded; no effect result available.</p>
      ) : null}
      {action.specials.map((special) => (
        <ChronicleTechnique key={special.key} action={special} actorName={actorName} />
      ))}
    </article>
  )
}

export function BattleLogChronicle({
  entries,
  playerName,
  combatantNames,
  currentRound,
  emptyMessage = 'No committed battle actions yet.',
}: ChronicleNames & {
  entries: readonly BattleLogEntry[]
  currentRound?: number
  emptyMessage?: string
}) {
  const rounds = useMemo(
    () => buildBattleChronicle(entries, { playerName, combatantNames }),
    [entries, playerName, combatantNames],
  )
  const liveRound =
    currentRound ?? entries.reduce((latest, entry) => Math.max(latest, entry.round ?? 1), 1)
  const [roundOverrides, setRoundOverrides] = useState<Readonly<Record<number, boolean>>>({})
  const [readingRound, setReadingRound] = useState<number | null>(null)
  const readerId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const followLive = useRef(true)
  const readingAnchor = useRef<{ key: string; round: string; offset: number } | null>(null)

  function rememberReadingPosition() {
    const reader = scrollRef.current
    if (!reader) return null
    const top = reader.getBoundingClientRect().top
    const anchor = [
      ...reader.querySelectorAll<HTMLElement>(
        '[data-chronicle-action], [data-chronicle-round-anchor]',
      ),
    ].find((item) => item.getClientRects().length > 0 && item.getBoundingClientRect().bottom > top)
    readingAnchor.current = anchor
      ? {
          key: anchor.dataset.chronicleAction ?? `round:${anchor.dataset.chronicleRoundAnchor}`,
          round: anchor.closest<HTMLElement>('[data-chronicle-round]')!.dataset.chronicleRound!,
          offset: anchor.getBoundingClientRect().top - top,
        }
      : null
    const round = anchor?.closest<HTMLElement>('[data-chronicle-round]')
    const content = round?.querySelector<HTMLElement>('[data-chronicle-round-content]')
    return round && content && !content.hidden ? Number(round.dataset.chronicleRound) : null
  }

  useLayoutEffect(() => {
    const reader = scrollRef.current
    if (reader && followLive.current) reader.scrollTop = reader.scrollHeight
    else if (reader && readingAnchor.current) {
      const saved = readingAnchor.current
      const anchors = [
        ...reader.querySelectorAll<HTMLElement>(
          '[data-chronicle-action], [data-chronicle-round-anchor]',
        ),
      ]
      const anchor = anchors.find(
        (item) =>
          (item.dataset.chronicleAction ?? `round:${item.dataset.chronicleRoundAnchor}`) ===
            saved.key && item.getClientRects().length > 0,
      )
      const fallback = anchors.find((item) => item.dataset.chronicleRoundAnchor === saved.round)
      const target = anchor ?? fallback
      if (target)
        reader.scrollTop +=
          target.getBoundingClientRect().top -
          reader.getBoundingClientRect().top -
          (anchor ? saved.offset : 0)
    }
  }, [rounds, liveRound, roundOverrides, readingRound])
  return (
    <div
      className={styles.chronicle}
      role="region"
      aria-label="Battle chronicle"
      data-testid="battle-log-feed"
      data-battle-chronicle="true"
      data-battle-log-reader="true"
      tabIndex={0}
      ref={scrollRef}
      onScroll={() => {
        const reader = scrollRef.current
        if (reader) {
          followLive.current = reader.scrollHeight - reader.clientHeight - reader.scrollTop < 24
          const visibleRound = rememberReadingPosition()
          setReadingRound(followLive.current ? null : visibleRound)
        }
      }}
    >
      {rounds.length === 0 ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        rounds.map((round) => {
          const current = round.round === liveRound
          const expanded =
            current ||
            (roundOverrides[round.round] ??
              (round.round === liveRound - 1 || round.round === readingRound))
          const contentId = `${readerId}-round-${round.round}`
          return (
            <section
              className={styles.round}
              aria-label={`Round ${round.round}`}
              key={round.round}
              data-chronicle-round={round.round}
              data-chronicle-current-round={current || undefined}
            >
              <h2 className={styles.roundTitle} data-chronicle-round-anchor={round.round}>
                {current ? (
                  <span className={styles.currentRound}>ROUND {round.round}</span>
                ) : (
                  <button
                    type="button"
                    className={styles.roundToggle}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} round ${round.round}`}
                    aria-expanded={expanded}
                    aria-controls={contentId}
                    onClick={() => {
                      followLive.current = false
                      rememberReadingPosition()
                      setRoundOverrides((overrides) => ({ ...overrides, [round.round]: !expanded }))
                    }}
                  >
                    <span className={styles.chevron} aria-hidden="true">
                      ›
                    </span>
                    ROUND {round.round}
                  </button>
                )}
              </h2>
              <div id={contentId} data-chronicle-round-content={round.round} hidden={!expanded}>
                {round.actors.map((actor) => (
                  <section
                    className={styles.actor}
                    data-chronicle-actor={actor.actorId}
                    key={actor.actorId}
                  >
                    <h3>{actor.name}</h3>
                    {actor.actions.map((action) => (
                      <ChronicleTechnique key={action.key} action={action} actorName={actor.name} />
                    ))}
                  </section>
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
