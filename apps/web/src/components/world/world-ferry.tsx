'use client'

import { useEffect, useState, type MouseEventHandler } from 'react'
import { APPEARANCE_PRESETS, compileAppearanceManifest } from '@/appearance/appearance-manifest'
import { FERRY_BOARDING_MS, FERRY_MAINLAND_DOCK, type WorldFerryView } from '@/world/ferry'
import type { WorldInteraction, WorldView } from '@/world/types'
import styles from './world-ferry.module.css'

const portraitUrl = compileAppearanceManifest({
  ...APPEARANCE_PRESETS[1].blueprint,
  coat: 'longcoat',
  collar: 'standing',
  accessory: 'satchel',
  palette: 'slate',
}).portraits.neutral

export const FERRY_CONVERSATION_ID = 'world-ferryman'

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
    title: 'Ferry station',
    body: ferry.passage
      ? 'You’re aboard. You can step back onto the dock until we leave.'
      : 'There’s room aboard. The crossing takes five minutes and the fare is free.',
    portraitUrl,
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
  if (!view.ferry?.port) return view
  return {
    ...view,
    npcs: [
      ...(view.npcs ?? []),
      {
        id: FERRY_CONVERSATION_ID,
        name: 'Ferryman',
        position: { ...FERRY_MAINLAND_DOCK, sectorId: view.position.sectorId },
        imageUrl: portraitUrl,
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
  if (!ferry.port && !ferry.passage) return null
  return (
    <section className={styles.station} aria-label="Ferry station">
      <div>
        <strong>Ferry station</strong>
        <span>
          {status.label}{' '}
          {status.at !== null ? <time>{formatFerryCountdown(status.at, now)}</time> : null}
        </span>
      </div>
      {status.action || (ferry.port && !ferry.passage) ? (
        <button type="button" disabled={disabled} onClick={onTalk}>
          Talk to Ferryman
        </button>
      ) : null}
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
