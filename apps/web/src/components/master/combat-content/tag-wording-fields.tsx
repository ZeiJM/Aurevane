'use client'
import { useId } from 'react'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import styles from './combat-content-editor.module.css'

export function TagWordingFields({
  value,
  onChange,
}: {
  value: CombatContentDefinition
  onChange(value: CombatContentDefinition): void
}) {
  const hintId = useId()
  const full = typeof value.explanation === 'string' ? value.explanation : '{details}'
  const short = typeof value.description === 'string' ? value.description : '{summary}'
  return (
    <div className={styles.effectEditor}>
      <label className={styles.field}>
        <span>Skill Manager description</span>
        <textarea
          aria-label="Skill Manager description"
          aria-describedby={`${hintId}-full ${hintId}-tokens`}
          rows={5}
          maxLength={2000}
          placeholder="Standard description using each effect’s own parameters"
          value={full === '{details}' ? '' : full}
          onChange={(event) =>
            onChange({
              ...value,
              enabled: true,
              explanation: event.currentTarget.value || '{details}',
            })
          }
        />
        <small id={`${hintId}-full`} className={styles.fieldHint}>
          Shown below Effects in full ability details and the Master preview.
        </small>
      </label>
      <label className={styles.field}>
        <span>Battle description</span>
        <textarea
          aria-label="Battle description"
          aria-describedby={`${hintId}-short ${hintId}-tokens`}
          rows={2}
          maxLength={240}
          placeholder="Standard short description"
          value={short === '{summary}' ? '' : short}
          onChange={(event) =>
            onChange({
              ...value,
              enabled: true,
              description: event.currentTarget.value || '{summary}',
            })
          }
        />
        <small id={`${hintId}-short`} className={styles.fieldHint}>
          Shown when inspecting or hovering this tag in battle.
        </small>
      </label>
      <p id={`${hintId}-tokens`} className={styles.fieldHint}>
        Leave blank to use the standard description. Use {'{details}'} in the full description or{' '}
        {'{summary}'} in either field to keep the generated, parameter-aware wording.
      </p>
    </div>
  )
}
