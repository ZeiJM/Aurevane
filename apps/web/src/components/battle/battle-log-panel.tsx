'use client'

import { useEffect, useRef, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import styles from './battle-log-panel.module.css'

interface BattleLogPanelProps {
  battleSessionId: string
  battleVersion?: number
}

interface BattleLogResponse {
  battleLog?: BattleLogView
  error?: { message?: string }
}

export function BattleLogPanel({ battleSessionId }: BattleLogPanelProps) {
  const [log, setLog] = useState<BattleLogView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const requestSequence = useRef(0)
  const detailsRef = useRef<HTMLDetailsElement>(null)

  async function loadLog() {
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
  }

  useEffect(() => {
    function toggleLog() {
      const details = detailsRef.current
      if (!details) return
      details.open = !details.open
    }

    window.addEventListener('aurevane:battle-log-toggle', toggleLog)
    return () => window.removeEventListener('aurevane:battle-log-toggle', toggleLog)
  }, [])

  const entries = log?.entries ?? []

  return (
    <details
      ref={detailsRef}
      className={styles.log}
      onToggle={(event) => {
        if (event.currentTarget.open) void loadLog()
      }}
    >
      <summary data-testid="battle-log-toggle">
        Log <span>{loading ? '…' : entries.length}</span>
      </summary>
      <div
        className={styles.panel}
        aria-label="Committed battle log"
        data-testid="battle-log-panel"
      >
        <header>
          <strong>Committed history</strong>
          <span>Authoritative events · newest first</span>
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
      </div>
    </details>
  )
}
