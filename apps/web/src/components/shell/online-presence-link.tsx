'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import styles from './authenticated-game-shell.module.css'

export function OnlinePresenceLink({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    let cancelled = false
    async function heartbeat() {
      try {
        const response = await fetch('/api/presence', { method: 'POST', cache: 'no-store' })
        const body = (await response.json()) as { count?: number }
        if (!cancelled && response.ok && Number.isSafeInteger(body.count)) setCount(body.count ?? 0)
      } catch {
        // Presence is supplementary UI. A transient heartbeat failure must not interrupt play.
      }
    }

    void heartbeat()
    const timer = window.setInterval(() => void heartbeat(), 2 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  return (
    <Link href="/game/online" className={styles.onlineLink}>
      Online Users <span>{count}</span>
    </Link>
  )
}
