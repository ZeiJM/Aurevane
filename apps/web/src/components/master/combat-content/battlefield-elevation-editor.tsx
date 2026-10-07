'use client'
import { useState, type FormEvent } from 'react'
import {
  parseBattlefieldElevationPolicy,
  type BattlefieldElevationPolicy,
} from '@aurevane/game-core/combat/standard-battlefield'
import styles from './battlefield-elevation-editor.module.css'

const fields = ['level1BasisPoints', 'level2BasisPoints', 'level3BasisPoints'] as const
export function BattlefieldElevationEditor({
  initialPolicy,
}: {
  initialPolicy: BattlefieldElevationPolicy
}) {
  const [version, setVersion] = useState(initialPolicy.version)
  const [chances, setChances] = useState(fields.map((key) => String(initialPolicy[key] / 100)))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const bps = chances.map((value) =>
    /^\d{1,3}(?:\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : NaN,
  )
  let policy: BattlefieldElevationPolicy | null = null
  try {
    policy = parseBattlefieldElevationPolicy({
      version,
      level1BasisPoints: bps[0],
      level2BasisPoints: bps[1],
      level3BasisPoints: bps[2],
    })
  } catch {}
  const total = bps.reduce((sum, value) => sum + value, 0)
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!policy || saving) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/master/combat-elevation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy, reason }),
      })
      const body = (await response.json()) as {
        policy?: BattlefieldElevationPolicy
        error?: { message?: string }
      }
      if (!response.ok || !body.policy)
        throw new Error(body.error?.message ?? 'Elevation chances could not be published.')
      const published = parseBattlefieldElevationPolicy(body.policy)
      setVersion(published.version)
      setChances(fields.map((key) => String(published[key] / 100)))
      setReason('')
      setMessage(`Published elevation policy v${published.version}. New battles use these chances.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Elevation chances could not be published.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className={styles.editor} onSubmit={publish} aria-label="Elevation chances">
      <h2>Elevation chances v{version}</h2>
      <p>
        Each raised tile independently rolls level 1, 2 or 3 using these chances. Changes apply to
        new battles. Existing battles keep their tiles.
      </p>
      {fields.map((field, index) => (
        <label key={field}>
          Elevation level {index + 1} chance (%)
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            value={chances[index]}
            disabled={saving}
            onChange={(event) =>
              setChances(chances.map((value, i) => (i === index ? event.target.value : value)))
            }
          />
        </label>
      ))}
      <p>
        Total: {Number.isFinite(total) ? `${total / 100}%` : 'Invalid'}
        {!policy ? ' — enter chances totaling exactly 100%.' : ''}
      </p>
      <label>
        Elevation change reason
        <textarea
          required
          maxLength={240}
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button type="submit" disabled={saving || !policy || reason.trim().length === 0}>
        {saving ? 'Publishing…' : 'Publish elevation chances'}
      </button>
      <p role="status">{message}</p>
    </form>
  )
}
