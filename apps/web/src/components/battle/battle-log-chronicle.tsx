'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useSkillElementalDamagePolicyVersion } from '../character/skill-effect-timing-context'
import { statusPotencyDescription } from '@/lib/status-potency-presentation'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'

import type { BattleLogEntry } from '@/server/battle/battle-log-service'

import { BattleInfoPopover } from './battle-info-popover'
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
import styles from './battle-log-chronicle.module.css'
import { chronicleActionArtwork } from './battle-chronicle-artwork'

function chronicleScrollPort(reader: HTMLDivElement): HTMLElement {
  const lower = reader.closest<HTMLElement>('[data-battle-mobile-lower-panel]')
  return lower && getComputedStyle(lower).display !== 'contents' ? lower : reader
}

function ChronicleTechnique({
  action,
  actorName,
  elementalDamagePolicyVersion,
}: {
  action: ChronicleAction
  actorName: string
  elementalDamagePolicyVersion: 1 | 2 | null
}) {
  const narration = chronicleActionNarration(action, actorName)
  const title = chronicleActionTitle(action)
  const missingResult = chronicleMissingResult(action)
  return (
    <article
      className={styles.technique}
      data-chronicle-family={action.family}
      data-chronicle-action={action.key}
    >
      {title ? (
        <h4>
          <span className={styles.actionIcon} aria-hidden="true" data-chronicle-action-start="true">
            ◆
          </span>{' '}
          {title}
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
                  <p>
                    {result.statusId === 'suppress'
                      ? result.potencyBasisPoints === undefined
                        ? 'Recorded Suppress percentage unavailable.'
                        : statusPotencyDescription(result.statusId, result.potencyBasisPoints)
                      : ['wet', 'frozen', 'conductive'].includes(result.statusId)
                        ? statusPotencyDescription(result.statusId, result.potencyBasisPoints, {
                            legacyElemental: elementalDamagePolicyVersion == null,
                            explicitElemental: elementalDamagePolicyVersion === 2,
                            elementalPotencyUnavailable: result.potencyBasisPoints === undefined,
                          })
                        : combatStatusDetails(result.statusId).description}
                  </p>
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
      ) : missingResult ? (
        <p className={styles.outcomes}>{missingResult}</p>
      ) : null}
      {action.specials.map((special) => (
        <ChronicleTechnique
          key={special.key}
          action={special}
          actorName={actorName}
          elementalDamagePolicyVersion={elementalDamagePolicyVersion}
        />
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
  elementalDamagePolicyVersion: capturedElementalPolicy,
}: ChronicleNames & {
  entries: readonly BattleLogEntry[]
  currentRound?: number
  emptyMessage?: string
  elementalDamagePolicyVersion?: 1 | 2 | null
}) {
  const contextElementalPolicy = useSkillElementalDamagePolicyVersion()
  const elementalDamagePolicyVersion =
    capturedElementalPolicy === undefined ? contextElementalPolicy : capturedElementalPolicy
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

  const rememberReadingPosition = useCallback(() => {
    const reader = scrollRef.current
    if (!reader) return null
    const top = chronicleScrollPort(reader).getBoundingClientRect().top
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
  }, [])

  useLayoutEffect(() => {
    const reader = scrollRef.current
    if (!reader) return
    const lower = reader.closest<HTMLElement>('[data-battle-mobile-lower-panel]')
    const onScroll = (event: Event) => {
      const port = chronicleScrollPort(reader)
      if (event.currentTarget !== port || reader.getClientRects().length === 0) return
      followLive.current = port.scrollHeight - port.clientHeight - port.scrollTop < 24
      const visibleRound = rememberReadingPosition()
      setReadingRound(followLive.current ? null : visibleRound)
    }
    // Both ports stay subscribed so rotation can change the scroll owner without a remount.
    reader.addEventListener('scroll', onScroll, { passive: true })
    lower?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      reader.removeEventListener('scroll', onScroll)
      lower?.removeEventListener('scroll', onScroll)
    }
  }, [rememberReadingPosition])

  useLayoutEffect(() => {
    const reader = scrollRef.current
    if (!reader || reader.getClientRects().length === 0) return
    const port = chronicleScrollPort(reader)
    if (followLive.current) port.scrollTop = port.scrollHeight
    else if (readingAnchor.current) {
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
        port.scrollTop +=
          target.getBoundingClientRect().top -
          port.getBoundingClientRect().top -
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
                      <ChronicleTechnique
                        key={action.key}
                        action={action}
                        actorName={actor.name}
                        elementalDamagePolicyVersion={elementalDamagePolicyVersion}
                      />
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

/** Compact mobile timeline. Details use the exact ChronicleTechnique desktop renderer. */
export function MobileBattleChronicle({
  entries,
  playerName,
  combatantNames,
  currentRound,
  detailsHost,
  resetEpoch = 0,
  onDetailsOpenChange,
}: ChronicleNames & {
  entries: readonly BattleLogEntry[]
  currentRound?: number
  resetEpoch?: number
  detailsHost?: HTMLElement | null
  onDetailsOpenChange?: (open: boolean) => void
}) {
  const policy = useSkillElementalDamagePolicyVersion()
  const recordedRound =
    typeof currentRound === 'number' && Number.isSafeInteger(currentRound) && currentRound >= 0
  const rounds = useMemo(
    () => buildBattleChronicle(entries, { playerName, combatantNames }),
    [entries, playerName, combatantNames],
  )
  const actions = useMemo(
    () =>
      rounds.flatMap((round) =>
        round.actors.flatMap((actor) =>
          actor.actions.map((action) => ({ round: round.round, actorName: actor.name, action })),
        ),
      ),
    [rounds],
  )
  const [selection, setSelection] = useState<{ key: string; epoch: number } | null>(null)
  const selectedKey = selection?.epoch === resetEpoch ? selection.key : null
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const latestKey = actions.at(-1)?.action.key
  const selected = actions.find((item) => item.action.key === selectedKey)
  const detailsOpen = Boolean(selected)
  useEffect(() => () => onDetailsOpenChange?.(false), [onDetailsOpenChange])
  useEffect(() => {
    onDetailsOpenChange?.(detailsOpen)
  }, [detailsOpen, onDetailsOpenChange])
  useEffect(() => {
    if (!selectedKey) return
    function closeOutside(event: PointerEvent) {
      if (!detailsHost && !rootRef.current?.contains(event.target as Node)) setSelection(null)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSelection(null)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [selectedKey, detailsHost])
  useEffect(() => {
    if (!selectedKey && trackRef.current) trackRef.current.scrollLeft = trackRef.current.scrollWidth
  }, [latestKey, selectedKey])
  return (
    <div className={styles.compactChronicle} data-battle-action-strip="true" ref={rootRef}>
      <span
        className={styles.compactCurrentRound}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-battle-round={recordedRound ? currentRound : 'unavailable'}
        aria-label={
          recordedRound
            ? `Current battle round ${currentRound}`
            : 'Current battle round unavailable'
        }
      >
        <span aria-hidden="true">Current:</span>
        <b aria-hidden="true">Round {recordedRound ? currentRound : '—'}</b>
      </span>
      <div className={styles.compactTrack} aria-label="Battle actions" ref={trackRef}>
        {actions.length === 0 ? (
          <span className={styles.compactEmpty}>Chronicle · Awaiting actions</span>
        ) : null}
        {actions.map((item, index) => (
          <div className={styles.compactItem} key={item.action.key}>
            {index === 0 || actions[index - 1]?.round !== item.round ? (
              <span className={styles.compactRound}>R{item.round}</span>
            ) : null}
            <button
              type="button"
              className={styles.compactAction}
              aria-label={`Round ${item.round}, ${item.actorName}: ${chronicleActionTitle(item.action) || item.action.title || item.action.family}. Show Chronicle details`}
              aria-expanded={selectedKey === item.action.key}
              onClick={() =>
                setSelection((current) =>
                  current?.epoch === resetEpoch && current.key === item.action.key
                    ? null
                    : { key: item.action.key, epoch: resetEpoch },
                )
              }
            >
              <Image
                unoptimized
                width={32}
                height={32}
                alt=""
                src={chronicleActionArtwork(item.action)}
              />
            </button>
          </div>
        ))}
      </div>
      {selected &&
        (detailsHost ? (
          createPortal(
            <section
              className={styles.cockpitDetails}
              role="region"
              aria-label={`Chronicle action: ${selected.actorName}`}
            >
              <header className={styles.compactPopupHeader}>
                <strong>
                  <span className={styles.detailRound}>Round {selected.round}</span>
                  <span>{selected.actorName}</span>
                </strong>
                <button
                  type="button"
                  aria-label="Close Chronicle action"
                  onClick={() => setSelection(null)}
                >
                  ×
                </button>
              </header>
              <div className={styles.cockpitDetailsReader}>
                <ChronicleTechnique
                  action={selected.action}
                  actorName={selected.actorName}
                  elementalDamagePolicyVersion={policy}
                />
              </div>
            </section>,
            detailsHost,
          )
        ) : (
          <div
            className={styles.compactPopup}
            role="dialog"
            aria-modal="false"
            aria-label={`Chronicle action: ${selected.actorName}`}
          >
            <header className={styles.compactPopupHeader}>
              <strong>
                Round {selected.round} · {selected.actorName}
              </strong>
              <button
                type="button"
                aria-label="Close Chronicle action"
                onClick={() => setSelection(null)}
              >
                ×
              </button>
            </header>
            <ChronicleTechnique
              action={selected.action}
              actorName={selected.actorName}
              elementalDamagePolicyVersion={policy}
            />
          </div>
        ))}
    </div>
  )
}
