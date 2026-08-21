'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
    timedOut: boolean
  }
  error?: { message?: string }
}

function remainingSeconds(deadlineAt: string | null, now: number): number {
  if (!deadlineAt || now <= 0) return 0
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000))
}

export function AiBattleQualityControls({ battleSessionId }: { battleSessionId: string }) {
  const [clock, setClock] = useState<ClockView | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    const locate = () => {
      const root = document.querySelector<HTMLElement>('#battlefield')?.closest<HTMLElement>('main')
      const header = root?.querySelector<HTMLElement>('header') ?? null
      setHeaderTarget(
        header?.firstElementChild instanceof HTMLElement ? header.firstElementChild : header,
      )
    }
    locate()
    const observer = new MutationObserver(locate)
    observer.observe(document.body, { childList: true, subtree: true })
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
        const response = await fetch(`/api/battles/${battleSessionId}/turn-clock`, {
          method: 'POST',
          cache: 'no-store',
        })
        const body = (await response.json()) as TickResponse
        if (cancelled) return
        if (!response.ok || !body.tick) {
          setError(body.error?.message ?? 'Turn clock unavailable.')
        } else {
          setClock(body.tick.clock)
          setError(null)
          if (body.tick.timedOut && !reloading.current) {
            reloading.current = true
            window.setTimeout(() => window.location.reload(), 80)
            return
          }
        }
      } catch {
        if (!cancelled) setError('Turn clock reconnecting…')
      } finally {
        if (!cancelled && !reloading.current) timer = window.setTimeout(refresh, 650)
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [battleSessionId])

  const seconds = remainingSeconds(clock?.deadlineAt ?? null, now)

  if (!headerTarget) return null

  return createPortal(
    <div
      data-ai-turn-clock="true"
      style={{
        display: 'flex',
        width: 'fit-content',
        maxWidth: '100%',
        gap: '.38rem',
        alignItems: 'center',
        marginTop: '.18rem',
        padding: '.22rem .4rem',
        border: '1px solid rgba(212,186,130,.28)',
        borderRadius: '999px',
        background: 'rgba(255,255,255,.02)',
        font: '750 .38rem/1 var(--av-font-mono)',
        whiteSpace: 'nowrap',
      }}
      aria-live="polite"
      title="Each player turn lasts 60 seconds. Two consecutive timeouts apply Lowered Guard."
    >
      <span style={{ color: clock?.active && seconds <= 10 ? '#e48b78' : 'var(--av-brass-200)' }}>
        {clock?.active ? `${seconds}s` : '—'}
      </span>
      <span style={{ color: 'var(--av-text-dim)' }}>
        {clock?.active ? 'Your turn' : 'Opponent turn'}
      </span>
      {error ? <span style={{ color: '#e2a0a0' }}>{error}</span> : null}
    </div>,
    headerTarget,
  )
}
