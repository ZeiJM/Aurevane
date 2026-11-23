'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseAccountBanStatus, type AccountBanStatus } from '@/lib/account-ban-status'
import styles from './account-ban-notice.module.css'

function BanCountdown({ status }: { status: AccountBanStatus }) {
  const [now, setNow] = useState(Date.parse(status.serverTime))
  useEffect(() => {
    if (!status.expiresAt) return
    const started = Date.now(),
      serverTime = Date.parse(status.serverTime)
    const timer = window.setInterval(() => setNow(serverTime + Date.now() - started), 1000)
    return () => window.clearInterval(timer)
  }, [status.serverTime, status.expiresAt])
  if (status.permanent)
    return (
      <p>
        <strong>Permanent ban</strong>
      </p>
    )
  const seconds = Math.max(0, Math.ceil((Date.parse(status.expiresAt!) - now) / 1000))
  return (
    <p>
      {seconds
        ? `Time remaining: ${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ${seconds % 60}s`
        : 'The listed expiry has passed. Recheck your account status to continue.'}
    </p>
  )
}
export function AccountBanNotice({
  initialStatus,
  initialError = '',
}: {
  initialStatus: AccountBanStatus | null
  initialError?: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [error, setError] = useState(initialError)
  const [busy, setBusy] = useState(false)
  const checking = useRef(false)
  async function recheck() {
    if (checking.current) return
    checking.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/account/ban-status', { cache: 'no-store' })
      const value = await response.json()
      if (!response.ok) {
        if (response.status === 401) setStatus(null)
        throw new Error(value.error?.message ?? 'Account status could not be checked.')
      }
      const next = parseAccountBanStatus(value)
      setStatus(next)
      if (!next.active) router.replace('/game')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account status could not be checked.')
    } finally {
      checking.current = false
      setBusy(false)
    }
  }
  return (
    <main className={styles.page}>
      <section className={styles.notice} aria-busy={busy}>
        <p className={styles.kicker}>AUREVANE · Account status</p>
        <h1>{status?.active ? 'This account is banned' : 'Check your account status'}</h1>
        {status?.active ? (
          <>
            <h2>Reason</h2>
            <p className={styles.reason}>{status.reason}</p>
            <BanCountdown key={status.serverTime} status={status} />
            <p>
              The ban applies to every character on this account. Contact support if you believe it
              is an error.
            </p>
          </>
        ) : (
          <p>Recheck to verify whether you can return to the game.</p>
        )}
        {error ? <p role="alert">{error}</p> : null}
        <div className={styles.actions}>
          <button type="button" disabled={busy} onClick={() => void recheck()}>
            {busy ? 'Checking…' : 'Recheck account status'}
          </button>
          <form method="post" action="/auth/signout">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </section>
    </main>
  )
}
