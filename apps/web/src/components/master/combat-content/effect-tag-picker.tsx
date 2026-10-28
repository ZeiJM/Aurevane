'use client'
import { useState } from 'react'
import {
  AUTHORABLE_EFFECT_TAGS,
  createAuthorableEffectPayload,
  effectAuthoringIssue,
  type EffectAuthoringContext,
} from '@aurevane/game-core/combat/combat-effect-authoring'
import type { AbilityActivation, AbilityMode } from '@aurevane/game-core/combat/combat-definition'
import {
  combatTagDefinition,
  type CombatTagPayload,
} from '@aurevane/game-core/combat/combat-tag-registry'
import styles from './combat-content-editor.module.css'

export function EffectTagPicker({
  label = 'New effect type',
  addLabel = 'Add effect',
  disabled = false,
  nativeOnly = false,
  combination = { activation: 'manual', mode: 'action' },
  context,
  onAdd,
}: {
  label?: string
  addLabel?: string
  disabled?: boolean
  nativeOnly?: boolean
  combination?: { activation: AbilityActivation; mode: AbilityMode }
  context?: EffectAuthoringContext
  onAdd(payload: CombatTagPayload): void
}) {
  const [query, setQuery] = useState('')
  const [requested, setRequested] = useState('damage')
  const choices = AUTHORABLE_EFFECT_TAGS.filter((tag) =>
    `${tag.label} ${tag.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const selected =
    choices.find((tag) => tag.id === requested) ??
    choices.find((tag) => !issue(tag.id)) ??
    choices[0]
  function issue(id: string) {
    const tag = AUTHORABLE_EFFECT_TAGS.find((tag) => tag.id === id)
    if (nativeOnly && tag && ['move', 'summon', 'damage-bonus'].includes(tag.opcode))
      return 'Available in modular abilities.'
    return effectAuthoringIssue(id, combination, context)
  }
  const reason = selected ? issue(selected.id) : 'No matching tags.'
  return (
    <div className={styles.effectPicker}>
      <label className={styles.field}>
        <span>Search effect tags</span>
        <input
          type="search"
          aria-label="Search effect tags"
          value={query}
          placeholder="Search tags…"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>
      <label className={styles.field}>
        <span>{label}</span>
        <select
          aria-label={label}
          value={selected?.id ?? ''}
          onChange={(event) => setRequested(event.currentTarget.value)}
        >
          {!choices.length && <option value="">No matching tags</option>}
          {choices.map((tag) => {
            const reason = issue(tag.id)
            return (
              <option key={tag.id} value={tag.id} disabled={!!reason}>
                {tag.label}
                {reason ? ` — ${reason}` : ''}
              </option>
            )
          })}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled || !!reason || !selected}
        onClick={() => {
          if (!selected || disabled || reason) return
          const payload = createAuthorableEffectPayload(selected.id, context)
          if (payload) onAdd(payload)
        }}
      >
        {addLabel}
      </button>
      <small className={styles.fieldHint}>
        {reason ?? (selected ? combatTagDefinition(selected.opcode)?.conciseExplanation : '')}
      </small>
    </div>
  )
}
