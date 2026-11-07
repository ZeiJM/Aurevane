'use client'

import { useId, useRef, useState } from 'react'
import { APPEARANCE_PRESETS, type AppearanceBlueprint } from '@/appearance/appearance-manifest'
import { AppearanceBuilder, loadAppearanceCandidate } from './appearance-builder'
import styles from './appearance-builder.module.css'

export function AppearanceBuilderDialog({
  label,
  confirmLabel,
  value,
  prepare,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  value?: AppearanceBlueprint | null
  prepare?: () => Promise<AppearanceBlueprint | null>
  onConfirm: (blueprint: AppearanceBlueprint) => void | Promise<void>
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [candidate, setCandidate] = useState<AppearanceBlueprint | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function open() {
    setCandidate(null)
    setError(null)
    dialog.current?.showModal()
    setPending(true)
    try {
      const active = prepare ? await prepare() : value
      setCandidate(active ?? APPEARANCE_PRESETS[0].blueprint)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Appearance settings are unavailable.')
    } finally {
      setPending(false)
    }
  }

  async function confirm() {
    if (!candidate || pending) return
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
        {error ? <p role="alert">{error}</p> : null}
        <footer className={styles.dialogFooter}>
          <button type="button" disabled={!candidate || pending} onClick={() => void confirm()}>
            {pending ? 'Preparing…' : confirmLabel}
          </button>
        </footer>
      </dialog>
    </>
  )
}
