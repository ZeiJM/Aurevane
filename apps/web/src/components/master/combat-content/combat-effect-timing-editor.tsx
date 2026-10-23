'use client'
import type { CombatTagPresentationSnapshot } from '@aurevane/game-core/combat/combat-tag-registry'
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
  usedBy = {},
  tagPresentations = [],
}: {
  initialPolicy: CombatEffectTimingPolicy
  usedBy?: Readonly<Record<string, readonly { contentKey: string; name: string }[]>>
  tagPresentations?: readonly CombatTagPresentationSnapshot[]
}) {
  const [policy, setPolicy] = useState(initialPolicy)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('name-asc')
  const label = (tag: string) =>
    tagPresentations.find((row) => row.tagId === tag)?.name ?? timingLabel(tag)
  const timingOrder = ['instant', 'next-round', 'delayed', 'controlled']
  const rows = COMBAT_EFFECT_TIMING_TAGS.filter((tag) => tag !== 'displace' && tag !== 'displaced')
    .filter(
      (tag) =>
        `${label(tag)} ${tag}`.toLowerCase().includes(search.toLowerCase()) &&
        (filter === 'all' || combatEffectTimingMode(policy, tag) === filter),
    )
    .toSorted((a, b) => {
      const order = sort.startsWith('timing')
        ? timingOrder.indexOf(combatEffectTimingMode(policy, a)) -
          timingOrder.indexOf(combatEffectTimingMode(policy, b))
        : label(a).localeCompare(label(b))
      return (order || label(a).localeCompare(label(b))) * (sort.endsWith('desc') ? -1 : 1)
    })
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
        throw new Error(body.error?.message ?? 'Timing changes could not be saved.')
      setPolicy(body.policy)
      setMessage('Timing updated.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Timing changes could not be saved.')
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
        later release. The selected timing applies to every current Skill using that tag. Existing
        battles retain their saved rules.
      </p>
      <div className={styles.controls}>
        <label>
          Search effect tags
          <input value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
        </label>
        <label>
          Filter timing
          <select value={filter} onChange={(event) => setFilter(event.currentTarget.value)}>
            <option value="all">All timings</option>
            {timingOrder.map((value, index) => (
              <option key={value} value={value}>
                {['Instant', 'Normal', 'Delayed', 'Controlled'][index]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort effect tags
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value)}>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="timing-asc">Timing first–last</option>
            <option value="timing-desc">Timing last–first</option>
          </select>
        </label>
      </div>
      <p>
        Display order: Instant, Normal, Delayed, Controlled. Sorting does not change execution
        order. Used by reflects the loaded catalogue; Save Changes checks current compatibility
        again.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Effect tag</th>
            <th scope="col">Timing</th>
            <th scope="col">Used by</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tag) => (
            <tr key={tag}>
              <th scope="row">
                <label htmlFor={`timing-${tag}`}>{label(tag)}</label>
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
              <td>
                {usedBy[tag]?.length ? (
                  <details>
                    <summary>{usedBy[tag]!.length} current definitions</summary>
                    <ul>
                      {usedBy[tag]!.map((row) => (
                        <li key={row.contentKey}>
                          {row.name} <small>({row.contentKey})</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  'No current definitions'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Controlled requires a compatible Manual action. Summon and persistent Ground need dedicated
        release targeting before they can use Controlled.
      </p>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
      <p role="status">{message}</p>
    </form>
  )
}
