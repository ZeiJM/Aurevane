'use client'
import { useRef, type ReactNode } from 'react'
import styles from './operational-dialog.module.css'

/** Native modal semantics provide focus containment, Escape dismissal and an inert background. */
export function OperationalDialog({
  id,
  title,
  trigger,
  triggerLabel,
  children,
}: {
  id: string
  title: string
  trigger: string
  triggerLabel?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        type="button"
        ref={opener}
        aria-label={triggerLabel ?? trigger}
        aria-haspopup="dialog"
        aria-controls={id}
        onClick={() => dialog.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={`${id}-title`}
        className={styles.dialog}
        onClose={() => opener.current?.focus()}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close()
        }}
      >
        <div className={styles.content}>
          <div className={styles.heading}>
            <h3 id={`${id}-title`}>{title}</h3>
            <button
              type="button"
              autoFocus
              onClick={() => dialog.current?.close()}
              aria-label={`Close ${title}`}
            >
              Close
            </button>
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      </dialog>
    </>
  )
}
