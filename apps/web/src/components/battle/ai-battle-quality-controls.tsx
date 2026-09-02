'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { BattlePreviewView } from '@/server/battle/battle-preview-service'

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

type IntentPreview = BattlePreviewView['preview']
type ActionPreview = Extract<IntentPreview, { kind: 'action' }>
type PreviewTone = 'chance' | 'damage' | 'heal' | 'effect' | 'cost' | 'blocked'

interface PreviewChip {
  label: string
  tone: PreviewTone
}

const CLOCK_WATCHDOG_MS = 5000
const CLOCK_RECONNECT_BASE_MS = 1000
const CLOCK_DEADLINE_GRACE_MS = 150
const CLOCK_MIN_DELAY_MS = 250
const CLOCK_REQUEST_TIMEOUT_MS = 8000
const MAX_RECONNECT_DELAY_MS = 5000

function remainingSeconds(deadlineAt: string | null, now: number): number {
  if (!deadlineAt || now <= 0) return 0
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 1000))
}

function clocksEqual(left: ClockView | null, right: ClockView): boolean {
  return Boolean(
    left &&
    left.active === right.active &&
    left.turnNumber === right.turnNumber &&
    left.combatantId === right.combatantId &&
    left.deadlineAt === right.deadlineAt &&
    left.expired === right.expired,
  )
}

function nextClockRefreshDelay(clock: ClockView): number {
  if (!clock.active || !clock.deadlineAt) return CLOCK_WATCHDOG_MS
  const deadline = new Date(clock.deadlineAt).getTime()
  if (!Number.isFinite(deadline)) return CLOCK_RECONNECT_BASE_MS
  const untilDeadline = deadline - Date.now() + CLOCK_DEADLINE_GRACE_MS
  return Math.min(CLOCK_WATCHDOG_MS, Math.max(CLOCK_MIN_DELAY_MS, untilDeadline))
}

function isPreviewRequest(input: RequestInfo | URL): boolean {
  try {
    const raw = input instanceof Request ? input.url : input instanceof URL ? input.href : input
    return /^\/api\/battles\/[^/]+\/preview\/?$/.test(new URL(raw, window.location.origin).pathname)
  } catch {
    return false
  }
}

function readPreview(body: unknown): IntentPreview | null {
  if (!body || typeof body !== 'object') return null
  const battlePreview = (body as { battlePreview?: unknown }).battlePreview
  if (!battlePreview || typeof battlePreview !== 'object') return null
  const preview = (battlePreview as { preview?: unknown }).preview
  return preview && typeof preview === 'object' ? (preview as IntentPreview) : null
}

