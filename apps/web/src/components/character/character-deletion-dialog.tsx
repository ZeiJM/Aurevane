'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import styles from './character-select-shell.module.css'

/** Modal behavior only. Scheduling, cancellation, and grace periods remain server-owned. */
export function CharacterDeletionDialog({
  titleId,
  busy,
  onDismiss,
  className,
  children,
}: {
  titleId: string
  busy: boolean
  onDismiss: () => void
  className?: string
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const opener = document.activeElement
    const root = document.documentElement
    const previousOverflow = root.style.overflow
    dialog.showModal()
    root.style.overflow = 'hidden'

    return () => {
      dialog.close()
      root.style.overflow = previousOverflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    // Disabled controls cannot hold keyboard focus while a request is in flight.
    if (busy) panelRef.current?.focus({ preventScroll: true })
  }, [busy])

  return (
    <dialog
      ref={dialogRef}
      className={styles.modalBackdrop}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onDismiss()
      }}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) {
          // Avoid the mousedown default stealing restored focus after unmount.
          event.preventDefault()
          onDismiss()
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'input:not(:disabled), button:not(:disabled)',
          ),
        ).filter((control) => control.tabIndex >= 0 && control.getClientRects().length > 0)
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (!first) {
          event.preventDefault()
          panelRef.current?.focus()
        } else if (!controls.includes(document.activeElement as HTMLElement)) {
          event.preventDefault()
          const target = event.shiftKey ? last : first
          target?.focus()
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <section
        ref={panelRef}
        className={[styles.modal, className].filter(Boolean).join(' ')}
        data-av-surface="moonstone"
        tabIndex={-1}
      >
        {children}
      </section>
    </dialog>
  )
}
