'use client'

import { GameButton } from '@aurevane/ui'
import { type FormEvent, useId, useState } from 'react'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'

import styles from './account-entry-shell.module.css'

type AccountMode = 'signin' | 'signup'

interface AccountAccessPanelProps {
  authAvailable: boolean
}

export function AccountAccessPanel({ authAvailable }: AccountAccessPanelProps) {
  const [mode, setMode] = useState<AccountMode>('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(
    authAvailable ? '' : 'Account entry is not open in this environment yet.',
  )
  const emailId = useId()
  const passwordId = useId()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!authAvailable || busy) {
      return
    }

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!email || password.length < 8) {
      setMessage('Enter a valid email and a password of at least 8 characters.')
      return
    }

    setBusy(true)
    setMessage(mode === 'signin' ? 'Opening your account…' : 'Creating your account…')

    try {
      const supabase = createSupabaseBrowserClient()

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          setMessage('We could not sign you in. Check your email and password, then try again.')
          return
        }

        window.location.assign('/game')
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/game`,
        },
      })

      if (error) {
        setMessage('We could not create that account. Check your details or try signing in instead.')
        return
      }

      if (data.session) {
        window.location.assign('/game')
        return
      }

      setMessage('Account created. Check your email to confirm it, then return here to sign in.')
    } catch {
      setMessage('Account services could not be reached. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  function changeMode(nextMode: AccountMode) {
    if (busy) {
      return
    }

    setMode(nextMode)
    setMessage('')
  }

  return (
    <div className={styles.accessPanel}>
      <div className={styles.modeSwitch} aria-label="Account access mode">
        <button
          type="button"
          className={mode === 'signin' ? styles.modeActive : undefined}
          aria-pressed={mode === 'signin'}
          onClick={() => changeMode('signin')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={mode === 'signup' ? styles.modeActive : undefined}
          aria-pressed={mode === 'signup'}
          onClick={() => changeMode('signup')}
        >
          Create account
        </button>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <label htmlFor={emailId}>
          <span>Email</span>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            disabled={!authAvailable || busy}
          />
        </label>

        <label htmlFor={passwordId}>
          <span>Password</span>
          <input
            id={passwordId}
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            disabled={!authAvailable || busy}
          />
        </label>

        <GameButton
          className={styles.submit}
          type="submit"
          disabled={!authAvailable || busy}
          aria-busy={busy}
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Enter AUREVANE' : 'Create account'}
        </GameButton>
      </form>

      <p className={styles.formMessage} aria-live="polite" data-testid="account-message">
        {message || 'Your account identity stays separate from your future character identity.'}
      </p>
    </div>
  )
}