function humanizeStatus(value: string): string {
  const id = value.split(':')[0] ?? value
  return id
    .replace(/^status\./, '')
    .replaceAll('.', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numericEffectDelta(effect: ActionPreview['projectedEffects'][number]): number | null {
  if (typeof effect.before !== 'number' || typeof effect.after !== 'number') return null
  return effect.after - effect.before
}

function actionPreviewChips(preview: ActionPreview): PreviewChip[] {
  if (!preview.legal) return [{ label: 'Blocked', tone: 'blocked' }]

  const chips: PreviewChip[] = [
    {
      label:
        preview.hitChanceBasisPoints === null
          ? 'Success 100%'
          : `Hit ${Math.round(preview.hitChanceBasisPoints / 100)}%`,
      tone: 'chance',
    },
  ]

  if (preview.mitigatedBaseDamage !== null) {
    chips.push({ label: `On hit ${preview.mitigatedBaseDamage} dmg`, tone: 'damage' })
  } else {
    const projectedDamage = preview.projectedEffects
      .filter((effect) => effect.effectType === 'damage')
      .reduce((total, effect) => {
        const delta = numericEffectDelta(effect)
        return total + (delta === null ? 0 : Math.max(0, -delta))
      }, 0)
    if (projectedDamage > 0) chips.push({ label: `${projectedDamage} dmg`, tone: 'damage' })
  }

  const projectedHealing = preview.projectedEffects
    .filter((effect) => effect.effectType === 'healing')
    .reduce((total, effect) => {
      const delta = numericEffectDelta(effect)
      return total + (delta === null ? 0 : Math.max(0, delta))
    }, 0)
  if (projectedHealing > 0) chips.push({ label: `Heal +${projectedHealing}`, tone: 'heal' })

  const resourceDelta = preview.projectedEffects
    .filter((effect) => effect.effectType === 'resource-change')
    .reduce((total, effect) => total + (numericEffectDelta(effect) ?? 0), 0)
  if (resourceDelta !== 0) {
    chips.push({
      label: `Resource ${resourceDelta > 0 ? '+' : ''}${resourceDelta}`,
      tone: resourceDelta > 0 ? 'heal' : 'cost',
    })
  }

  for (const status of preview.projectedStatuses ?? []) {
    chips.push({ label: humanizeStatus(status.statusId), tone: 'effect' })
    if (
      status.damageTakenMultiplierBasisPoints !== null &&
      status.damageTakenMultiplierBasisPoints < 10_000
    ) {
      const reduction = Math.round((10_000 - status.damageTakenMultiplierBasisPoints) / 100)
      chips.push({ label: `-${reduction}% damage`, tone: 'effect' })
    }
    if (status.durationOwnerTurnStarts !== null) {
      chips.push({
        label: `${status.durationOwnerTurnStarts} turn${status.durationOwnerTurnStarts === 1 ? '' : 's'}`,
        tone: 'effect',
      })
    }
  }

  if ((preview.projectedStatuses ?? []).length === 0) {
    const statuses = new Set(
      preview.projectedEffects
        .filter(
          (effect) => effect.effectType === 'apply-status' && typeof effect.after === 'string',
        )
        .map((effect) => humanizeStatus(String(effect.after))),
    )
    for (const status of statuses) chips.push({ label: status, tone: 'effect' })
  }

  if (preview.affectedCombatantIds.length > 1) {
    chips.push({ label: `${preview.affectedCombatantIds.length} targets`, tone: 'effect' })
  }

  return chips
}

function previewChips(preview: IntentPreview | null): PreviewChip[] {
  if (!preview) return []
  if (!preview.legal) return [{ label: 'Blocked', tone: 'blocked' }]
  if (preview.kind === 'move') {
    return [
      { label: `${preview.actionEconomyCost} AP`, tone: 'cost' },
      { label: `${preview.actionEconomyAfter} AP left`, tone: 'effect' },
      {
        label: `${Math.max(0, preview.path.length - 1)} tile${preview.path.length === 2 ? '' : 's'}`,
        tone: 'effect',
      },
    ]
  }
  if (preview.kind === 'action') return actionPreviewChips(preview)
  if (preview.kind === 'face') {
    return [
      { label: 'Success 100%', tone: 'chance' },
      { label: `Face ${humanizeStatus(preview.facing)}`, tone: 'effect' },
      { label: 'Ends turn', tone: 'cost' },
    ]
  }
  return [{ label: 'Choose facing', tone: 'effect' }]
}

function markInstructionStructure(strip: HTMLElement, target: HTMLElement): void {
  strip.dataset.battleInstructionHost = 'true'
  target.dataset.battleInstructionRow = 'true'

  const title = target.querySelector<HTMLElement>(':scope > strong')
  if (title) title.dataset.battleInstructionTitle = 'true'

  const description = Array.from(target.children).find(
    (child): child is HTMLElement => child instanceof HTMLSpanElement,
  )
  if (description) description.dataset.battleInstructionDescription = 'true'
}

export function AiBattleQualityControls({
  battleSessionId,
}: {
  battleSessionId: string
  playerName: string
}) {
  const [clock, setClock] = useState<ClockView | null>(null)
  const [preview, setPreview] = useState<IntentPreview | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const [commandTarget, setCommandTarget] = useState<HTMLElement | null>(null)
  const commandTargetRef = useRef<HTMLElement | null>(null)
  const reloading = useRef(false)
  const chips = useMemo(() => previewChips(preview), [preview])

  useEffect(() => {
    const battlefield = document.querySelector<HTMLElement>('#battlefield')
    const root = battlefield?.closest<HTMLElement>('main') ?? null
    if (!root || root.dataset.pvpBattle === 'true') return

    let frame: number | null = null

    const locate = () => {
      frame = null
      const strip =
        root.querySelector<HTMLElement>('[data-testid="combat-mode-instruction"]') ?? null
      const target =
        strip?.firstElementChild instanceof HTMLElement ? strip.firstElementChild : null
      if (strip && target) markInstructionStructure(strip, target)

      if (commandTargetRef.current !== target) {
        commandTargetRef.current = target
        setCommandTarget(target)
      }
    }

    const schedule = () => {
      if (frame !== null) return
      frame = window.requestAnimationFrame(locate)
    }

    const clearPreviewFromCommand = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null
      const button = element?.closest<HTMLButtonElement>(
        'section[aria-label="Command Deck"] button',
      )
      if (!button || !root.contains(button)) return
      setPreview(null)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })
    root.addEventListener('click', clearPreviewFromCommand)

    return () => {
      observer.disconnect()
      root.removeEventListener('click', clearPreviewFromCommand)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const previousFetch = window.fetch
    let cancelled = false

    const observedFetch: typeof window.fetch = (...args) => {
      const observesPreview = isPreviewRequest(args[0])
      if (observesPreview) setPreview(null)
      const responsePromise = previousFetch(...args)

      if (observesPreview) {
        void responsePromise
          .then((response) => {
            if (!response.ok || cancelled) return
            void response
              .clone()
              .json()
              .then((body: unknown) => {
                if (cancelled) return
                const nextPreview = readPreview(body)
                if (nextPreview) setPreview(nextPreview)
              })
              .catch(() => undefined)
          })
          .catch(() => undefined)
      }

      return responsePromise
    }

    window.fetch = observedFetch
    return () => {
      cancelled = true
      if (window.fetch === observedFetch) window.fetch = previousFetch
    }
  }, [])

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
    let controller: AbortController | null = null
    let requestTimeout: number | null = null
    let inFlight = false
    let reconnectDelay = CLOCK_RECONNECT_BASE_MS

    const clearRequestTimeout = () => {
      if (requestTimeout === null) return
      window.clearTimeout(requestTimeout)
      requestTimeout = null
    }

    const schedule = (delay: number) => {
      if (cancelled || reloading.current) return
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => void refresh(), delay)
    }

    async function refresh() {
      if (cancelled || reloading.current || inFlight) return
      if (document.visibilityState === 'hidden') {
        schedule(CLOCK_WATCHDOG_MS)
        return
      }

      inFlight = true
      timer = null
      controller = new AbortController()
      const activeController = controller
      requestTimeout = window.setTimeout(() => activeController.abort(), CLOCK_REQUEST_TIMEOUT_MS)
      let nextDelay = CLOCK_WATCHDOG_MS

      try {
        const response = await fetch(`/api/battles/${battleSessionId}/turn-clock`, {
          method: 'POST',
          cache: 'no-store',
          signal: activeController.signal,
        })
        const body = (await response.json()) as TickResponse
        if (cancelled || activeController.signal.aborted) return

        if (!response.ok || !body.tick) {
          setError(body.error?.message ?? 'Turn clock unavailable.')
          reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
          nextDelay = reconnectDelay
        } else {
          const nextClock = body.tick.clock
          setClock((current) => (clocksEqual(current, nextClock) ? current : nextClock))
          setError(null)
          reconnectDelay = CLOCK_RECONNECT_BASE_MS
          nextDelay = nextClockRefreshDelay(nextClock)

          if (body.tick.timedOut && !reloading.current) {
            reloading.current = true
            window.setTimeout(() => window.location.reload(), 80)
            return
          }
        }
      } catch (refreshError) {
        if (
          !cancelled &&
          !(refreshError instanceof DOMException && refreshError.name === 'AbortError')
        ) {
          setError('Turn clock reconnecting…')
        } else if (!cancelled && activeController.signal.aborted) {
          setError('Turn clock reconnecting…')
        }
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
        nextDelay = reconnectDelay
      } finally {
        clearRequestTimeout()
        if (controller === activeController) controller = null
        inFlight = false
        if (!cancelled && !reloading.current) schedule(nextDelay)
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
      clearRequestTimeout()
      controller?.abort()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', wake)
    }
  }, [battleSessionId])

  const seconds = remainingSeconds(clock?.deadlineAt ?? null, now)

  if (!commandTarget) return null

  return createPortal(
    <>
      {chips.length > 0 ? (
        <span data-battle-target-preview="true" aria-label="Action preview">
          {chips.map((chip, index) => (
            <span
              key={`${chip.label}-${index}`}
              data-battle-preview-chip="true"
              data-battle-preview-tone={chip.tone}
            >
              {chip.label}
            </span>
          ))}
        </span>
      ) : null}
      <span
        data-ai-turn-clock="true"
        style={{
          display: 'inline-flex',
          order: 3,
          flex: '0 0 auto',
          maxWidth: '100%',
          gap: '.34rem',
          alignItems: 'center',
          marginLeft: 'auto',
          padding: '.2rem .38rem',
          border: '1px solid rgba(111,172,143,.42)',
          borderRadius: '999px',
          background: 'rgba(75,143,111,.055)',
          font: '750 .4rem/1 var(--av-font-mono)',
          whiteSpace: 'nowrap',
        }}
        aria-live="polite"
        title="Each player turn lasts 60 seconds. Two consecutive timeouts apply Lowered Guard."
      >
        <span
          style={{
            color: clock?.active && seconds <= 10 ? '#e48b78' : 'var(--av-brass-200)',
          }}
        >
          {clock?.active ? `${seconds}s left` : 'Opponent turn'}
        </span>
        {error ? <span style={{ color: '#e2a0a0' }}>{error}</span> : null}
      </span>
    </>,
    commandTarget,
  )
}
