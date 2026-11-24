'use client'

import { useEffect, useId, useState, type MouseEventHandler } from 'react'
import {
  FERRY_CONVERSATION_ID,
  FERRYMAN_DECK_POSITION,
  FERRY_MAINLAND_DOCK,
  FERRYMAN_PORTRAIT,
  FERRYMAN_SPRITE,
  FERRY_TERMINAL_NAME,
  type FerryIntent,
  type WorldFerryView,
} from '@/world/ferry'
import type { WorldInteraction, WorldView } from '@/world/types'
import styles from './world-ferry.module.css'

function portName(port: WorldFerryView['port']) {
  if (port === 'north-shore') return 'North Shore Ferry Terminal'
  if (port === 'asterwake') return 'Asterwake Ferry Terminal'
  return FERRY_TERMINAL_NAME
}

export function ferrymanTopic(
  ferry: WorldFerryView | undefined,
  serverNow: number,
): WorldInteraction | null {
  if (!ferry || (!ferry.port && !ferry.passage)) return null
  const { passage, ticket, port } = ferry
  const crossing =
    port === 'north-shore'
      ? 'The ferry to Asterwake takes five minutes.'
      : port === 'asterwake'
        ? 'The ferry to the North Shore takes five minutes.'
        : 'The crossing takes five minutes.'
  const body = passage
    ? serverNow < passage.departureAt
      ? 'You’re aboard. You can step back onto the dock and reboard before we leave.'
      : 'We’re underway. You can walk the deck while we make the crossing.'
    : ticket && ticket.departureAt > serverNow
      ? ticket.canBoard
        ? 'Your boarding is booked. Get aboard before the countdown ends.'
        : 'Your boarding is booked at another terminal. Be there before it sails.'
      : `${crossing} Boarding is free. Buy it here, then board before departure. Missed boarding is non-refundable.`
  return {
    id: FERRY_CONVERSATION_ID,
    objectiveId: FERRY_CONVERSATION_ID,
    speakerId: FERRY_CONVERSATION_ID,
    speaker: 'Ferryman',
    title: portName(ferry.port),
    body,
    portraitUrl: FERRYMAN_PORTRAIT,
    actionId: null,
    actionLabel: null,
    progress: 'completed',
  }
}

export function ferryStatus(ferry: WorldFerryView, now: number) {
  const passage = ferry.passage
  if (passage) {
    if (now < passage.departureAt) {
      return {
        label: 'Boarded · departs in',
        at: passage.departureAt,
        action: 'leave-ferry',
      } as const
    }
    if (now < passage.arrivalAt) {
      return { label: 'Underway · arrives in', at: passage.arrivalAt, action: null } as const
    }
    return { label: 'Arriving…', at: null, action: null } as const
  }
  if (ferry.ticket && now < ferry.ticket.departureAt) {
    return {
      label: 'Boarding booked · departs in',
      at: ferry.ticket.departureAt,
      action: ferry.ticket.canBoard ? 'board-ferry' : null,
    } as const
  }
  if (!ferry.port) return { label: '', at: null, action: null } as const
  if (ferry.nextDepartureAt === null)
    return { label: 'Ferry timetable unavailable', at: null, action: null } as const
  if (now >= ferry.nextDepartureAt)
    return { label: 'Sailing departed', at: null, action: null } as const
  return {
    label: 'Next departure in',
    at: ferry.nextDepartureAt,
    action: 'buy-ferry-boarding',
  } as const
}

export function worldViewWithFerryman(view: WorldView): WorldView {
  const sector =
    view.sectors.find(
      (candidate) => candidate.id === view.position.sectorId && candidate.ferryDock,
    ) ?? view.sectors.find((candidate) => candidate.ferryDock)
  const dock = sector?.ferryDock
  const position = view.ferry?.passage
    ? { ...FERRYMAN_DECK_POSITION, sectorId: view.position.sectorId }
    : dock
      ? {
          x: dock.x + (sector.id === FERRY_MAINLAND_DOCK.sectorId ? -1 : 1),
          y: dock.y,
          sectorId: sector.id,
        }
      : null
  if (!position) return view
  return {
    ...view,
    npcs: [
      ...(view.npcs ?? []),
      {
        id: FERRY_CONVERSATION_ID,
        name: 'Ferryman',
        position,
        imageUrl: FERRYMAN_PORTRAIT,
        spriteUrl: FERRYMAN_SPRITE,
      },
    ],
  }
}

export function formatFerryCountdown(at: number, now: number) {
  const seconds = Math.ceil(Math.max(0, at - now) / 1_000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function useFerryClock(serverNow: number) {
  const [sample, setSample] = useState({ serverNow, now: serverNow })
  useEffect(() => {
    const started = performance.now()
    const interval = window.setInterval(() => {
      setSample({ serverNow, now: serverNow + performance.now() - started })
    }, 250)
    return () => window.clearInterval(interval)
  }, [serverNow])
  return sample.serverNow === serverNow ? sample.now : serverNow
}

export function WorldFerryStation({
  ferry,
  serverNow,
  disabled,
  showPort = true,
  onTalk,
}: {
  ferry: WorldFerryView
  serverNow: number
  disabled: boolean
  showPort?: boolean
  onTalk: MouseEventHandler<HTMLButtonElement>
}) {
  const now = useFerryClock(serverNow)
  const status = ferryStatus(ferry, now)
  const statusId = useId()
  const ticketActive = ferry.ticket && now < ferry.ticket.departureAt
  if (!ferry.passage && !ticketActive && (!showPort || !ferry.port)) return null
  const canTalk = Boolean(ferry.passage || (showPort && ferry.port))
  const name = ferry.passage
    ? 'Ferry crossing'
    : ticketActive
      ? 'Ferry boarding'
      : portName(ferry.port)
  const details = (
    <span className={styles.stationCopy}>
      <strong>{name}</strong>
      <span className={styles.stationStatus} id={statusId}>
        {status.label}{' '}
        {status.at !== null ? <time>{formatFerryCountdown(status.at, now)}</time> : null}
      </span>
    </span>
  )
  return (
    <section className={styles.station} aria-label="Ferry station">
      {canTalk ? (
        <button
          type="button"
          className={styles.stationCard}
          aria-label={`${name}. Talk to Ferryman`}
          aria-haspopup="dialog"
          aria-describedby={statusId}
          disabled={disabled}
          onClick={onTalk}
        >
          {details}
          <span className={styles.stationArrow} aria-hidden="true">
            →
          </span>
        </button>
      ) : (
        <div className={styles.stationCard}>{details}</div>
      )}
    </section>
  )
}

export function FerryDialogueAction({
  ferry,
  serverNow,
  busy,
  onCommand,
}: {
  ferry: WorldFerryView
  serverNow: number
  busy: boolean
  onCommand: (intent: FerryIntent) => void
}) {
  const now = useFerryClock(serverNow)
  const status = ferryStatus(ferry, now)
  return (
    <>
      <span className={styles.dialogueStatus}>
        {status.label}{' '}
        {status.at !== null ? <time>{formatFerryCountdown(status.at, now)}</time> : null}
      </span>
      {status.action ? (
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={() => {
            if (status.action === 'leave-ferry') onCommand({ kind: status.action })
            else if (status.action !== null && status.at !== null)
              onCommand({ kind: status.action, departureAt: status.at })
          }}
        >
          {status.action === 'buy-ferry-boarding'
            ? 'Buy boarding (free)'
            : status.action === 'board-ferry'
              ? 'Board ferry'
              : 'Disembark'}
        </button>
      ) : null}
    </>
  )
}
