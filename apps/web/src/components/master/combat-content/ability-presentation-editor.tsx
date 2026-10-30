'use client'
import {
  ABILITY_PRESENTATION_TEXT_LIMITS,
  abilityPresentationContext,
  type AbilityPresentationText,
  type BattleTextField,
} from '@aurevane/game-core/combat/battle-narration'
import { BattleFlavorTemplateHelp } from './battle-flavor-template-help'
import styles from './combat-content-editor.module.css'
import layout from './game-content-workspace.module.css'
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
  const locations = {
    public: 'Shown in the full ability details.',
    compact: 'Shown in the compact battle details.',
    activation: 'Shown in the battle log when this ability is used.',
    result: 'Shown in the battle log after the result is known.',
  }
  return (
    <fieldset className={layout.descriptionFields}>
      <legend>Contextual text</legend>
      <p className={styles.fieldHint}>
        Optional text for each in-game location. Leave a field blank to keep its usual wording.
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
          <div key={field} className={layout.writingField}>
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
              label={`${label} tags`}
              value={value?.[field] ?? ''}
              ability={name}
              context={abilityPresentationContext(definition, field)}
              onChange={change}
            />
            <small>{locations[field]}</small>
          </div>
        )
      })}
    </fieldset>
  )
}
