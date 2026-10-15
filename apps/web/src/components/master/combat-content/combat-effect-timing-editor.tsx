'use client'
import { useState, type FormEvent } from 'react'
import {
  COMBAT_EFFECT_TIMING_TAGS,
  CONTROLLED_COMBAT_TIMING_TAGS,
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
    push: 'Push',
    pull: 'Pull',
    'barrier-change': 'Barrier',
    'return-to-turn-start': 'Rewind',
    'remove-status': 'Cleanse / remove status',
    'copy-statuses': 'Amplify / Curse copy',
    copy: 'Skill copy',
    sensory: 'Reveal',
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
        body: JSON.stringify({ policy }),
      })
      const body = (await response.json()) as {
        policy?: CombatEffectTimingPolicy
        error?: { message?: string }
      }
      if (!response.ok || !body.policy)
        throw new Error(body.error?.message ?? 'Timing policy could not be published.')
      setPolicy(body.policy)
      setMessage('Timing updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Timing policy could not be published.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form className={styles.editor} onSubmit={publish}>
      <h2>Effect timing</h2>
      <p>
        Normal effects activate at the next global round; Delayed effects activate one round later.
        Instant effects apply immediately. Controlled primes a compatible whole Manual action for a
        later legal release. Existing battles keep their pinned policy. Explicit per-effect timing
        overrides these defaults.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Effect tag</th>
            <th scope="col">Timing</th>
          </tr>
        </thead>
        <tbody>
          {COMBAT_EFFECT_TIMING_TAGS.filter((tag) => tag !== 'displace' && tag !== 'displaced').map(
            (tag) => (
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
                    <option value="next-round">Normal</option>
                    <option value="delayed">Delayed</option>
                    <option
                      value="controlled"
                      disabled={!CONTROLLED_COMBAT_TIMING_TAGS.includes(tag)}
                    >
                      Controlled
                    </option>
                  </select>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <p>
        Controlled requires a compatible Manual action. Summon and persistent Ground need dedicated
        release targeting before they can use Controlled.
      </p>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save timing'}
      </button>
      <p role="status">{message}</p>
    </form>
  )
}
