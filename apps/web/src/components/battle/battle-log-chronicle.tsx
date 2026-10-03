'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
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
      <h4>
        {action.family === 'skill' ? null : <span>{action.family.toUpperCase()} · </span>}
        {action.title}
      </h4>
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
  emptyMessage = 'No committed battle actions yet.',
}: ChronicleNames & { entries: readonly BattleLogEntry[]; emptyMessage?: string }) {
  const rounds = useMemo(
    () => buildBattleChronicle(entries, { playerName, combatantNames }),
    [entries, playerName, combatantNames],
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const followLive = useRef(true)
  const readingAnchor = useRef<{ key: string; offset: number } | null>(null)
  useLayoutEffect(() => {
    const reader = scrollRef.current
    if (reader && followLive.current) reader.scrollTop = reader.scrollHeight
    else if (reader && readingAnchor.current) {
      const anchor = [...reader.querySelectorAll<HTMLElement>('[data-chronicle-action]')].find(
        (item) => item.dataset.chronicleAction === readingAnchor.current?.key,
      )
      if (anchor)
        reader.scrollTop +=
          anchor.getBoundingClientRect().top -
          reader.getBoundingClientRect().top -
          readingAnchor.current.offset
    }
  }, [rounds])
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
          const top = reader.getBoundingClientRect().top
          const anchor = [...reader.querySelectorAll<HTMLElement>('[data-chronicle-action]')].find(
            (item) => item.getBoundingClientRect().bottom > top,
          )
          readingAnchor.current = anchor
            ? {
                key: anchor.dataset.chronicleAction!,
                offset: anchor.getBoundingClientRect().top - top,
              }
            : null
        }
      }}
    >
      {rounds.length === 0 ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        rounds.map((round) => (
          <section className={styles.round} aria-label={`Round ${round.round}`} key={round.round}>
            <h2 className={styles.roundTitle}>ROUND {round.round}</h2>
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
          </section>
        ))
      )}
    </div>
  )
}
