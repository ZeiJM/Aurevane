'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

interface ClockView {
  active: boolean
  turnNumber: number | null
  combatantId: string | null
  deadlineAt: string | null
  expired: boolean
}

interface TickResponse {
  tick?: {
    clock: ClockView
    battle: BattleSessionView | null
    timedOut: boolean
  }
  error?: { message?: string }
}

function remainingSeconds(deadlineAt: string | null, now: number): number {
  if (!deadlineAt || now <= 0) return 0
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000))
}

export function PvpBattleQualityControls({
  battleSessionId,
  metadata,
}: {
  battleSessionId: string
  metadata: PvpBattleMetadata
}) {
  const [clock, setClock] = useState<ClockView | null>(null)
  const [now, setNow] = useState(0)
  const [battle, setBattle] = useState<BattleSessionView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmSurrender, setConfirmSurrender] = useState(false)
  const [surrendering, setSurrendering] = useState(false)
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null)
  const confirmTimer = useRef<number | null>(null)

  useEffect(() => {
    const locate = () => {
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      setHeaderTarget(root?.querySelector<HTMLElement>('header') ?? null)
      setFooterTarget(root?.querySelector<HTMLElement>('footer > div:last-child') ?? null)
    }
    locate()
    const observer = new MutationObserver(locate)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null

    async function refresh() {
      try {
        const [clockResponse, battleResponse] = await Promise.all([
          fetch(`/api/pvp/battles/${battleSessionId}/turn-clock`, {
            method: 'POST',
            cache: 'no-store',
          }),
          fetch(`/api/battles/${battleSessionId}`, { cache: 'no-store' }),
        ])
        const clockBody = (await clockResponse.json()) as TickResponse
        const battleBody = (await battleResponse.json()) as { battle?: BattleSessionView }
        if (cancelled) return
        if (clockResponse.ok && clockBody.tick) {
          setClock(clockBody.tick.clock)
          if (clockBody.tick.battle) setBattle(clockBody.tick.battle)
          setError(null)
        } else if (!clockResponse.ok) {
          setError(clockBody.error?.message ?? 'Turn clock unavailable.')
        }
        if (battleResponse.ok && battleBody.battle) setBattle(battleBody.battle)
      } catch {
        if (!cancelled) setError('Turn clock reconnecting…')
      } finally {
        if (!cancelled) timer = window.setTimeout(refresh, 650)
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [battleSessionId])

  const activeName = clock?.combatantId
    ? (metadata.participants.find((participant) => participant.combatantId === clock.combatantId)
        ?.characterName ?? null)
    : null

  const loweredGuardNames = battle
    ? battle.snapshot.statusState
        .filter((row) => row.statuses.some((status) => status.statusId === 'lowered-guard'))
        .map(
          (row) =>
            metadata.participants.find((participant) => participant.combatantId === row.combatantId)
              ?.characterName ?? row.combatantId,
        )
    : []

  async function surrender() {
    if (surrendering) return
    if (!confirmSurrender) {
      setConfirmSurrender(true)
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current)
      confirmTimer.current = window.setTimeout(() => setConfirmSurrender(false), 3500)
      return
    }
    setSurrendering(true)
    try {
      const response = await fetch(`/api/pvp/battles/${battleSessionId}/surrender`, {
        method: 'POST',
      })
      const body = (await response.json()) as {
        battle?: BattleSessionView
        error?: { message?: string }
      }
      if (!response.ok || !body.battle)
        throw new Error(body.error?.message ?? 'Surrender could not be committed.')
      window.location.reload()
    } catch (surrenderError) {
      setError(
        surrenderError instanceof Error
          ? surrenderError.message
          : 'Surrender could not be committed.',
      )
      setSurrendering(false)
      setConfirmSurrender(false)
    }
  }

  const seconds = remainingSeconds(clock?.deadlineAt ?? null, now)

  return (
    <>
      {headerTarget
        ? createPortal(
            <div
              data-pvp-turn-clock="true"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '-2.35rem',
                zIndex: 80,
                display: 'flex',
                gap: '.5rem',
                alignItems: 'center',
                transform: 'translateX(-50%)',
                padding: '.38rem .62rem',
                border: '1px solid rgba(212,186,130,.42)',
                borderRadius: '999px',
                background: 'rgba(6,9,14,.96)',
                boxShadow: '0 .55rem 1.5rem rgba(0,0,0,.4)',
                font: '750 .48rem/1 var(--av-font-mono)',
                whiteSpace: 'nowrap',
              }}
              aria-live="polite"
            >
              <span style={{ color: seconds <= 10 ? '#e48b78' : 'var(--av-brass-200)' }}>
                {clock?.active ? `${seconds}s` : '—'}
              </span>
              <span style={{ color: 'var(--av-text-dim)' }}>
                {activeName ? `${activeName}'s turn` : 'Turn clock'}
              </span>
              {loweredGuardNames.length > 0 ? (
                <strong style={{ color: '#e48b78' }}>
                  Lowered Guard: {loweredGuardNames.join(', ')} · 2.5× incoming damage
                </strong>
              ) : null}
              {error ? <span style={{ color: '#e2a0a0' }}>{error}</span> : null}
            </div>,
            headerTarget,
          )
        : null}
      {footerTarget
        ? createPortal(
            <button
              type="button"
              onClick={() => void surrender()}
              disabled={surrendering || battle?.snapshot.tactical.battle.lifecycle === 'completed'}
              style={{
                minHeight: '2.25rem',
                padding: '.48rem .68rem',
                border: '1px solid rgba(194,89,78,.62)',
                borderRadius: 'var(--av-radius-sm)',
                color: confirmSurrender ? '#ffe0d7' : '#dba59b',
                background: confirmSurrender ? 'rgba(151,45,36,.3)' : 'rgba(122,45,39,.12)',
                font: '750 .46rem/1 var(--av-font-mono)',
                cursor: surrendering ? 'wait' : 'pointer',
              }}
            >
              {surrendering
                ? 'Surrendering…'
                : confirmSurrender
                  ? 'Confirm Surrender'
                  : 'Surrender'}
            </button>,
            footerTarget,
          )
        : null}
    </>
  )
}
