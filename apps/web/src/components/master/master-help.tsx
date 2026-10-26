'use client'
import { useId, type ReactNode } from 'react'
import { OperationalDialog } from './operational-dialog'
import styles from './master-help.module.css'

/** Useful guidance stays available without taking space from the editor. */
export function MasterHelp({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()
  return (
    <span className={styles.help}>
      <OperationalDialog id={id} title={label} trigger="i" triggerLabel={`About ${label}`}>
        {children}
      </OperationalDialog>
    </span>
  )
}
