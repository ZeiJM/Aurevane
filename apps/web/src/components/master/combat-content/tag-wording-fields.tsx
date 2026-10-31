'use client'
import { useId } from 'react'
import type { CombatContentDefinition } from '@aurevane/db/combat-content'
import styles from './combat-content-editor.module.css'
import layout from './tag-wording-fields.module.css'
import { tagWordingDefaults } from './tag-wording-defaults'

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
  const defaults = tagWordingDefaults(String(value.tagId ?? ''))
  return (
    <div className={layout.editor}>
      <section className={layout.section}>
        <label className={styles.field}>
          <span>Skill Manager description</span>
          <textarea
            aria-label="Skill Manager description"
            aria-describedby={`${hintId}-full ${hintId}-tokens`}
            rows={5}
            maxLength={2000}
            placeholder="Standard description using each effect’s own parameters"
            value={full === '{details}' ? defaults.full : full}
            onChange={(event) =>
              onChange({
                ...value,
                enabled: true,
                explanation: event.currentTarget.value || '{details}',
              })
            }
          />
          <small id={`${hintId}-full`} className={styles.fieldHint}>
            Shown below Effects in full ability details.
          </small>
        </label>
      </section>
      <section className={layout.section}>
        <label className={styles.field}>
          <span>Battle description</span>
          <textarea
            aria-label="Battle description"
            aria-describedby={`${hintId}-short ${hintId}-tokens`}
            rows={2}
            maxLength={240}
            aria-invalid={(short !== '{summary}' && short.length > 240) || undefined}
            placeholder="Standard short description"
            value={short === '{summary}' ? defaults.short : short}
            onChange={(event) =>
              onChange({
                ...value,
                enabled: true,
                description: event.currentTarget.value || '{summary}',
              })
            }
          />
          <small id={`${hintId}-short`} className={styles.fieldHint}>
            Shown when inspecting or hovering this tag in battle. Custom text:{' '}
            {short === '{summary}' ? 0 : short.length}/240 characters.
            {short === '{summary}' && defaults.short.length > 240
              ? ' The automatic example is longer; select and replace or shorten it to customize.'
              : ''}
            {short !== '{summary}' && short.length > 240
              ? ' Shorten this description before saving.'
              : ''}
          </small>
        </label>
      </section>
      <button
        type="button"
        className={layout.reset}
        onClick={() => onChange({ ...value, explanation: '{details}', description: '{summary}' })}
      >
        Restore automatic descriptions
      </button>
      <p id={`${hintId}-tokens`} className={styles.fieldHint}>
        Automatic wording describes the tag’s rule; each Skill shows its saved values in game.
        Opening this editor does not replace that automatic wording. Leave blank to use the standard
        description. Use {'{details}'} in the full description or {'{summary}'} in either field to
        keep the generated, parameter-aware wording.
      </p>
    </div>
  )
}
