'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from './authenticated-game-shell.module.css'

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000

let cachedPresenceCount: number | null = null
let lastHeartbeatAt = 0
let sharedHeartbeat: Promise<number | null> | null = null

async function requestPresenceHeartbeat(): Promise<number | null> {
  const now = Date.now()
  if (cachedPresenceCount !== null && now - lastHeartbeatAt < HEARTBEAT_INTERVAL_MS) {
    return cachedPresenceCount
  }
  if (sharedHeartbeat) return sharedHeartbeat

  sharedHeartbeat = (async () => {
    try {
      const response = await fetch('/api/presence', {
        method: 'POST',
        cache: 'no-store',
      })
      const body = (await response.json()) as { count?: number }
      if (
        !response.ok ||
        !Number.isSafeInteger(body.count) ||
        typeof body.count !== 'number' ||
        body.count < 0
      ) {
        return cachedPresenceCount
      }

      cachedPresenceCount = body.count
      lastHeartbeatAt = Date.now()
      return body.count
    } catch {
      // Presence is supplementary UI. A transient heartbeat failure must not interrupt play.
      return cachedPresenceCount
    } finally {
      sharedHeartbeat = null
    }
  })()

  return sharedHeartbeat
}

export function OnlinePresenceLink({ initialCount = null }: { initialCount?: number | null }) {
  const [count, setCount] = useState<number | null>(() => initialCount ?? cachedPresenceCount)

  useEffect(() => {
    let cancelled = false

    async function heartbeat() {
      if (document.visibilityState === 'hidden') return
      const next = await requestPresenceHeartbeat()
      if (!cancelled && next !== null) setCount(next)
    }

    void heartbeat()
    const timer = window.setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void heartbeat()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(timer)
    }
  }, [])

  return (
    <Link href="/game/online" className={styles.onlineLink}>
      Online Users{' '}
      <span aria-label={count === null ? 'Loading online count' : undefined}>{count ?? '—'}</span>
    </Link>
  )
}
