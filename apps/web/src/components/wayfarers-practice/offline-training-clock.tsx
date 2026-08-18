'use client'

import { useEffect, useMemo, useState } from 'react'

import { formatPracticeDuration } from './training-report-card'
import styles from './offline-training-shell.module.css'

interface OfflineTrainingClockProps {
  serverNow: string
  minimumOfflineSeconds: number
}

export function OfflineTrainingClock({ serverNow, minimumOfflineSeconds }: OfflineTrainingClockProps) {
  const baseServerTime = useMemo(() => new Date(serverNow).getTime(), [serverNow])
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const synchronizedNow = Number.isFinite(baseServerTime)
    ? new Date(baseServerTime + elapsed)
    : new Date()

  return (
    <div className={styles.liveClock} aria-live="polite">
      <div>
        <span>Current status</span>
        <strong>Online now · training is paused</strong>
      </div>
      <div>
        <span>Offline training begins</span>
        <strong>After {formatPracticeDuration(minimumOfflineSeconds)} away</strong>
      </div>
      <div>
        <span>Server-synced time</span>
        <strong>{synchronizedNow.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })} UTC</strong>
      </div>
    </div>
  )
}
