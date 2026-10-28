'use client'

import { useState } from 'react'
import styles from './combat-content-editor.module.css'

export function AbilitySelect<T extends string>({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  optionLabels?: Readonly<Partial<Record<T, string>>>
  onChange: (value: T) => void
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {!options.includes(value) ? <option value={value}>{value} (incompatible)</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? (option || 'Any')}
          </option>
        ))}
      </select>
    </label>
  )
}

export function AbilityNumber({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  invalid,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  invalid?: boolean
}) {
  const [entry, setEntry] = useState<{ text: string; value: number } | null>(null)
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        aria-label={label}
        aria-invalid={invalid}
        type="number"
        min={min}
        max={max}
        step={step}
        value={entry?.value === value ? entry.text : value}
        onChange={(event) => {
          const text = event.currentTarget.value
          if (text === '') {
            setEntry({ text, value })
            return
          }
          const next = Number(text)
          if (Number.isFinite(next)) {
            setEntry({ text, value: next })
            onChange(next)
          }
        }}
        onBlur={() => setEntry(null)}
      />
    </label>
  )
}

export function AbilityText({
  label,
  value,
  onChange,
  maxLength = 96,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        aria-label={label}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}
