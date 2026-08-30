'use client'

import { useEffect, useState } from 'react'

import { BattleLogPanel } from './battle-log-panel'
import styles from './desktop-battle-log-dock.module.css'

const DESKTOP_QUERY = '(min-width: 821px)'
const LOG_REFRESH_MS = 5000

function combatLogTrigger(): HTMLButtonElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>('header button')).find((button) =>
      button.textContent?.includes('Combat Log'),
    ) ?? null
  )
}

function battleGridGeometry(): {
  battlefield: HTMLElement
  viewport: HTMLElement
  board: HTMLElement
} | null {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  const viewport = battlefield?.firstElementChild
  const board = viewport?.querySelector<HTMLElement>('[data-board-auto-fit="9x7"]') ?? null
  if (!battlefield || !(viewport instanceof HTMLElement) || !board) return null
  return { battlefield, viewport, board }
}

function syncBattleLogGridInsets(): void {
  const geometry = battleGridGeometry()
  if (!geometry) return

  const viewportRect = geometry.viewport.getBoundingClientRect()
  const boardRect = geometry.board.getBoundingClientRect()
  const topInset = Math.max(0, boardRect.top - viewportRect.top)
  const bottomInset = Math.max(0, viewportRect.bottom - boardRect.bottom)

  const topValue = `${topInset}px`
  const bottomValue = `${bottomInset}px`
  if (geometry.battlefield.style.getPropertyValue('--battle-log-grid-top-inset') !== topValue) {
    geometry.battlefield.style.setProperty('--battle-log-grid-top-inset', topValue)
  }
  if (
    geometry.battlefield.style.getPropertyValue('--battle-log-grid-bottom-inset') !== bottomValue
  ) {
    geometry.battlefield.style.setProperty('--battle-log-grid-bottom-inset', bottomValue)
  }
}

function clearBattleLogGridInsets(): void {
  const battlefield = document.querySelector<HTMLElement>('#battlefield')
  battlefield?.style.removeProperty('--battle-log-grid-top-inset')
  battlefield?.style.removeProperty('--battle-log-grid-bottom-inset')
}

export function DesktopBattleLogDock({
  battleSessionId,
  playerName,
  combatantNames,
  eventDriven = false,
}: {
  battleSessionId: string
  playerName?: string
  combatantNames?: Readonly<Record<string, string>>
  eventDriven?: boolean
}) {
  const [desktop, setDesktop] = useState(false)
  const [open, setOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const sync = () => setDesktop(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!desktop) return

    function interceptLogTrigger(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest<HTMLButtonElement>('header button')
      if (!button || !button.textContent?.includes('Combat Log')) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen((value) => !value)
    }

    document.addEventListener('click', interceptLogTrigger, true)
    return () => document.removeEventListener('click', interceptLogTrigger, true)
  }, [desktop])

  useEffect(() => {
    if (!desktop) return
    const trigger = combatLogTrigger()
    trigger?.setAttribute('aria-expanded', String(open))
  }, [desktop, open])

  useEffect(() => {
    if (!desktop || !open) {
      clearBattleLogGridInsets()
      return
    }

    let frame = 0
    const schedule = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        syncBattleLogGridInsets()
      })
    }

    const geometry = battleGridGeometry()
    const resizeObserver = new ResizeObserver(schedule)
    if (geometry) {
      resizeObserver.observe(geometry.battlefield)
      resizeObserver.observe(geometry.viewport)
      resizeObserver.observe(geometry.board)
    }

    schedule()
    window.addEventListener('resize', schedule)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', schedule)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      clearBattleLogGridInsets()
    }
  }, [desktop, open])

  useEffect(() => {
    if (!desktop || !open) return

    if (eventDriven) {
      const refreshFromBattleState = (event: Event) => {
        if (!(event instanceof CustomEvent)) return
        const next = event.detail as
          { battleSessionId?: unknown; battleVersion?: unknown } | undefined
        if (next?.battleSessionId !== battleSessionId) return
        if (typeof next.battleVersion !== 'number') return
        setRefreshTick(next.battleVersion)
      }
      window.addEventListener('aurevane:pvp-battle-state', refreshFromBattleState)
      return () => window.removeEventListener('aurevane:pvp-battle-state', refreshFromBattleState)
    }

    const timer = window.setInterval(() => setRefreshTick((value) => value + 1), LOG_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [battleSessionId, desktop, eventDriven, open])

  if (!desktop) return null

  return (
    <>
      <span className={styles.hook} aria-hidden="true" />
      <BattleLogPanel
        battleSessionId={battleSessionId}
        battleVersion={refreshTick}
        open={open}
        playerName={playerName}
        combatantNames={combatantNames}
        dockOnDesktop
      />
    </>
  )
}
