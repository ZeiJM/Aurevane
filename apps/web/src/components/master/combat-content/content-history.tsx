'use client'
import { useState } from 'react'
import type { CompleteCombatContentRecord } from '@aurevane/db/combat-content'
import type { ContentReference } from './content-definition-fields'
import { readableContentReference, settingLabel } from './content-reference-label'
import styles from './game-content-workspace.module.css'

function Settings({
  value,
  choices,
  field = '',
}: {
  value: unknown
  choices: readonly ContentReference[]
  field?: string
}) {
  if (value === null || value === undefined) return <span>None</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (typeof value === 'number')
    return <span>{field.endsWith('BasisPoints') ? `${value / 100}%` : value}</span>
  if (typeof value === 'string')
    return (
      <span>{/Id$/.test(field) ? readableContentReference(value, choices) : value || 'None'}</span>
    )
  if (Array.isArray(value))
    return value.length ? (
      <ol>
        {value.map((entry, index) => (
          <li key={index}>
            <Settings value={entry} choices={choices} />
          </li>
        ))}
      </ol>
    ) : (
      <span>None</span>
    )
  return (
    <dl className={styles.settings}>
      {Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !['id', 'schemaVersion', 'contentVersion', 'essenceId'].includes(key))
        .map(([key, entry]) => (
          <div key={key}>
            <dt>{settingLabel(key)}</dt>
            <dd>
              <Settings value={entry} choices={choices} field={key} />
            </dd>
          </div>
        ))}
    </dl>
  )
}
function Snapshot({
  label,
  definition,
  choices,
}: {
  label: string
  definition: Record<string, unknown>
  choices: readonly ContentReference[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{label} settings</summary>
      {open ? <Settings value={definition} choices={choices} /> : null}
    </details>
  )
}
export function ContentHistory({
  record,
  busy,
  readOnly,
  dirty,
  choices,
  onRestore,
}: {
  record: CompleteCombatContentRecord
  busy: boolean
  readOnly: boolean
  dirty: boolean
  choices: readonly ContentReference[]
  onRestore(version: number, source?: 'builtin'): void
}) {
  const previous = record.history
    .filter((row) => row.contentVersion !== record.current?.contentVersion)
    .toSorted((a, b) => b.contentVersion - a.contentVersion)[0]
  return (
    <section aria-label="Content history" className={styles.history}>
      <h3>Current and Previous</h3>
      {record.current ? (
        <article>
          <h4>Current</h4>
          <p>{String(record.current.definition.name ?? '')}</p>
          <Snapshot label="Current" definition={record.current.definition} choices={choices} />
        </article>
      ) : null}
      {previous ? (
        <article>
          <h4>Previous</h4>
          <p>{String(previous.definition.name ?? '')}</p>
          <Snapshot label="Previous" definition={previous.definition} choices={choices} />
          <button
            type="button"
            disabled={busy || dirty || readOnly}
            onClick={() => onRestore(previous.contentVersion)}
          >
            Restore Previous
          </button>
        </article>
      ) : (
        <p>No previous saved settings.</p>
      )}
      {record.builtinRestoreVersion ? (
        <details>
          <summary>System original</summary>
          <button
            type="button"
            disabled={busy || dirty || readOnly}
            onClick={() => onRestore(record.builtinRestoreVersion!, 'builtin')}
          >
            Restore System original
          </button>
        </details>
      ) : null}
    </section>
  )
}
