'use client'

import { GameButton } from '@aurevane/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useId, useState } from 'react'

import {
  ACCOUNT_PASSWORD_MINIMUM_LENGTH,
  INVALID_PASSWORD_RESET_MESSAGE,
  validateNewAccountPassword,
} from '@/lib/auth/password-recovery'
import styles from './account-entry-shell.module.css'

export function PasswordResetPanel({ verified }: { verified: boolean }) {
  const router = useRouter()
  const passwordId = useId()
  const confirmationId = useId()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [expired, setExpired] = useState(!verified)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || expired) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirmPassword = String(form.get('confirmPassword') ?? '')
    const validation = validateNewAccountPassword(password, confirmPassword)
    if (validation) {
      setMessage(validation)
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/account/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword }),
      })
      const result: { error?: string } = await response.json()
      if (!response.ok) {
        setExpired(response.status === 401)
        setMessage(result.error ?? 'Your password could not be changed. Try again in a moment.')
        return
      }
      router.replace('/?account=password-reset')
      router.refresh()
    } catch {
      setMessage('Account services could not be reached. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.accessPanel} data-testid="password-reset-panel">
      {expired ? (
        <p role="status">{INVALID_PASSWORD_RESET_MESSAGE}</p>
      ) : (
        <>
          <p>Choose a new password for your account. You will sign in again after saving it.</p>
          <form className={styles.form} onSubmit={submit}>
            <label htmlFor={passwordId}>
              <span>New password</span>
              <input
                id={passwordId}
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={ACCOUNT_PASSWORD_MINIMUM_LENGTH}
                required
                disabled={busy}
              />
            </label>
            <label htmlFor={confirmationId}>
              <span>Confirm new password</span>
              <input
                id={confirmationId}
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={ACCOUNT_PASSWORD_MINIMUM_LENGTH}
                required
                disabled={busy}
              />
            </label>
            <GameButton className={styles.submit} type="submit" disabled={busy} aria-busy={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </GameButton>
          </form>
        </>
      )}
      {message && !expired ? (
        <p className={styles.formMessage} data-tone="error" role="status">
          {message}
        </p>
      ) : null}
      <Link className={styles.textAction} href="/?account=recovery">
        Request a new reset link
      </Link>
      <Link className={styles.textAction} href="/">
        Back to sign in
      </Link>
    </div>
  )
}
