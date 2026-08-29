'use client'

import { useEffect, useRef, useState } from 'react'

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

const turnClockStyles = `
[data-testid='combat-mode-instruction'][data-ai-turn-clock='true'] {
  position: relative;
  padding-right: 4.9rem;
}
[data-testid='combat-mode-instruction'][data-ai-turn-clock='true']::after {
  position: absolute;
  top: 50%;
  right: 0.42rem;
  display: inline-flex;
  align-items: center;
  min-height: 1.25rem;
  padding: 0.2rem 0.38rem;
  border: 1px solid rgba(111, 172, 143, 0.42);
  border-radius: 999px;
  background: rgba(75, 143, 111, 0.055);
  color: var(--av-brass-200);
  content: attr(data-ai-turn-clock-label);
  font: 750 0.4rem/1 var(--av-font-mono);
  white-space: nowrap;
  pointer-events: none;
  transform: translateY(-50%);
}
[data-testid='combat-mode-instruction'][data-ai-turn-clock='true'][data-ai-turn-clock-critical='true']::after {
  color: #e48b78;
}
@media (max-width: 820px) {
  [data-testid='combat-mode-instruction'][data-ai-turn-clock='true'] {
    padding-right: 4.45rem;
  }
  [data-testid='combat-mode-instruction'][data-ai-turn-clock='true']::after {
    right: 0.28rem;
    padding-right: 0.3rem;
    padding-left: 0.3rem;
    font-size: 0.37rem;
  }
}
`

function remainingSeconds(deadlineAt: string | null, now: number): number {
  if (!deadlineAt || now <= 0) return 0
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000))
}

export function AiBattleQualityControls({
  battleSessionId,
  playerName,
}: {
  battleSessionId: string
  playerName: string
}) {
  const [clock, setClock] = useState<ClockView | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const commandStripRef = useRef<HTMLElement | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    const locate = () => {
      const root = document.querySelector<HTMLElement>('#battlefield')?.closest<HTMLElement>('main')
      const strip =
        root?.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]') ?? null
      const target =
        strip?.firstElementChild instanceof HTMLElement ? strip.firstElementChild : null
      const heading = target?.querySelector<HTMLElement>(':scope > strong') ?? null
      const notice = strip?.querySelector<HTMLElement>(':scope > small') ?? null
      const deck = strip?.closest<HTMLElement>('section[aria-label="Command Deck"]') ?? null
      const activeCommand = Boolean(
        deck?.querySelector(
          '[data-battle-command][data-battle-active="true"], button[data-active], button[class*="commandActive"]',
        ),
      )

      if (heading) {
        if (heading.style.order !== '0') heading.style.order = '0'
        const current = heading.textContent?.trim() ?? ''
        const nativeNeutralHeading = /^choose\s+(?:your\s+|an\s+)?action$/i.test(current)
        const ownsNeutralHeading = heading.dataset.aiNeutralTurnHeading === 'true'

        if (!activeCommand && (nativeNeutralHeading || ownsNeutralHeading)) {
          if (!ownsNeutralHeading) heading.dataset.aiNeutralTurnHeading = 'true'
          const turnHeading = `${playerName}’s Turn`
          if (heading.textContent !== turnHeading) heading.textContent = turnHeading
        } else if (activeCommand || (!nativeNeutralHeading && !ownsNeutralHeading)) {
          if (ownsNeutralHeading) delete heading.dataset.aiNeutralTurnHeading
        }
      }

      if (strip) strip.dataset.aiTurnClock = 'true'
      if (notice) {
        notice.style.setProperty('position', 'absolute', 'important')
        notice.style.setProperty('width', '1px', 'important')
        notice.style.setProperty('height', '1px', 'important')
        notice.style.setProperty('padding', '0', 'important')
        notice.style.setProperty('margin', '-1px', 'important')
        notice.style.setProperty('overflow', 'hidden', 'important')
        notice.style.setProperty('clip', 'rect(0, 0, 0, 0)', 'important')
        notice.style.setProperty('white-space', 'nowrap', 'important')
        notice.style.setProperty('border', '0', 'important')
      }

      // Keep React as the sole owner of the command strip's child nodes. The clock is painted by a
      // CSS pseudo-element from data attributes on the native strip, so action commits can freely
      // reconcile the instruction text without a portal or imperative text-node replacement.
      commandStripRef.current = strip
    }

    locate()
    const observer = new MutationObserver(locate)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      // Watch React-owned action-state markers only. data-battle-active is written by the cockpit
      // polish observer; observing it here created an observer feedback loop during action commits.
      attributeFilter: ['data-active', 'class'],
    })
    return () => {
      observer.disconnect()
      const strip = commandStripRef.current
      if (strip) {
        delete strip.dataset.aiTurnClock
        delete strip.dataset.aiTurnClockLabel
        delete strip.dataset.aiTurnClockCritical
      }
    }
  }, [playerName])

  useEffect(() => {
    function closeStatusPopupFromOutside(event: PointerEvent) {
      const closeButton = document.querySelector<HTMLButtonElement>(
        'button[aria-label="Close status details"]',
      )
      const popup = closeButton?.closest<HTMLElement>('[class*="contextPopover"]') ?? null
      const target = event.target
      if (!closeButton || !popup || !(target instanceof Node)) return
      if (popup.contains(target)) return
      if (
        target instanceof Element &&
        target.closest('button[aria-label*="turns remaining"]') instanceof HTMLElement
      ) {
        return
      }
      closeButton.click()
    }

    document.addEventListener('pointerdown', closeStatusPopupFromOutside, true)
    return () => document.removeEventListener('pointerdown', closeStatusPopupFromOutside, true)
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
  const clockLabel = clock?.active ? `${seconds}s left` : 'Opponent turn'

  useEffect(() => {
    const strip = commandStripRef.current
    if (!strip) return

    strip.dataset.aiTurnClock = 'true'
    strip.dataset.aiTurnClockLabel = clockLabel
    strip.dataset.aiTurnClockCritical = error || (clock?.active && seconds <= 10) ? 'true' : 'false'
    strip.setAttribute(
      'title',
      error ?? 'Each player turn lasts 60 seconds. Two consecutive timeouts apply Lowered Guard.',
    )
  }, [clock?.active, clockLabel, error, seconds])

  return <style>{turnClockStyles}</style>
}
