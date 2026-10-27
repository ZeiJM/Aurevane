'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { AuthoredDiscipline } from '@aurevane/game-core/content/authored-content'
import type { ContentReference } from './content-definition-fields'
import styles from './discipline-relationship-list.module.css'

/** Missing catalogue metadata never makes an unrelated power eligible. */
export function relationshipPowerChoices(
  value: AuthoredDiscipline,
  partner: string | null,
  choices: readonly ContentReference[],
): readonly ContentReference[] {
  return choices.filter((choice) =>
    partner === null
      ? choice.contentKind === 'essence' && choice.sourceDisciplineId === value.id
      : partner !== value.id &&
        choice.contentKind === 'resonance' &&
        choice.disciplinePair?.length === 2 &&
        choice.disciplinePair.includes(value.id) &&
        choice.disciplinePair.includes(partner),
  )
}

/** Association changes remain local until the containing discipline is committed. */
export function withDisciplineRelationship(
  value: AuthoredDiscipline,
  partner: string | null,
  power: string,
): AuthoredDiscipline {
  const removedOverride =
    !power && value.relationshipOverride?.withDisciplineId === partner
      ? { relationshipOverride: null }
      : {}
  if (partner === null) return { ...value, essenceId: power || null, ...removedOverride }
  const rows = value.resonanceSelections ?? []
  const exists = rows.some((row) => row.withDisciplineId === partner)
  return {
    ...value,
    resonanceSelections: power
      ? exists
        ? rows.map((row) =>
            row.withDisciplineId === partner ? { ...row, resonanceId: power } : row,
          )
        : [...rows, { withDisciplineId: partner, resonanceId: power }]
      : rows.filter((row) => row.withDisciplineId !== partner),
    ...removedOverride,
  }
}

function AssociationDialog({
  value,
  partner,
  label,
  choices,
  onApply,
  onClose,
}: {
  value: AuthoredDiscipline
  partner: string | null
  label: string
  choices: readonly ContentReference[]
  onApply(power: string): void
  onClose(): void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const current =
    partner === null
      ? (value.essenceId ?? '')
      : (value.resonanceSelections?.find((row) => row.withDisciplineId === partner)?.resonanceId ??
        '')
  const [selected, setSelected] = useState(current)
  const available = relationshipPowerChoices(value, partner, choices)
  const retained = !!current && !available.some((choice) => choice.contentKey === current)
  const retainedName =
    choices.find((choice) => choice.contentKey === current)?.name ?? 'Retained power'
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    return () => previous?.focus()
  }, [])
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <header className={styles.dialogHeading}>
        <h3 id={title}>Change power · {label}</h3>
        <button type="button" autoFocus onClick={onClose} aria-label="Close power selection">
          Close
        </button>
      </header>
      <div className={styles.dialogBody}>
        <label>
          Power
          <select value={selected} onChange={(event) => setSelected(event.currentTarget.value)}>
            <option value="">No power selected</option>
            {retained ? <option value={current}>{retainedName} · retained selection</option> : null}
            {available.map((choice) => (
              <option key={choice.contentKey} value={choice.contentKey}>
                {choice.name}
              </option>
            ))}
          </select>
        </label>
        {!available.length ? (
          <p>No matching powers are available in the current catalogue.</p>
        ) : null}
        {retained ? (
          <p>The existing selection is retained until you choose a replacement or remove it.</p>
        ) : null}
        <p>Changes stay local until you commit the discipline.</p>
      </div>
      <footer className={styles.dialogActions}>
        <button type="button" disabled={!current} onClick={() => onApply('')}>
          Remove association
        </button>
        <button
          type="button"
          disabled={
            !!selected &&
            selected !== current &&
            !available.some((choice) => choice.contentKey === selected)
          }
          onClick={() => onApply(selected)}
        >
          Apply selection
        </button>
      </footer>
    </dialog>
  )
}

export function DisciplineRelationshipList({
  value,
  choices,
  onChange,
  onEdit,
  disabled = false,
}: {
  value: AuthoredDiscipline
  choices: readonly ContentReference[]
  onChange(next: AuthoredDiscipline): void
  onEdit(contentKey: string): void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState<{ partner: string | null; label: string } | null>(null)
  const partners = new Map(
    choices
      .filter((choice) => choice.contentKind === 'discipline' && choice.contentKey !== value.id)
      .map((choice) => [choice.contentKey, choice.name]),
  )
  let retainedCount = 0
  for (const row of value.resonanceSelections ?? [])
    if (!partners.has(row.withDisciplineId))
      partners.set(row.withDisciplineId, `Retained Discipline ${++retainedCount}`)
  const rows = [
    { partner: null, label: 'None (Essence)', power: value.essenceId ?? '' },
    ...[...partners].map(([partner, label]) => ({
      partner,
      label,
      power:
        value.resonanceSelections?.find((row) => row.withDisciplineId === partner)?.resonanceId ??
        '',
    })),
  ]
  return (
    <>
      <div className={styles.list} aria-label="Discipline power associations">
        {rows.map((row) => (
          <div
            className={styles.row}
            key={row.partner === null ? 'none' : `partner:${row.partner}`}
          >
            <div className={styles.identity}>
              <strong>{row.label}</strong>
              <span>
                {row.power
                  ? (choices.find((choice) => choice.contentKey === row.power)?.name ??
                    'Retained power')
                  : 'No power selected'}
              </span>
            </div>
            <div className={styles.actions}>
              {row.power ? (
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Edit power for ${row.label}`}
                  onClick={() => onEdit(row.power)}
                >
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                disabled={disabled}
                aria-haspopup="dialog"
                aria-label={`${row.power ? 'Change' : 'Choose'} power for ${row.label}`}
                onClick={() => setEditing({ partner: row.partner, label: row.label })}
              >
                {row.power ? 'Change power' : 'Choose power'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {editing ? (
        <AssociationDialog
          value={value}
          choices={choices}
          partner={editing.partner}
          label={editing.label}
          onClose={() => setEditing(null)}
          onApply={(power) => {
            if (!disabled) onChange(withDisciplineRelationship(value, editing.partner, power))
            setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}
