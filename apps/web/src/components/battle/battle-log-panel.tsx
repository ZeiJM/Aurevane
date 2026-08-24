'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import { BattleLogFeed, countBattleLogActions } from './battle-log-feed'
import { useBattlePlayerName } from './battle-runtime-context'
import styles from './battle-log-panel.module.css'

interface BattleLogPanelProps {
  battleSessionId: string
  battleVersion?: number
  open?: boolean
  onClose?: () => void
  playerName?: string
  dockOnDesktop?: boolean
}

interface BattleLogResponse {
  battleLog?: BattleLogView
  error?: { message?: string }
}

function beginFloatingPanelDrag(event: React.PointerEvent<HTMLElement>, panel: HTMLElement | null) {
  if (
    !panel ||
    event.button !== 0 ||
    (event.target as Element | null)?.closest('button, [data-resize-handle]')
  ) {
    return
  }

  event.preventDefault()
  const rect = panel.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  panel.style.left = `${rect.left}px`
  panel.style.top = `${rect.top}px`
  panel.style.right = 'auto'
  panel.style.bottom = 'auto'
  panel.style.width = `${rect.width}px`
  panel.style.height = `${rect.height}px`
  panel.style.transform = 'none'

  const move = (moveEvent: PointerEvent) => {
    const nextRect = panel.getBoundingClientRect()
    const maxLeft = Math.max(4, window.innerWidth - nextRect.width - 4)
    const maxTop = Math.max(4, window.innerHeight - nextRect.height - 4)
    const left = Math.min(maxLeft, Math.max(4, moveEvent.clientX - offsetX))
    const top = Math.min(maxTop, Math.max(4, moveEvent.clientY - offsetY))
    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
  }

  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish, { once: true })
  window.addEventListener('pointercancel', finish, { once: true })
}

function beginFloatingPanelResize(
  event: React.PointerEvent<HTMLElement>,
  panel: HTMLElement | null,
) {
  if (!panel || event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()
  const rect = panel.getBoundingClientRect()
  const startX = event.clientX
  const startY = event.clientY
  const minWidth = Math.min(288, Math.max(180, window.innerWidth - 8))
  const minHeight = Math.min(176, Math.max(120, window.innerHeight - 8))

  panel.style.left = `${rect.left}px`
  panel.style.top = `${rect.top}px`
  panel.style.right = 'auto'
  panel.style.bottom = 'auto'
  panel.style.width = `${rect.width}px`
  panel.style.height = `${rect.height}px`
  panel.style.transform = 'none'

  const move = (moveEvent: PointerEvent) => {
    const maxWidth = Math.max(minWidth, window.innerWidth - rect.left - 4)
    const maxHeight = Math.max(minHeight, window.innerHeight - rect.top - 4)
    const width = Math.min(maxWidth, Math.max(minWidth, rect.width + moveEvent.clientX - startX))
    const height = Math.min(
      maxHeight,
      Math.max(minHeight, rect.height + moveEvent.clientY - startY),
    )
    panel.style.width = `${width}px`
    panel.style.height = `${height}px`
  }

  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish, { once: true })
  window.addEventListener('pointercancel', finish, { once: true })
}

function findDesktopDockTarget(): HTMLElement | null {
  if (!window.matchMedia('(min-width: 821px)').matches) return null
  return (
    document.querySelector<HTMLElement>('#battlefield > div:first-child') ??
    document.querySelector<HTMLElement>(
      "main[data-pvp-battle='true'] section[aria-label='PvP tactical battlefield'] > div:first-child",
    )
  )
}

