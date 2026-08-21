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
  const [spectatorKeyCopied, setSpectatorKeyCopied] = useState(false)
  const [commandTarget, setCommandTarget] = useState<HTMLElement | null>(null)
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null)
  const confirmTimer = useRef<number | null>(null)

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

      if (root) {
        for (const candidate of root.querySelectorAll<HTMLElement>('div')) {
          const strong = candidate.querySelector<HTMLElement>(':scope > strong')
          const span = candidate.querySelector<HTMLElement>(':scope > span')
          if (!strong || !span) continue
          if (strong.textContent?.trim() === 'Your turn') span.style.display = 'none'
        }
      }

      setCommandTarget(target)
      setFooterTarget(root?.querySelector<HTMLElement>('footer > div:last-child') ?? null)
    }
    locate()
    const observer = new MutationObserver(locate)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
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

  const activeCombatantId =
    clock?.combatantId ?? battle?.snapshot.tactical.battle.currentTurn?.combatantId ?? null
  const activeName = activeCombatantId
    ? (metadata.participants.find((participant) => participant.combatantId === activeCombatantId)
        ?.characterName ?? null)
    : null

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

  async function copySpectatorKey() {
    try {
      await navigator.clipboard.writeText(metadata.battleKey)
      setSpectatorKeyCopied(true)
      window.setTimeout(() => setSpectatorKeyCopied(false), 1500)
    } catch {
      setError('Spectator Key copy is unavailable in this browser.')
    }
  }

  const seconds = remainingSeconds(clock?.deadlineAt ?? null, now)
  const battleIsActive = battle?.snapshot.tactical.battle.lifecycle === 'active'
  const timerText = clock?.active
    ? `${seconds}s`
    : battleIsActive && clock?.turnTimerSeconds === null
      ? 'No timer'
      : '—'

  return (
    <>
      {commandTarget
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
                border: '1px solid rgba(212,186,130,.34)',
                borderRadius: '999px',
                background: 'rgba(255,255,255,.025)',
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
              <span style={{ color: 'var(--av-text-dim)' }}>
                {activeName ? `${activeName}'s turn` : 'Turn clock'}
              </span>
              {error ? <span style={{ color: '#e2a0a0' }}>{error}</span> : null}
            </span>,
            commandTarget,
          )
        : null}
      {footerTarget
        ? createPortal(
            <div
              data-pvp-match-utility="true"
              style={{
                display: 'grid',
                gap: '.28rem',
                minWidth: '8.4rem',
              }}
            >
              <button
                type="button"
                onClick={() => void surrender()}
                disabled={
                  surrendering || battle?.snapshot.tactical.battle.lifecycle === 'completed'
                }
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
              </button>
              <button
                type="button"
                data-pvp-spectator-key="true"
                onClick={() => void copySpectatorKey()}
                style={{
                  display: 'grid',
                  gap: '.08rem',
                  minHeight: '2.25rem',
                  padding: '.38rem .58rem',
                  border: '1px solid rgba(207,169,93,.42)',
                  borderRadius: 'var(--av-radius-sm)',
                  color: 'var(--av-text-muted)',
                  background: 'rgba(207,169,93,.055)',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <small
                  style={{
                    color: 'var(--av-text-dim)',
                    font: '700 .34rem/1 var(--av-font-mono)',
                    textTransform: 'uppercase',
                  }}
                >
                  {spectatorKeyCopied ? 'Copied!' : 'Spectator Key'}
                </small>
                <strong
                  style={{
                    color: 'var(--av-brass-200)',
                    font: '800 .5rem/1 var(--av-font-mono)',
                    letterSpacing: '.06em',
                  }}
                >
                  {metadata.battleKey}
                </strong>
              </button>
            </div>,
            footerTarget,
          )
        : null}
    </>
  )
}
