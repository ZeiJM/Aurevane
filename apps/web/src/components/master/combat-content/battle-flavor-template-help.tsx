'use client'

import {
  ABILITY_PRESENTATION_TEXT_LIMITS,
  battleTextReferenceChoices,
  battleTextReferenceTag,
  battleTextContextIssues,
  type BattleTextReferenceContext,
  renderBattleFlavorTemplate,
} from '@aurevane/game-core/combat/battle-narration'
import { MasterHelp } from '../master-help'
import styles from './combat-content-editor.module.css'

export function BattleFlavorTemplateHelp({
  value,
  ability,
  onChange,
  context = { field: 'activation' },
  label = 'Writing tags',
}: {
  readonly context?: BattleTextReferenceContext
  readonly value: string
  readonly ability: string
  readonly onChange: (value: string) => void
  readonly label?: string
}) {
  const maximum = ABILITY_PRESENTATION_TEXT_LIMITS[context.field]
  const issues = value.trim() ? battleTextContextIssues(value, context, maximum) : []
  const sample = {
    actor: { name: 'Asha' },
    target: { name: 'Bryn' },
    ability,
    values: context.values,
    ...(context.affectedTargets ? { affectedTargets: [{ name: 'Bryn' }] } : {}),
    ...(context.triggeringActor ? { triggeringActor: { name: 'Dara' } } : {}),
    ...(context.field === 'result'
      ? {
          outcomes: Object.fromEntries(
            (context.outcomes ?? []).map((key) => [key, key === 'damage' ? 37 : 20]),
          ),
        }
      : {}),
  }
  return (
    <>
      <MasterHelp label={label}>
        <p>
          Use these tags in your text. Character names and pronouns come from the battle; missing
          identity uses neutral wording. Existing brace tags still work. Only listed tags are
          replaced; ordinary parentheses stay as text.
        </p>
        <ul>
          <li>
            <code>(name)</code> — the user’s name; <code>(target)</code> — the selected target’s
            name.
          </li>
          <li>
            <code>(skill)</code> or <code>(ability)</code> — the ability’s name.
          </li>
          <li>
            <code>(subject)</code> — he, she or they; <code>(object)</code> — him, her or them.
          </li>
          <li>
            <code>(possessive)</code> — his, her or their; <code>(reflexive)</code> — himself,
            herself or themself.
          </li>
          <li>
            Use <code>(target.subject)</code>, <code>(target.object)</code>,{' '}
            <code>(target.possessive)</code> or <code>(target.reflexive)</code> for the target’s
            pronouns.
          </li>
          <li>
            <code>(gender:he|she|they)</code> chooses masculine, feminine or neutral wording from
            explicit identity. Replace the three words as needed;{' '}
            <code>(target.gender:he|she|they)</code> uses the target’s identity.
          </li>
        </ul>
        <p>Up to {maximum} characters. Available references for this field:</p>
        <label className={styles.field}>
          <span>Insert tag</span>
          <select
            aria-label="Battle narration tokens"
            value=""
            onChange={(event) => {
              const token = event.currentTarget.value
              if (!token) return
              const next = `${value}${value && !value.endsWith(' ') ? ' ' : ''}${token}`
              if (next.length <= maximum) onChange(next)
            }}
          >
            <option value="">Choose a tag</option>
            {battleTextReferenceChoices(context).map(({ token, label: referenceLabel }) => (
              <option key={token} value={battleTextReferenceTag(token)}>
                {battleTextReferenceTag(token)} — {referenceLabel}
              </option>
            ))}
            <option value="(gender:he|she|they)">(gender:he|she|they)</option>
            <option value="(target.gender:he|she|they)">(target.gender:he|she|they)</option>
          </select>
        </label>
        <p aria-label="Battle narration sample">
          {renderBattleFlavorTemplate(value, sample, maximum) ?? `Asha calls on ${ability}.`}
        </p>
        <p>
          Amounts require the listed effect value or recorded result. Text does not change what the
          ability does.
        </p>
      </MasterHelp>
      {issues.length > 0 && (
        <ul aria-label="Battle narration validation">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </>
  )
}
