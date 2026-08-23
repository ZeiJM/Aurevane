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
  turnTimerSeconds: 60 | 120 | null
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

const CLOCK_POLL_MS = 1000
const MAX_RECONNECT_DELAY_MS = 5000

export function PvpBattleQualityControls({
  battleSessionId,
  initialBattle,
  metadata,
}: {
  battleSessionId: string
  initialBattle: BattleSessionView
  metadata: PvpBattleMetadata
}) {
  const [clock, setClock] = useState<ClockView | null>(null)
  const [now, setNow] = useState(0)
  const [battle, setBattle] = useState<BattleSessionView | null>(initialBattle)
  const [error, setError] = useState<string | null>(null)
  const [confirmSurrender, setConfirmSurrender] = useState(false)
  const [surrendering, setSurrendering] = useState(false)
  const [commandTarget, setCommandTarget] = useState<HTMLElement | null>(null)
  const [footerActionsTarget, setFooterActionsTarget] = useState<HTMLElement | null>(null)
  const confirmTimer = useRef<number | null>(null)

  const localCombatantId =
    metadata.participants.find(
      (participant) => participant.characterId === metadata.localCharacterId,
    )?.combatantId ?? null
  const battleIsActive = battle?.snapshot.tactical.battle.lifecycle === 'active'
  const localTurn = Boolean(
    battleIsActive &&
      localCombatantId &&
      battle?.snapshot.tactical.battle.currentTurn?.combatantId === localCombatantId,
  )

  useEffect(() => {
    const locate = () => {
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      const commandDeck =
        root?.querySelector<HTMLElement>('section[aria-label="Command Deck"]') ?? null
      const target =
        commandDeck?.firstElementChild instanceof HTMLElement ? commandDeck.firstElementChild : null
      const heading = target?.querySelector<HTMLElement>(':scope > strong') ?? null
      const helper =
        target?.querySelector<HTMLElement>(':scope > span:not([data-pvp-turn-clock="true"])') ??
        null

      if (heading) heading.style.order = '0'
      if (helper) helper.style.display = 'none'

      setCommandTarget(target)

      const footer = root?.querySelector<HTMLElement>('footer') ?? null
      const footerActions = footer
        ? (Array.from(footer.querySelectorAll<HTMLElement>('div')).find((candidate) => {
            const text = candidate.textContent ?? ''
            return text.includes('Cancel Action') && text.includes('Confirm Action')
          }) ?? null)
        : null
      setFooterActionsTarget(footerActions)
    }

    locate()
    const observer = new MutationObserver(() => window.requestAnimationFrame(locate))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const receiveBattleState = (event: Event) => {
      if (!(event instanceof CustomEvent)) return
      const next = event.detail as BattleSessionView | undefined
      if (!next || next.battleSessionId !== battleSessionId) return
      setBattle(next)
    }
    window.addEventListener('aurevane:pvp-battle-state', receiveBattleState)
    return () => window.removeEventListener('aurevane:pvp-battle-state', receiveBattleState)
  }, [battleSessionId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    let reconnectDelay = CLOCK_POLL_MS
    let completed = false

    async function refresh() {
      try {
        const clockResponse = await fetch(`/api/pvp/battles/${battleSessionId}/turn-clock`, {
          method: 'POST',
          cache: 'no-store',
        })
        const clockBody = (await clockResponse.json()) as TickResponse
        if (cancelled) return

        if (clockResponse.ok && clockBody.tick) {
          setClock(clockBody.tick.clock)
          setError(null)
          reconnectDelay = CLOCK_POLL_MS

          if (clockBody.tick.battle) {
            setBattle(clockBody.tick.battle)
            completed = clockBody.tick.battle.snapshot.tactical.battle.lifecycle === 'completed'
          }
        } else {
          setError(clockBody.error?.message ?? 'Turn clock unavailable.')
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
        }
      } catch {
        if (!cancelled) {
          setError('Turn clock reconnecting…')
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
        }
      } finally {
        if (!cancelled && !completed) timer = window.setTimeout(refresh, reconnectDelay)
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [battleSessionId])

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
      if (!response.ok || !body.battle) {
        throw new Error(body.error?.message ?? 'Surrender could not be committed.')
      }
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
  const timerText = clock?.active
    ? `${seconds}s`
    : battleIsActive && clock?.turnTimerSeconds === null
      ? 'No timer'
      : '—'

  return (
    <>
      {commandTarget && localTurn
        ? createPortal(
            <span
              data-pvp-turn-clock="true"
              style={{
                display: 'inline-flex',
                order: 1,
                flex: '0 0 auto',
                maxWidth: '100%',
                gap: '.34rem',
                alignItems: 'center',
                padding: '.2rem .38rem',
                border: '1px solid rgba(111,172,143,.42)',
                borderRadius: '999px',
                background: 'rgba(75,143,111,.055)',
                font: '750 .4rem/1 var(--av-font-mono)',
                whiteSpace: 'nowrap',
              }}
              aria-live="polite"
              title={
                clock?.turnTimerSeconds
                  ? `${clock.turnTimerSeconds}-second PvP turn timer`
                  : 'This PvP battle has no turn timer.'
              }
            >
              <span
                style={{
                  color: clock?.active && seconds <= 10 ? '#e48b78' : 'var(--av-brass-200)',
                }}
              >
                {timerText}
              </span>
              {error ? <span style={{ color: '#e2a0a0' }}>{error}</span> : null}
            </span>,
            commandTarget,
          )
        : null}

      {footerActionsTarget
        ? createPortal(
            <button
              type="button"
              data-pvp-surrender="true"
              onClick={() => void surrender()}
              disabled={surrendering || battle?.snapshot.tactical.battle.lifecycle === 'completed'}
            >
              {surrendering
                ? 'Surrendering…'
                : confirmSurrender
                  ? 'Confirm Surrender'
                  : 'Surrender'}
            </button>,
            footerActionsTarget,
          )
        : null}
    </>
  )
}
