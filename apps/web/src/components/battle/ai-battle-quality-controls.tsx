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
  const commandTargetRef = useRef<HTMLElement | null>(null)
  const reloading = useRef(false)

  useEffect(() => {
    const locate = () => {
      const root = document.querySelector<HTMLElement>('#battlefield')?.closest<HTMLElement>('main')
      const strip =
        root?.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]') ?? null
      const target =
        strip?.firstElementChild instanceof HTMLElement ? strip.firstElementChild : null
      const heading = target?.querySelector<HTMLElement>(':scope > strong') ?? null
      const helper = target?.querySelector<HTMLElement>(':scope > span') ?? null
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

      // Keep the clock inside the native React-owned description span instead of portaling a new
      // React child into the command row. Action commits reconcile this row synchronously; mixing a
      // second React portal into the same child list could leave React removing a node it no longer
      // owns and crash the browser. Reusing the existing span preserves one DOM owner for the row.
      if (helper) {
        helper.dataset.aiTurnClock = 'true'
      }
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

      // The DOM node is external mutable state, so keep it in a ref rather than React state. The
      // 250 ms clock tick refreshes presentation shortly after React replaces the native helper.
      commandTargetRef.current = helper
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
    return () => observer.disconnect()
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
    const commandTarget = commandTargetRef.current
    if (!commandTarget) return

    const visibleLabel = error ? `${clockLabel} · ${error}` : clockLabel
    if (commandTarget.textContent !== visibleLabel) commandTarget.textContent = visibleLabel

    commandTarget.dataset.aiTurnClock = 'true'
    commandTarget.setAttribute('aria-live', 'polite')
    commandTarget.setAttribute(
      'title',
      error ?? 'Each player turn lasts 60 seconds. Two consecutive timeouts apply Lowered Guard.',
    )
    commandTarget.style.setProperty('display', 'inline-flex', 'important')
    commandTarget.style.setProperty('grid-column', '2', 'important')
    commandTarget.style.setProperty('grid-row', '1', 'important')
    commandTarget.style.setProperty('justify-self', 'end', 'important')
    commandTarget.style.setProperty('max-width', '100%')
    commandTarget.style.setProperty('gap', '.34rem')
    commandTarget.style.setProperty('align-items', 'center')
    commandTarget.style.setProperty('padding', '.2rem .38rem')
    commandTarget.style.setProperty('border', '1px solid rgba(111,172,143,.42)')
    commandTarget.style.setProperty('border-radius', '999px')
    commandTarget.style.setProperty('background', 'rgba(75,143,111,.055)')
    commandTarget.style.setProperty('font', '750 .4rem/1 var(--av-font-mono)')
    commandTarget.style.setProperty('white-space', 'nowrap')
    commandTarget.style.setProperty(
      'color',
      error ? '#e2a0a0' : clock?.active && seconds <= 10 ? '#e48b78' : 'var(--av-brass-200)',
    )
  }, [clock?.active, clockLabel, error, seconds])

  return null
}
