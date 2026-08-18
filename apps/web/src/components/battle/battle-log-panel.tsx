'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import styles from './battle-log-panel.module.css'

interface BattleLogPanelProps {
  battleSessionId: string
  battleVersion?: number
  open?: boolean
  onClose?: () => void
}

interface BattleLogResponse {
  battleLog?: BattleLogView
  error?: { message?: string }
}

export function BattleLogPanel({
  battleSessionId,
  battleVersion,
  open,
  onClose,
}: BattleLogPanelProps) {
  const controlled = open !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const visible = controlled ? Boolean(open) : internalOpen
  const [log, setLog] = useState<BattleLogView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestSequence = useRef(0)

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
    function toggleLog() {
      if (controlled) return
      setInternalOpen((value) => !value)
    }
    window.addEventListener('aurevane:battle-log-toggle', toggleLog)
    return () => window.removeEventListener('aurevane:battle-log-toggle', toggleLog)
  }, [controlled])

  const entries = log?.entries ?? []

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
          Combat Log <span>{loading ? '…' : entries.length}</span>
        </button>
        {visible ? (
          <LogPanel
            entries={entries}
            loading={loading}
            error={error}
            onClose={() => setInternalOpen(false)}
          />
        ) : null}
      </div>
    )
  }

  if (!visible) return null
  return (
    <div className={styles.controlled} data-testid="battle-log-panel">
      <LogPanel entries={entries} loading={loading} error={error} onClose={onClose} />
    </div>
  )
}

function LogPanel({
  entries,
  loading,
  error,
  onClose,
}: {
  entries: BattleLogView['entries']
  loading: boolean
  error: string | null
  onClose?: () => void
}) {
  return (
    <section className={styles.panel} aria-label="Committed battle log">
      <header>
        <div>
          <strong>Combat Log</strong>
          <span>Committed actions and results · newest first</span>
        </div>
        {onClose ? (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close combat log"
          >
            ×
          </button>
        ) : null}
      </header>
      {loading && entries.length === 0 ? (
        <p className={styles.empty}>Reading committed events…</p>
      ) : error ? (
        <p className={styles.empty} role="status">
          {error}
        </p>
      ) : entries.length === 0 ? (
        <p className={styles.empty}>No committed combat events yet.</p>
      ) : (
        <ol>
          {entries.map((entry) => (
            <li key={`${entry.battleVersion}:${entry.eventIndex}`}>
              <span>v{entry.battleVersion}</span>
              <p>{entry.message}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
