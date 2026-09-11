'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from './authenticated-game-shell.module.css'

export function OnlinePresenceLink() {
  // Unknown is not zero. The authenticated heartbeat supplies the authoritative count.
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let activeRequest: AbortController | null = null

    async function heartbeat() {
      if (cancelled || document.visibilityState === 'hidden' || activeRequest) return
      const controller = new AbortController()
      activeRequest = controller
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
          typeof body.count === 'number' &&
          Number.isSafeInteger(body.count) &&
          body.count >= 0
        ) {
          setCount(body.count)
        }
      } catch {
        // Presence is supplementary. Keep the last known count during transient failures.
      } finally {
        if (activeRequest === controller) activeRequest = null
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void heartbeat()
    }
    void heartbeat()
    const timer = window.setInterval(() => void heartbeat(), 2 * 60 * 1000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      activeRequest?.abort()
    }
  }, [])

  return (
    <Link href="/game/online" className={styles.onlineLink}>
      Online Users{' '}
      <span aria-label={count === null ? 'Count not available yet' : undefined}>
        {count ?? '—'}
      </span>
    </Link>
  )
}
