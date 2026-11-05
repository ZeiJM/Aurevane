'use client'
import { DAMAGE_UP_TYPES, type DamageUpType } from '@aurevane/game-core/combat/combat-damage-up'
import styles from './combat-content-editor.module.css'

export function DamageUpTypeControls({
  value,
  onChange,
}: {
  value?: readonly DamageUpType[]
  onChange: (value: readonly DamageUpType[] | undefined) => void
}) {
  return (
    <fieldset className={styles.typedGrid}>
      <legend>Damage types</legend>
      <label className={styles.checkField}>
        <input
          type="checkbox"
          aria-label="Damage Up All Damage"
          checked={value === undefined}
          onChange={(event) => onChange(event.currentTarget.checked ? undefined : [])}
        />
        <span>All Damage</span>
      </label>
      {DAMAGE_UP_TYPES.map((type) => {
        const label = type[0]!.toUpperCase() + type.slice(1)
        return (
          <label key={type} className={styles.checkField}>
            <input
              type="checkbox"
              aria-label={`Damage Up ${label}`}
              checked={value?.includes(type) ?? false}
              onChange={(event) => {
                const selected = new Set(value ?? [])
                if (event.currentTarget.checked) selected.add(type)
                else selected.delete(type)
                onChange(DAMAGE_UP_TYPES.filter((entry) => selected.has(entry)))
              }}
            />
            <span>{label}</span>
          </label>
        )
      })}
    </fieldset>
  )
}
