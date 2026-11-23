'use client'
import { useId, type ReactNode } from 'react'
import { OperationalDialog } from './operational-dialog'
import styles from './master-help.module.css'

/** Useful guidance stays available without taking space from the editor. */
export function MasterHelp({
  label,
  field = false,
  children,
}: {
  label: string
  field?: boolean
  children: ReactNode
}) {
  const id = useId()
  return (
    <span className={styles.help}>
      <OperationalDialog
        id={id}
        title={field ? `About ${label}` : label}
        trigger="i"
        triggerLabel={`About ${label}`}
      >
        {children}
      </OperationalDialog>
    </span>
  )
}
