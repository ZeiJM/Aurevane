'use client'

import { useEffect, useRef, useState } from 'react'
import {
  disciplineDeleteBlockerLink,
  type DisciplineDeletePlan,
} from '@/lib/discipline-delete-plan'
import { contentRecordCommand } from './content-record-workflow'
import styles from './game-content-workspace.module.css'

const blockerNames: Record<string, string> = {
  'active-discipline': 'Equipped Discipline',
  'personal-core-profile': 'Primary Core Stats',
  'earned-skill': 'Learned Skill',
  'equipped-skill': 'Equipped Skill',
  'saved-loadout': 'Saved loadout',
  'discipline-skill-grant': 'Skill access',
  'player-grant': 'Discipline grant',
  'content-link': 'Linked Skill',
  'definition-current': 'Current definition',
  'definition-draft': 'Saved draft',
  'builtin-prerequisite': 'Unlock prerequisite',
  'builtin-essence-selection': 'Essence selection',
  'builtin-resonance-selection': 'Resonance selection',
}
const kindNames = {
  discipline: 'Discipline',
  skill: 'Skill',
  essence: 'Essence',
  resonance: 'Resonance',
}

export function DeleteDiscipline({
  contentKey,
  name,
  disabled,
  onDeleted,
  onBusyChange,
}: {
  contentKey: string
  name: string
  disabled: boolean
  onDeleted(keys: readonly string[]): void
  onBusyChange(busy: boolean): void
}) {
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<DisciplineDeletePlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const running = useRef(false)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    return () => {
      previous?.focus()
    }
  }, [open])
  async function review() {
    if (running.current) return
    running.current = true
    setOpen(true)
    setBusy(true)
    setError('')
    setConfirmed(false)
    setPlan(null)
    try {
      const result = await contentRecordCommand<{ plan: DisciplineDeletePlan }>({
        action: 'review-deletion',
        contentKey,
      })
      setPlan(result.plan)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to review deletion.')
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  async function remove() {
    if (running.current || !plan || plan.blockerCount || !confirmed) return
    running.current = true
    setBusy(true)
    setError('')
    onBusyChange(true)
    try {
      const result = await contentRecordCommand<{ deletedKeys: string[] }>({
        action: 'delete-discipline',
        contentKey,
        reviewToken: plan.token,
      })
      onDeleted(result.deletedKeys)
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete this Discipline.')
      setConfirmed(false)
    } finally {
      running.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }
  return (
    <>
      <details className={styles.recordActions}>
        <summary>Actions</summary>
        <button type="button" disabled={disabled || busy} onClick={() => void review()}>
          Delete Discipline…
        </button>
      </details>
      {open ? (
        <dialog
          ref={dialog}
          className={`${styles.modal} ${styles.deleteDialog}`}
          aria-labelledby="discipline-delete-title"
          onCancel={(event) => {
            event.preventDefault()
            if (!busy || !plan) setOpen(false)
          }}
        >
          <div className={styles.modalFrame}>
            <header className={styles.modalHeading}>
              <h2 id="discipline-delete-title">Delete {name}?</h2>
              <button type="button" disabled={busy && !!plan} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </header>
            <div className={styles.modalBody}>
              <p>
                This removes the Discipline and the owned content listed below from the game. Saved
                battles and activity history are retained.
              </p>
              {error ? (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              ) : null}
              {busy && !plan ? <p role="status">Checking dependencies…</p> : null}
              {plan ? (
                <>
                  <h3>
                    {plan.records.length} {plan.records.length === 1 ? 'item' : 'items'} to delete
                  </h3>
                  <ul>
                    {[...plan.records]
                      .sort((a, b) => {
                        const kinds = ['discipline', 'skill', 'essence', 'resonance']
                        return (
                          kinds.indexOf(a.contentKind) - kinds.indexOf(b.contentKind) ||
                          a.name.localeCompare(b.name)
                        )
                      })
                      .map((row) => (
                        <li key={row.contentKey}>
                          {row.name} <small>({kindNames[row.contentKind]})</small>
                        </li>
                      ))}
                  </ul>
                  {plan.blockerCount ? (
                    <>
                      <h3>
                        Resolve {plan.blockerCount}{' '}
                        {plan.blockerCount === 1 ? 'dependency' : 'dependencies'} first
                      </h3>
                      <p>Reassign or remove these references, then refresh this review.</p>
                      <ul>
                        {plan.blockers.map((row) => (
                          <li key={`${row.contentKey}:${row.kind}:${row.key}`}>
                            <a
                              href={disciplineDeleteBlockerLink(row)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {row.name}
                            </a>{' '}
                            — {blockerNames[row.kind] ?? 'Content reference'}
                          </li>
                        ))}
                      </ul>
                      {plan.blockerCount > plan.blockers.length ? (
                        <p>
                          Showing the first {plan.blockers.length}. Refresh after resolving these to
                          see the rest.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <label className={styles.deleteConfirmation}>
                      <input
                        type="checkbox"
                        checked={confirmed}
                        disabled={busy}
                        onChange={(event) => setConfirmed(event.currentTarget.checked)}
                      />{' '}
                      Delete these {plan.records.length}{' '}
                      {plan.records.length === 1 ? 'item' : 'items'} permanently, including any
                      unsaved edits.
                    </label>
                  )}
                </>
              ) : null}
            </div>
            <footer className={styles.modalFooter}>
              <button type="button" disabled={busy} onClick={() => void review()}>
                Refresh review
              </button>
              <button
                type="button"
                className={styles.deleteButton}
                disabled={busy || !plan || plan.blockerCount > 0 || !confirmed}
                onClick={() => void remove()}
              >
                {busy && plan ? 'Deleting…' : 'Delete permanently'}
              </button>
            </footer>
          </div>
        </dialog>
      ) : null}
    </>
  )
}