export function BattleLogPanel({
  battleSessionId,
  battleVersion,
  open,
  onClose,
  playerName,
  dockOnDesktop = false,
}: BattleLogPanelProps) {
  const runtimePlayerName = useBattlePlayerName()
  const effectivePlayerName = playerName ?? runtimePlayerName ?? undefined
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const visible = controlled ? Boolean(open) : internalOpen
  const [log, setLog] = useState<BattleLogView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [dockTarget, setDockTarget] = useState<HTMLElement | null>(null)
  const requestSequence = useRef(0)
  const controlledPanelRef = useRef<HTMLDivElement>(null)

  const loadLog = useCallback(async () => {
    const sequence = ++requestSequence.current
    setLoading(true)
    try {
      const response = await fetch(`/api/battles/${battleSessionId}/events`, {
        method: 'GET',
        cache: 'no-store',
      })
      const body = (await response.json()) as BattleLogResponse
      if (sequence !== requestSequence.current) return
      if (!response.ok || !body.battleLog) {
        throw new Error(body.error?.message ?? 'Battle history is temporarily unavailable.')
      }
      setLog(body.battleLog)
      setError(null)
    } catch (loadError) {
      if (sequence !== requestSequence.current) return
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Battle history is temporarily unavailable.',
      )
    } finally {
      if (sequence === requestSequence.current) setLoading(false)
    }
  }, [battleSessionId])

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => {
      void loadLog()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [visible, battleVersion, loadLog])

  useEffect(() => {
    if (!visible || !dockOnDesktop) {
      setDockTarget(null)
      return
    }

    let frame = 0
    const locate = () => {
      const target = findDesktopDockTarget()
      setDockTarget((current) => (current === target ? current : target))
      if (target) target.dataset.desktopBattleLogOpen = 'true'
    }
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      const target = dockTarget ?? findDesktopDockTarget()
      if (target) delete target.dataset.desktopBattleLogOpen
    }
  }, [dockOnDesktop, dockTarget, visible])

  useEffect(() => {
    function toggleLog() {
      if (controlled) return
      setInternalOpen((value) => !value)
    }
    window.addEventListener('aurevane:battle-log-toggle', toggleLog)
    return () => window.removeEventListener('aurevane:battle-log-toggle', toggleLog)
  }, [controlled])

  const entries = log?.entries ?? []
  const actionCount = countBattleLogActions(entries)

  if (!controlled) {
    return (
      <div className={styles.log}>
        <button
          type="button"
          className={styles.trigger}
          data-testid="battle-log-toggle"
          aria-expanded={visible}
          onClick={() => setInternalOpen((value) => !value)}
        >
          Combat Log <span>{loading ? '…' : actionCount}</span>
        </button>
        {visible ? (
          <LogPanel
            entries={entries}
            loading={loading}
            error={error}
            onClose={() => setInternalOpen(false)}
            playerName={effectivePlayerName}
          />
        ) : null}
      </div>
    )
  }

  if (!visible) return null

  if (dockOnDesktop) {
    if (!dockTarget) return null
    return createPortal(
      <div className={styles.docked} data-testid="battle-log-panel" data-docked-battle-log="true">
        <LogPanel
          entries={entries}
          loading={loading}
          error={error}
          playerName={effectivePlayerName}
        />
      </div>,
      dockTarget,
    )
  }

  return (
    <div
      ref={controlledPanelRef}
      className={styles.controlled}
      data-testid="battle-log-panel"
      data-floating-panel="battle-log"
    >
      <LogPanel
        entries={entries}
        loading={loading}
        error={error}
        onClose={onClose}
        playerName={effectivePlayerName}
        onDragStart={(event) => beginFloatingPanelDrag(event, controlledPanelRef.current)}
      />
      <span
        className={styles.resizeHandle}
        data-resize-handle="battle-log"
        data-testid="battle-log-resize-handle"
        aria-hidden="true"
        onPointerDown={(event) => beginFloatingPanelResize(event, controlledPanelRef.current)}
      />
    </div>
  )
}

function LogPanel({
  entries,
  loading,
  error,
  onClose,
  playerName,
  onDragStart,
}: {
  entries: BattleLogView['entries']
  loading: boolean
  error: string | null
  onClose?: () => void
  playerName?: string
  onDragStart?: (event: React.PointerEvent<HTMLElement>) => void
}) {
  return (
    <section className={styles.panel} aria-label="Battle log">
      <header onPointerDown={onDragStart} data-drag-handle={onDragStart ? 'battle-log' : undefined}>
        <div>
          <strong>Battle Log</strong>
          <span>Rounds · actions · outcomes</span>
        </div>
        {onClose ? (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close battle log"
          >
            ×
          </button>
        ) : null}
      </header>
      {loading && entries.length === 0 ? (
        <p className={styles.empty}>Reading battle history…</p>
      ) : error ? (
        <p className={styles.empty} role="status">
          {error}
        </p>
      ) : (
        <BattleLogFeed entries={entries} playerName={playerName} />
      )}
    </section>
  )
}
