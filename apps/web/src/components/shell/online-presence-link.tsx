'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from './authenticated-game-shell.module.css'

export function OnlinePresenceLink({ initialCount = null }: { initialCount?: number | null }) {
  const [count, setCount] = useState<number | null>(initialCount)

  useEffect(() => {
    let cancelled = false
    let pending = false
    const controller = new AbortController()
    async function heartbeat() {
      if (pending || document.visibilityState === 'hidden') return
      pending = true
      try {
        const response = await fetch('/api/presence', {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
        })
        const body = (await response.json()) as { count?: number }
        if (
          !cancelled &&
          response.ok &&
          Number.isSafeInteger(body.count) &&
          typeof body.count === 'number' &&
          body.count >= 0
        )
          setCount(body.count)
      } catch {
        // Presence is supplementary UI. A transient heartbeat failure must not interrupt play.
      } finally {
        pending = false
      }
    }

    void heartbeat()
    const timer = window.setInterval(() => void heartbeat(), 2 * 60 * 1000)
    const onVisibilityChange = () => void heartbeat()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      controller.abort()
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
