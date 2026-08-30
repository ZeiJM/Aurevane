'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './battle-round-timer.module.css'

const TIMER_TICK_MS = 250

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function roundStorageKey(battleSessionId: string, round: number): string {
  return `aurevane:battle-round-start:${battleSessionId}:${round}`
}

function readOrCreateRoundStart(battleSessionId: string, round: number): number {
  const now = Date.now()
  try {
    const key = roundStorageKey(battleSessionId, round)
    const stored = Number(window.sessionStorage.getItem(key))
    if (Number.isFinite(stored) && stored > 0 && stored <= now) return stored
    window.sessionStorage.setItem(key, String(now))
  } catch {
    // A blocked sessionStorage still gets an accurate timer for the current mounted battle view.
  }
  return now
}

function locateCommandContext(): HTMLElement | null {
  const deck = document.querySelector<HTMLElement>(
    'section[aria-label="Command Deck"][data-unified-command-deck="true"]',
  )
  if (!deck) return null
  return (
    Array.from(deck.children).find(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && Boolean(child.querySelector(':scope > strong')),
    ) ?? null
  )
}

export function BattleRoundTimer({ initialBattle }: { initialBattle: BattleSessionView }) {
  const [battle, setBattle] = useState(initialBattle)
  const [host, setHost] = useState<HTMLElement | null>(null)
  const round = battle.snapshot.tactical.battle.round
  const lifecycle = battle.snapshot.tactical.battle.lifecycle
  const [roundStartedAt, setRoundStartedAt] = useState(() => Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const timerLabel = useMemo(() => formatElapsed(elapsedSeconds), [elapsedSeconds])

  useEffect(() => {
    void styles
    let frame: number | null = null

    const locate = () => {
      frame = null
      const nextHost = locateCommandContext()
      if (nextHost) nextHost.dataset.battleRoundTimerHost = 'true'
      setHost((current) => {
        if (current && current !== nextHost) current.removeAttribute('data-battle-round-timer-host')
        return nextHost
      })
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame !== null) window.cancelAnimationFrame(frame)
      host?.removeAttribute('data-battle-round-timer-host')
    }
  }, [host])

  useEffect(() => {
    const onBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as BattleSessionView | undefined
      if (!next || next.battleSessionId !== initialBattle.battleSessionId) return
      setBattle(next)
    }

    window.addEventListener('aurevane:battle-state', onBattleState)
    return () => window.removeEventListener('aurevane:battle-state', onBattleState)
  }, [initialBattle.battleSessionId])

  useEffect(() => {
    const startedAt = readOrCreateRoundStart(battle.battleSessionId, round)
    setRoundStartedAt(startedAt)
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
  }, [battle.battleSessionId, round])

  useEffect(() => {
    if (lifecycle !== 'active') return
    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - roundStartedAt) / 1000)))
    }
    update()
    const interval = window.setInterval(update, TIMER_TICK_MS)
    return () => window.clearInterval(interval)
  }, [lifecycle, roundStartedAt])

  if (!host) return null

  return createPortal(
    <time
      data-battle-round-timer="true"
      dateTime={`PT${elapsedSeconds}S`}
      aria-label={`Round ${round} elapsed time ${timerLabel}`}
    >
      <small>Round</small>
      <strong>{timerLabel}</strong>
    </time>,
    host,
  )
}
