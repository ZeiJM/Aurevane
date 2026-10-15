'use client'

import styles from './combat-content-editor.module.css'

export function AbilitySelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
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
            {option || 'Any'}
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
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.currentTarget.value)
          if (Number.isFinite(next)) onChange(next)
        }}
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
