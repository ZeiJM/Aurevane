'use client'
import { MasterHelp } from '../master-help'
import { useId, useState } from 'react'
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
  additionalIssue,
}: {
  label?: string
  addLabel?: string
  disabled?: boolean
  nativeOnly?: boolean
  combination?: { activation: AbilityActivation; mode: AbilityMode }
  context?: EffectAuthoringContext
  additionalIssue?: (id: string) => string | undefined
  onAdd(payload: CombatTagPayload): void
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [requested, setRequested] = useState('damage')
  const choices = AUTHORABLE_EFFECT_TAGS.filter((tag) =>
    `${tag.label} ${tag.id}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).sort((a, b) => a.label.localeCompare(b.label, 'en'))
  const selected =
    choices.find((tag) => tag.id === requested) ??
    choices.find((tag) => !issue(tag.id)) ??
    choices[0]
  function issue(id: string) {
    const tag = AUTHORABLE_EFFECT_TAGS.find((tag) => tag.id === id)
    if (nativeOnly && tag && ['move', 'summon', 'damage-bonus'].includes(tag.opcode))
      return 'Available in modular abilities.'
    return effectAuthoringIssue(id, combination, context) ?? additionalIssue?.(id)
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
      <div className={styles.field}>
        <div className={styles.fieldLabel}>
          <label htmlFor={id}>{label}</label>
          {selected ? (
            <MasterHelp label={selected.label}>
              <p>{combatTagDefinition(selected.opcode)?.fullExplanation}</p>
            </MasterHelp>
          ) : null}
        </div>
        <select
          id={id}
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
      </div>
      <button
        type="button"
        disabled={disabled || !!reason || !selected}
        onClick={() => {
          if (!selected || disabled || reason) return
          const payload = createAuthorableEffectPayload(selected.id, { ...context, combination })
          if (payload) onAdd(payload)
        }}
      >
        {addLabel}
      </button>
      {reason ? <small className={styles.fieldHint}>{reason}</small> : null}
    </div>
  )
}
