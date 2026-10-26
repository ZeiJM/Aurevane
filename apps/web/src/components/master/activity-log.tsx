'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { MasterActivityFeed } from '@/master/activity-log'
import { MasterHelp } from './master-help'
import styles from './activity-log.module.css'

export function MasterActivityLog({ initialFeed }: { initialFeed: MasterActivityFeed }) {
  const [feed, setFeed] = useState(initialFeed)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  const load = useCallback(async (before: string | null = null) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/master/activity${before ? `?before=${before}` : ''}`, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('The activity log could not be loaded. Try refreshing.')
      const next: MasterActivityFeed = await response.json()
      if (Date.parse(next.resetsAt) <= Date.now()) {
        setFeed((current) => ({ ...current, entries: [], nextCursor: null }))
        return
      }
      setFeed((current) =>
        before && current.weekStartsAt === next.weekStartsAt
          ? {
              ...next,
              entries: [
                ...current.entries,
                ...next.entries.filter(
                  (entry) => !current.entries.some((existing) => existing.id === entry.id),
                ),
              ],
            }
          : next,
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The activity log could not be loaded. Try refreshing.',
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }, [])
  useEffect(() => {
    const reset = () => {
      setFeed((current) => ({ ...current, entries: [], nextCursor: null }))
      void load()
    }
    const delay = Date.parse(feed.resetsAt) - Date.now()
    if (delay <= 0) {
      const timer = setTimeout(reset, 0)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(reset, delay)
    return () => clearTimeout(timer)
  }, [feed.resetsAt, load])
  return (
    <section className={styles.workspace} aria-label="Weekly Master Panel activity">
      <div className={styles.toolbar}>
        <div className={styles.note}>
          Clears every Monday at 00:00 UTC.{' '}
          <MasterHelp label="Activity Log">
            Only the Game Owner can view this weekly list. It records published content, Staff
            access, player support, World settings, Combat Rules, music and events. Existing history
            is retained. Where an older source records an account, its linked Staff names appear
            together.
          </MasterHelp>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy}>
          {busy ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
      <div
        className={styles.scroll}
        aria-busy={busy}
        tabIndex={0}
        role="region"
        aria-label="Recorded changes"
      >
        {feed.entries.length ? (
          <ol className={styles.list}>
            {feed.entries.map((entry) => (
              <li key={entry.id} className={styles.entry}>
                <div className={styles.person}>
                  <strong>{entry.actor}</strong>
                  <time dateTime={entry.occurredAt}>
                    {new Date(entry.occurredAt).toLocaleString('en-US', {
                      timeZone: 'UTC',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}{' '}
                    UTC
                  </time>
                </div>
                <div className={styles.change}>
                  <span>{entry.action}</span>
                  <strong>{entry.subject}</strong>
                  {entry.detail ? <small>{entry.detail}</small> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>No changes recorded this week.</p>
        )}
        {feed.nextCursor ? (
          <button
            className={styles.earlier}
            type="button"
            disabled={busy}
            onClick={() => void load(feed.nextCursor)}
          >
            Load earlier
          </button>
        ) : null}
      </div>
    </section>
  )
}
