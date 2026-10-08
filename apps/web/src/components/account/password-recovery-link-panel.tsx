'use client'

import { GameButton } from '@aurevane/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { INVALID_PASSWORD_RESET_MESSAGE } from '@/lib/auth/password-recovery'
import styles from './account-entry-shell.module.css'

export function PasswordRecoveryLinkPanel({ tokenHash }: { tokenHash: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(tokenHash ? '' : INVALID_PASSWORD_RESET_MESSAGE)
  async function continueRecovery() {
    if (!tokenHash || busy) return
    setBusy(true)
    setMessage('')
    // Remove the credential from address-bar/history before the explicit verification.
    window.history.replaceState(null, '', '/auth/recovery')
    try {
      const response = await fetch('/api/account/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenHash }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) {
        setMessage(result.error ?? INVALID_PASSWORD_RESET_MESSAGE)
        return
      }
      router.replace('/auth/reset-password')
      router.refresh()
    } catch {
      setMessage('Account services could not be reached. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={styles.accessPanel}>
      <p>Continue to verify your email link, then choose a new password.</p>
      {tokenHash ? (
        <GameButton type="button" disabled={busy} aria-busy={busy} onClick={continueRecovery}>
          {busy ? 'Verifying…' : 'Continue to reset password'}
        </GameButton>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <Link className={styles.textAction} href="/?account=recovery">
        Request a new reset link
      </Link>
      <Link className={styles.textAction} href="/">
        Back to sign in
      </Link>
    </div>
  )
}
