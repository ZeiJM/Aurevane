'use client'

import {
  battleTextReferenceChoices,
  battleTextContextIssues,
  type BattleTextReferenceContext,
  renderBattleFlavorTemplate,
  type BattleNarratorIdentity,
} from '@aurevane/game-core/combat/battle-narration'
import { PRONOUN_PRESETS, type PronounPresetId } from '@aurevane/game-core/character/creation'
import { useState } from 'react'

import styles from './combat-content-editor.module.css'

export function BattleFlavorTemplateHelp({
  value,
  ability,
  onChange,
  context = { field: 'activation' },
}: {
  readonly context?: BattleTextReferenceContext
  readonly value: string
  readonly ability: string
  readonly onChange: (value: string) => void
}) {
  const [actor, setActor] = useState<BattleNarratorIdentity>({ name: 'Asha' })
  const [target, setTarget] = useState<BattleNarratorIdentity>({ name: 'Bryn' })
  const [plural, setPlural] = useState(false)
  const issues = value.trim() ? battleTextContextIssues(value, context) : []
  const sample = {
    actor,
    target,
    ability,
    values: context.values,
    ...(context.affectedTargets
      ? { affectedTargets: plural ? [target, { name: 'Cora' }] : [target] }
      : {}),
    ...(context.triggeringActor ? { triggeringActor: { name: 'Dara' } } : {}),
    ...(context.field === 'result'
      ? {
          outcomes: Object.fromEntries(
            (context.outcomes ?? []).map((key) => [key, key === 'damage' ? 37 : 20]),
          ),
        }
      : {}),
  }
  const fallback = `${actor.name || 'Combatant'} calls on ${ability}.`
  return (
    <details>
      <summary>References and writing preview</summary>
      <p className={styles.fieldHint}>
        One or two short story sentences, up to 160 characters. Names and pronouns use explicit
        identity only; missing historical identity stays neutral. Gender alternatives use masculine
        | feminine | neutral wording. Quantities come from recorded battle results. Presentation
        never controls mechanics and does not verify arbitrary English. Example: insert User, write
        “uses”, then insert Ability. Results and triggering actors appear only in supported
        contexts.
      </p>
      <label className={styles.field}>
        <span>Insert Reference</span>
        <select
          aria-label="Battle narration tokens"
          value=""
          onChange={(event) => {
            const token = event.currentTarget.value
            if (!token) return
            const next = `${value}${value && !value.endsWith(' ') ? ' ' : ''}${token}`
            if (next.length <= 160) onChange(next)
          }}
        >
          <option value="">Choose a reference</option>
          {battleTextReferenceChoices(context).map(({ token, label }) => (
            <option key={token} value={`{${token}}`}>
              {label}
            </option>
          ))}
          <option value="{actor.gender:he|she|they}">{'{actor.gender:he|she|they}'}</option>
          <option value="{target.gender:he|she|they}">{'{target.gender:he|she|they}'}</option>
        </select>
      </label>
      {context.affectedTargets && (
        <label className={styles.field}>
          <span>Affected Targets sample</span>
          <select
            aria-label="Affected Targets sample"
            value={plural ? 'plural' : 'singular'}
            onChange={(event) => setPlural(event.currentTarget.value === 'plural')}
          >
            <option value="singular">One target</option>
            <option value="plural">Multiple targets</option>
          </select>
        </label>
      )}
      <div className={styles.typedGrid}>
        {(
          [
            { role: 'Actor', identity: actor, update: setActor },
            { role: 'Target', identity: target, update: setTarget },
          ] as const
        ).map(({ role, identity, update }) => (
          <div key={role}>
            <label className={styles.field}>
              <span>{role} sample name</span>
              <input
                aria-label={`${role} narration sample name`}
                maxLength={48}
                value={identity.name ?? ''}
                onChange={(event) => update({ ...identity, name: event.currentTarget.value })}
              />
            </label>
            <label className={styles.field}>
              <span>{role} sample pronouns</span>
              <select
                aria-label={`${role} narration sample pronouns`}
                value={identity.pronounPresetId ?? 'they_them'}
                onChange={(event) =>
                  update({
                    ...identity,
                    pronounPresetId: event.currentTarget.value as PronounPresetId,
                  })
                }
              >
                {PRONOUN_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>{role} sample gender wording</span>
              <select
                aria-label={`${role} narration sample gender`}
                value={identity.gender ?? 'neutral'}
                onChange={(event) =>
                  update({
                    ...identity,
                    gender: event.currentTarget.value as BattleNarratorIdentity['gender'],
                  })
                }
              >
                <option value="neutral">Neutral / unavailable</option>
                <option value="masculine">Masculine</option>
                <option value="feminine">Feminine</option>
              </select>
            </label>
          </div>
        ))}
      </div>
      {issues.length > 0 && (
        <ul aria-label="Battle narration validation">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <p aria-label="Battle narration sample">
        {renderBattleFlavorTemplate(value, sample) ?? fallback}
      </p>
      <p aria-label="Neutral historical narration preview">
        {renderBattleFlavorTemplate(value, { ability }) ?? `Combatant calls on ${ability}.`}
      </p>
    </details>
  )
}
