'use client'
import {
  ABILITY_PRESENTATION_TEXT_LIMITS,
  abilityPresentationContext,
  type AbilityPresentationText,
  type BattleTextField,
} from '@aurevane/game-core/combat/battle-narration'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import styles from './combat-content-editor.module.css'
export function AbilityPresentationEditor({
  definition,
  name,
  value,
  onChange,
}: {
  definition: unknown
  name: string
  value?: AbilityPresentationText
  onChange(value: AbilityPresentationText): void
}) {
  const labels = {
    public: 'Full public description',
    compact: 'Compact battle description',
    activation: 'Activation message',
    result: 'Recorded result message',
  }
  return (
    <fieldset>
      <legend>Contextual text</legend>
      <p className={styles.fieldHint}>
        Optional wording uses the exact saved definition. Empty fields retain existing descriptions.
        Result messages require a recorded result; they are never used as activation messages.
        Samples are illustrative.
      </p>
      {Object.entries(labels).map(([key, label]) => {
        const field = key as BattleTextField
        const change = (text: string) => {
          const next = { ...value }
          if (text.trim()) next[field] = text
          else delete next[field]
          onChange(next)
        }
        return (
          <div key={field}>
            <label className={styles.field}>
              <span>{label}</span>
              <textarea
                aria-label={label}
                value={value?.[field] ?? ''}
                maxLength={ABILITY_PRESENTATION_TEXT_LIMITS[field]}
                onChange={(event) => change(event.currentTarget.value)}
              />
            </label>
            <BattleFlavorTemplateHelp
              value={value?.[field] ?? ''}
              ability={name}
              context={abilityPresentationContext(definition, field)}
              onChange={change}
            />
          </div>
        )
      })}
    </fieldset>
  )
}
