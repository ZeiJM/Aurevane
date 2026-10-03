'use client'
import { useState, type FormEvent } from 'react'
import {
  COMBAT_EFFECT_TIMING_TAGS,
  combatEffectTimingMode,
  type CombatEffectTimingPolicy,
  type CombatEffectTimingMode,
} from '@aurevane/game-core/combat/combat-effect-timing'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import styles from './combat-effect-timing-editor.module.css'

function timingLabel(tag: string): string {
  const names: Record<string, string> = {
    damage: 'Direct damage',
    healing: 'HP recovery',
    'mp-recovery': 'MP recovery',
    'mp-drain': 'MP drain',
    'create-terrain': 'Terrain',
    displace: 'Displacement',
    'barrier-change': 'Barrier',
    'return-to-turn-start': 'Return to turn start',
    'remove-status': 'Cleanse / remove status',
    'copy-statuses': 'Amplify / Curse copy',
    copy: 'Skill copy',
    sensory: 'Sensory',
    summon: 'Summon',
  }
  return names[tag] ?? combatStatusDetails(tag).name
}
export function CombatEffectTimingEditor({
  initialPolicy,
}: {
  initialPolicy: CombatEffectTimingPolicy
}) {
  const [policy, setPolicy] = useState(initialPolicy)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/master/combat-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy, reason }),
      })
      const body = (await response.json()) as {
        policy?: CombatEffectTimingPolicy
        error?: { message?: string }
      }
      if (!response.ok || !body.policy)
        throw new Error(body.error?.message ?? 'Timing policy could not be published.')
      setPolicy(body.policy)
      setReason('')
      setMessage(`Published timing policy v${body.policy.version}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Timing policy could not be published.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className={styles.editor} onSubmit={publish}>
      <h2>Effect timing policy v{policy.version}</h2>
      <p>
        Delayed effects appear immediately as pending and activate at the start of the next global
        round. Active durations count the affected character’s completed turns. Existing battles
        keep their pinned policy.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Effect tag</th>
            <th scope="col">Timing</th>
          </tr>
        </thead>
        <tbody>
          {COMBAT_EFFECT_TIMING_TAGS.map((tag) => (
            <tr key={tag}>
              <th scope="row">
                <label htmlFor={`timing-${tag}`}>{timingLabel(tag)}</label>
              </th>
              <td>
                <select
                  id={`timing-${tag}`}
                  value={combatEffectTimingMode(policy, tag)}
                  disabled={saving}
                  onChange={(event) =>
                    setPolicy({
                      ...policy,
                      modes: {
                        ...policy.modes,
                        [tag]: event.target.value as CombatEffectTimingMode,
                      },
                    })
                  }
                >
                  <option value="instant">Instant</option>
                  <option value="next-round">Next global round</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label>
        Reason for this change
        <textarea
          required
          maxLength={240}
          value={reason}
          disabled={saving}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <button type="submit" disabled={saving || reason.trim().length === 0}>
        {saving ? 'Publishing…' : 'Publish timing policy'}
      </button>
      <p role="status">{message}</p>
    </form>
  )
}
