'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BattleLogView } from '@/server/battle/battle-log-service'

import { useBattlePlayerName } from './battle-runtime-context'
import styles from './battle-log-panel.module.css'

interface BattleLogPanelProps {
  battleSessionId: string
  battleVersion?: number
  open?: boolean
  onClose?: () => void
  playerName?: string
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
  playerName,
}: BattleLogPanelProps) {
  const runtimePlayerName = useBattlePlayerName()
  const effectivePlayerName = playerName ?? runtimePlayerName ?? undefined
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
            playerName={effectivePlayerName}
          />
        ) : null}
      </div>
    )
  }

  if (!visible) return null
  return (
    <div className={styles.controlled} data-testid="battle-log-panel">
      <LogPanel
        entries={entries}
        loading={loading}
        error={error}
        onClose={onClose}
        playerName={effectivePlayerName}
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
}: {
  entries: BattleLogView['entries']
  loading: boolean
  error: string | null
  onClose?: () => void
  playerName?: string
}) {
  const actionGroups = useMemo(() => groupEntriesByCommittedVersion(entries), [entries])

  return (
    <section className={styles.panel} aria-label="Committed battle log">
      <header>
        <div>
          <strong>Combat Log</strong>
          <span>Committed action summaries · newest first</span>
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
      ) : actionGroups.length === 0 ? (
        <p className={styles.empty}>No committed combat events yet.</p>
      ) : (
        <ol>
          {actionGroups.map((group) => (
            <li key={group.battleVersion}>
              <div className={styles.actionEntry}>
                <p>{summarizeCommittedAction(group.entries, playerName)}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function groupEntriesByCommittedVersion(entries: BattleLogView['entries']) {
  const groups: Array<{
    battleVersion: number
    entries: BattleLogView['entries']
  }> = []

  for (const entry of entries) {
    const current = groups.at(-1)
    if (current?.battleVersion === entry.battleVersion) {
      current.entries = [...current.entries, entry]
    } else {
      groups.push({ battleVersion: entry.battleVersion, entries: [entry] })
    }
  }

  return groups
}

function summarizeCommittedAction(entries: BattleLogView['entries'], playerName?: string): string {
  const personalized = entries.map((entry) => personalizeBattleMessage(entry.message, playerName))
  const meaningful = personalized.filter((message) => !isBookkeepingMessage(message))
  const source = meaningful.length > 0 ? meaningful : personalized
  const unique = source.filter((message, index) => source.indexOf(message) === index)
  if (unique.length === 0) return 'Combat state advanced.'
  return unique.slice(0, 3).join(' · ')
}

function isBookkeepingMessage(message: string): boolean {
  return (
    /^Round \d+ began\.?$/i.test(message) ||
    /activation began/i.test(message) ||
    /ended the activation/i.test(message) ||
    /ended facing/i.test(message) ||
    /chose facing/i.test(message) ||
    /chose (an? )?.*opportunity/i.test(message) ||
    /spent \d+ Movement/i.test(message)
  )
}

function personalizeBattleMessage(message: string, playerName?: string): string {
  if (!playerName) return message
  return message.replaceAll('Wayfarer', playerName)
}
