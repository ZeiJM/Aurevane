'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { PvpBattleMetadata } from '@/server/battle/pvp-lobby-service'
import type { BattleSessionView } from '@/server/battle/battle-session-service'

import styles from './pvp-battle-quality-controls.module.css'

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

const CLOCK_WATCHDOG_MS = 5000
const CLOCK_RECONNECT_BASE_MS = 1000
const CLOCK_DEADLINE_GRACE_MS = 150
const CLOCK_MIN_DELAY_MS = 250
const MAX_RECONNECT_DELAY_MS = 5000

function nextClockRefreshDelay(clock: ClockView): number | null {
  if (!clock.active || !clock.deadlineAt) return null
  const deadline = new Date(clock.deadlineAt).getTime()
  if (!Number.isFinite(deadline)) return CLOCK_RECONNECT_BASE_MS
  const untilDeadline = deadline - Date.now() + CLOCK_DEADLINE_GRACE_MS
  return Math.min(CLOCK_WATCHDOG_MS, Math.max(CLOCK_MIN_DELAY_MS, untilDeadline))
}

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
  const [surrenderDialogOpen, setSurrenderDialogOpen] = useState(false)
  const [surrendering, setSurrendering] = useState(false)
  const [commandTarget, setCommandTarget] = useState<HTMLElement | null>(null)
  const [footerActionsTarget, setFooterActionsTarget] = useState<HTMLElement | null>(null)

  const localCombatantId =
    metadata.participants.find(
      (participant) => participant.characterId === metadata.localCharacterId,
    )?.combatantId ?? null
  const battleIsActive = battle?.snapshot.tactical.battle.lifecycle === 'active'
  const battleTurnNumber = battle?.snapshot.tactical.battle.turnNumber ?? null
  const activeCombatantId = battle?.snapshot.tactical.battle.currentTurn?.combatantId ?? null
  const localTurn = Boolean(
    battleIsActive && localCombatantId && activeCombatantId === localCombatantId,
  )
  const opponentClockTurn = Boolean(
    clock &&
      localCombatantId &&
      (clock.active
        ? clock.combatantId && clock.combatantId !== localCombatantId
        : battleIsActive &&
          clock.turnTimerSeconds === null &&
          activeCombatantId &&
          activeCombatantId !== localCombatantId),
  )

  useEffect(() => {
    const locate = () => {
      const root = document.querySelector<HTMLElement>('main[data-pvp-battle="true"]')
      const commandDeck =
        root?.querySelector<HTMLElement>('section[aria-label="Command Deck"]') ?? null
      const target =
        commandDeck?.firstElementChild instanceof HTMLElement ? commandDeck.firstElementChild : null
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
      if (next.snapshot.tactical.battle.lifecycle === 'completed') {
        setSurrenderDialogOpen(false)
      }
    }
    window.addEventListener('aurevane:pvp-battle-state', receiveBattleState)
    return () => window.removeEventListener('aurevane:pvp-battle-state', receiveBattleState)
  }, [battleSessionId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!battleIsActive) return

    let cancelled = false
    let timer: number | null = null
    let controller: AbortController | null = null
    let inFlight = false
    let reconnectDelay = CLOCK_RECONNECT_BASE_MS
    let completed = false

    const schedule = (delay: number) => {
      if (cancelled || completed) return
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => void refresh(), delay)
    }

    async function refresh() {
      if (cancelled || completed || inFlight) return
      inFlight = true
      timer = null
      controller = new AbortController()
      let nextDelay: number | null = null

      try {
        const clockResponse = await fetch(`/api/pvp/battles/${battleSessionId}/turn-clock`, {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
        })
        const clockBody = (await clockResponse.json()) as TickResponse
        if (cancelled || controller.signal.aborted) return

        if (clockResponse.ok && clockBody.tick) {
          const nextClock = clockBody.tick.clock
          setClock(nextClock)
          setError(null)
          reconnectDelay = CLOCK_RECONNECT_BASE_MS

          if (clockBody.tick.battle) {
            setBattle(clockBody.tick.battle)
            completed = clockBody.tick.battle.snapshot.tactical.battle.lifecycle === 'completed'
          }

          nextDelay = nextClockRefreshDelay(nextClock)
        } else {
          setError(clockBody.error?.message ?? 'Turn clock unavailable.')
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
          nextDelay = reconnectDelay
        }
      } catch (refreshError) {
        if (
          !cancelled &&
          !(refreshError instanceof DOMException && refreshError.name === 'AbortError')
        ) {
          setError('Turn clock reconnecting…')
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
          nextDelay = reconnectDelay
        }
      } finally {
        controller = null
        inFlight = false
        if (!cancelled && !completed && nextDelay !== null) schedule(nextDelay)
      }
    }

    const wake = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
      void refresh()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') wake()
    }

    void refresh()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', wake)

    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', wake)
    }
  }, [battleIsActive, battleSessionId, activeCombatantId, battleTurnNumber])

  async function confirmSurrender() {
    if (surrendering) return
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
      setSurrenderDialogOpen(false)
    }
  }

  const seconds = remainingSeconds(clock?.deadlineAt ?? null, now)
  const timerText = clock?.active
    ? `${seconds}s`
    : battleIsActive && clock?.turnTimerSeconds === null
      ? 'No timer'
      : '—'
  const opponentTimerText = clock?.active
    ? `${seconds}s left`
    : battleIsActive && clock?.turnTimerSeconds === null
      ? 'No timer'
      : '—'
  const opponentTimerColor = clock?.active && seconds <= 10 ? '#ff8276' : '#e28a82'

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

      {commandTarget && battleIsActive && clock && opponentClockTurn
        ? createPortal(
            <span
              data-pvp-opponent-turn-clock="true"
              style={{
                display: 'inline-flex',
                order: 2,
                flex: '0 0 auto',
                maxWidth: '100%',
                marginLeft: 'auto',
                alignItems: 'center',
                padding: '.18rem .38rem',
                overflow: 'visible',
                border: '1px solid rgba(226, 99, 99, .4)',
                borderRadius: '999px',
                color: opponentTimerColor,
                background: 'rgba(154, 54, 54, .08)',
                font: '800 .42rem/1 var(--av-font-mono)',
                letterSpacing: '.02em',
                whiteSpace: 'nowrap',
              }}
              aria-live="polite"
              title={
                clock.turnTimerSeconds
                  ? `${seconds} seconds remain in the opponent's turn.`
                  : 'This PvP battle has no turn timer.'
              }
            >
              <span
                style={{
                  overflow: 'visible',
                  color: opponentTimerColor,
                  font: '800 .42rem/1 var(--av-font-mono)',
                }}
              >
                {opponentTimerText}
              </span>
            </span>,
            commandTarget,
          )
        : null}

      {footerActionsTarget
        ? createPortal(
            <button
              type="button"
              data-pvp-surrender="true"
              onClick={() => setSurrenderDialogOpen(true)}
              disabled={surrendering || battle?.snapshot.tactical.battle.lifecycle === 'completed'}
            >
              Surrender
            </button>,
            footerActionsTarget,
          )
        : null}

      {surrenderDialogOpen
        ? createPortal(
            <div
              className={styles.backdrop}
              onPointerDown={() => {
                if (!surrendering) setSurrenderDialogOpen(false)
              }}
            >
              <section
                className={styles.modal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="pvp-surrender-title"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <span>Battle Hall · PvP</span>
                <h2 id="pvp-surrender-title">Surrender this battle?</h2>
                <p>
                  Surrendering ends the battle immediately as a loss. The normal PvP result screen
                  will follow and the committed battle history remains available for review.
                </p>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.stay}
                    disabled={surrendering}
                    onClick={() => setSurrenderDialogOpen(false)}
                  >
                    Stay in Battle
                  </button>
                  <button
                    type="button"
                    className={styles.confirm}
                    disabled={surrendering}
                    onClick={() => void confirmSurrender()}
                  >
                    {surrendering ? 'Surrendering…' : 'Confirm Surrender'}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
