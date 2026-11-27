'use client'

import { useId, useRef, useState } from 'react'
import type { AppearanceBlueprint } from '@/appearance/appearance-manifest'
import type { AuthoredAppearanceBlueprint } from '@/appearance/appearance-authored-catalog'
import type { AppearanceGender } from '@/appearance/appearance-gender'
import { authoredPresentation } from '@/appearance/appearance-live'
import { AppearanceBuilder, loadAppearanceCandidate } from './appearance-builder'
import styles from './appearance-builder.module.css'

export function AppearanceBuilderDialog({
  label,
  confirmLabel,
  value,
  initialGender,
  prepare,
  onConfirm,
  confirmationHint,
  confirmDisabled = false,
}: {
  label: string
  confirmLabel: string
  value?: AppearanceBlueprint | null
  initialGender?: AppearanceGender
  prepare?: () => Promise<AppearanceBlueprint | null>
  onConfirm: (blueprint: AuthoredAppearanceBlueprint) => void | Promise<void>
  confirmationHint?: string
  confirmDisabled?: boolean
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const initialCandidate = useRef<AuthoredAppearanceBlueprint | null>(null)
  const [candidate, setCandidate] = useState<AuthoredAppearanceBlueprint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function open() {
    setCandidate(null)
    setError(null)
    dialog.current?.showModal()
    setPending(true)
    try {
      const active = prepare ? await prepare() : value
      const initial = authoredPresentation(active, null, initialGender)
      initialCandidate.current = initial
      setCandidate(initial)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Appearance settings are unavailable.')
    } finally {
      setPending(false)
    }
  }

  async function confirm() {
    if (!candidate || pending || confirmDisabled) return
    setPending(true)
    setError(null)
    try {
      await loadAppearanceCandidate(candidate)
      await onConfirm(candidate)
      dialog.current?.close()
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'The appearance could not be confirmed.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => void open()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={id}
        onClose={() => {
          setCandidate(null)
          trigger.current?.focus()
        }}
        onCancel={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <header className={styles.dialogHeader}>
          <h2 id={id}>Character appearance</h2>
          <button type="button" disabled={pending} onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        {candidate ? (
          <AppearanceBuilder value={candidate} onChange={setCandidate} disabled={pending} />
        ) : null}
        {error ? (
          <p className={styles.dialogError} role="alert">
            {error}
          </p>
        ) : null}
        <footer className={styles.dialogFooter}>
          {candidate && confirmationHint ? (
            <p className={styles.confirmationHint}>{confirmationHint}</p>
          ) : null}
          <div className={styles.dialogActions}>
            <button
              type="button"
              className={styles.resetButton}
              disabled={!candidate || pending}
              onClick={() => {
                setError(null)
                setCandidate(initialCandidate.current)
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              disabled={!candidate || pending || confirmDisabled}
              onClick={() => void confirm()}
            >
              {pending ? 'Preparing…' : confirmLabel}
            </button>
          </div>
        </footer>
      </dialog>
    </>
  )
}
