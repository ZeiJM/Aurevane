'use client'

import { GameButton } from '@aurevane/ui'
import { type FormEvent, useId, useState } from 'react'

import { createSupabaseBrowserClient, type BrowserSupabaseConfig } from '@/lib/supabase/client'

import styles from './account-entry-shell.module.css'

type AccountMode = 'signin' | 'signup'
type MessageTone = 'neutral' | 'error'

interface AccountAccessPanelProps {
  authConfig: BrowserSupabaseConfig | null
  initialMessage?: string
}

export function AccountAccessPanel({ authConfig, initialMessage = '' }: AccountAccessPanelProps) {
  const [mode, setMode] = useState<AccountMode>('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(initialMessage)
  const [messageTone, setMessageTone] = useState<MessageTone>('neutral')
  const emailId = useId()
  const passwordId = useId()

  function showMessage(nextMessage: string, tone: MessageTone = 'neutral') {
    setMessage(nextMessage)
    setMessageTone(tone)
  }

  async function claimGameplaySession(): Promise<boolean> {
    const response = await fetch('/api/account/game-session/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    return response.ok
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!authConfig || busy) return

    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')

    if (!email || password.length < 8) {
      showMessage('Enter a valid email and a password of at least 8 characters.', 'error')
      return
    }

    setBusy(true)
    showMessage(mode === 'signin' ? 'Opening your account…' : 'Creating your account…')

    try {
      const supabase = createSupabaseBrowserClient(authConfig)

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          showMessage(
            'We could not sign you in. Check your email and password, then try again.',
            'error',
          )
          return
        }

        if (!(await claimGameplaySession())) {
          showMessage(
            'Signed in, but the game session could not be activated. Try again in a moment.',
            'error',
          )
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
        if (/already registered/i.test(error.message)) {
          showMessage('An account already exists with this email. Sign in instead.', 'error')
          return
        }

        showMessage(
          'We could not create that account. Check your details or try signing in instead.',
          'error',
        )
        return
      }

      // Hosted Supabase deliberately returns an obfuscated user instead of an error for an
      // already-confirmed email. That fake user has no identities, while a genuine email/password
      // signup has an email identity. Treat the obfuscated response as a hard duplicate denial so
      // the account UI does not imply that a second account was created.
      if (data.user?.identities?.length === 0) {
        showMessage('An account already exists with this email. Sign in instead.', 'error')
        return
      }

      // Email confirmation is required for AUREVANE. If Supabase ever returns a session directly
      // from sign-up (for example after an auth configuration regression), clear it immediately
      // instead of allowing a newly submitted account to enter gameplay without verification.
      if (data.session) {
        await supabase.auth.signOut({ scope: 'local' })
      }

      showMessage('Account created. Check your email for a confirmation link before signing in.')
    } catch {
      showMessage('Account services could not be reached. Try again in a moment.', 'error')
    } finally {
      setBusy(false)
    }
  }

  function changeMode(nextMode: AccountMode) {
    if (busy) return
    setMode(nextMode)
    showMessage('')
  }

  if (!authConfig) {
    return (
      <div className={styles.environmentNotice} role="status" data-testid="account-unavailable">
        <strong>Account services are not enabled in this environment yet.</strong>
        <p>
          The public shell is available for review. Sign-in and account creation appear only where a
          dedicated AUREVANE Supabase environment is configured, so disabled fields cannot
          masquerade as a broken mobile form.
        </p>
      </div>
    )
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="next"
            required
            disabled={busy}
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
            enterKeyHint="go"
            required
            disabled={busy}
          />
        </label>

        <GameButton className={styles.submit} type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Enter AUREVANE' : 'Create account'}
        </GameButton>
      </form>

      <p
        className={styles.formMessage}
        aria-live="polite"
        data-testid="account-message"
        data-tone={messageTone}
      >
        {message || 'Your account identity stays separate from your future character identity.'}
      </p>
    </div>
  )
}