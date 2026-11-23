'use client'

import { useEffect, useId, useState, type MouseEventHandler } from 'react'
import {
  FERRY_BOARDING_MS,
  FERRY_MAINLAND_DOCK,
  FERRYMAN_PORTRAIT,
  FERRYMAN_SPRITE,
  FERRY_TERMINAL_NAME,
  type WorldFerryView,
} from '@/world/ferry'
import type { WorldInteraction, WorldView } from '@/world/types'
import styles from './world-ferry.module.css'

export const FERRY_CONVERSATION_ID = 'world-ferryman'

function portName(port: WorldFerryView['port']) {
  if (port === 'north-shore') return 'North Shore Ferry Terminal'
  if (port === 'asterwake') return 'Asterwake Ferry Terminal'
  return FERRY_TERMINAL_NAME
}

export function ferrymanTopic(
  ferry: WorldFerryView | undefined,
  serverNow: number,
): WorldInteraction | null {
  if (!ferry || (ferry.passage && serverNow >= ferry.passage.departureAt)) return null
  if (!ferry.port && !ferry.passage) return null
  return {
    id: FERRY_CONVERSATION_ID,
    objectiveId: FERRY_CONVERSATION_ID,
    speakerId: FERRY_CONVERSATION_ID,
    speaker: 'Ferryman',
    title: portName(ferry.port),
    body: ferry.passage
      ? 'You’re aboard. You can step back onto the dock until we leave.'
      : ferry.port === 'north-shore'
        ? 'The ferry to Asterwake takes five minutes. The fare is free.'
        : ferry.port === 'asterwake'
          ? 'The ferry to the North Shore takes five minutes. The fare is free.'
          : 'There’s room aboard. The crossing takes five minutes and the fare is free.',
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
  if (!ferry.port) return { label: '', at: null, action: null } as const
  const opensAt = ferry.nextDepartureAt === null ? null : ferry.nextDepartureAt - FERRY_BOARDING_MS
  if (opensAt !== null && opensAt > now) {
    return { label: 'Boarding opens in', at: opensAt, action: null } as const
  }
  return {
    label: ferry.nextDepartureAt !== null ? 'Next departure in' : 'Ferry timetable unavailable',
    at: ferry.nextDepartureAt,
    action: ferry.nextDepartureAt !== null && ferry.nextDepartureAt > now ? 'board-ferry' : null,
  } as const
}

export function worldViewWithFerryman(view: WorldView): WorldView {
  const sector =
    view.sectors.find(
      (candidate) => candidate.id === view.position.sectorId && candidate.ferryDock,
    ) ?? view.sectors.find((candidate) => candidate.ferryDock)
  if (!sector?.ferryDock) return view
  return {
    ...view,
    npcs: [
      ...(view.npcs ?? []),
      {
        id: FERRY_CONVERSATION_ID,
        name: 'Ferryman',
        position: {
          x: sector.ferryDock.x + (sector.id === FERRY_MAINLAND_DOCK.sectorId ? -1 : 1),
          y: sector.ferryDock.y,
          sectorId: sector.id,
        },
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
  onTalk,
}: {
  ferry: WorldFerryView
  serverNow: number
  disabled: boolean
  onTalk: MouseEventHandler<HTMLButtonElement>
}) {
  const now = useFerryClock(serverNow)
  const status = ferryStatus(ferry, now)
  const statusId = useId()
  if (!ferry.port && !ferry.passage) return null
  const name = ferry.passage ? 'Ferry crossing' : portName(ferry.port)
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
      {status.action || (ferry.port && !ferry.passage) ? (
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
  onCommand: (kind: 'board-ferry' | 'leave-ferry') => void
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
            if (status.action) onCommand(status.action)
          }}
        >
          {status.action === 'board-ferry' ? 'Board for free' : 'Disembark'}
        </button>
      ) : null}
    </>
  )
}
