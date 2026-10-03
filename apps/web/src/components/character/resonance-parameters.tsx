import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { CompactSkillEffectSummary } from './compact-skill-effect-summary'
import {
  resonanceCharacteristicRows,
  resonanceResultRecipient,
  resonanceSupplementalRows,
} from './resonance-detail-presentation'
import { SkillCharacteristicRows } from './skill-characteristic-rows'
import styles from './resonance-parameters.module.css'

/** One Skill-style report for current, draft and battle-pinned Resonance definitions. */
export function ResonanceParameters({
  definition,
  className,
}: {
  definition: AnyResonanceDefinition | null | undefined
  className?: string
}) {
  const effects = definition ? normalizedResonanceMechanics(definition).resultEffects : []
  const supplemental = resonanceSupplementalRows(definition)
  const targeting = supplemental.find(([label]) => label === 'Trigger targeting')?.[1]
  const explanations = supplemental.find(([label]) => label === 'Result details')?.[1]
  return (
    <div
      className={[styles.report, className].filter(Boolean).join(' ')}
      data-resonance-parameters="true"
    >
      <strong>Parameters</strong>
      <dl>
        <SkillCharacteristicRows
          rows={resonanceCharacteristicRows(definition)}
          effectSummary={
            definition
              ? effects.length
                ? effects.map((effect, index) => (
                    <div className={styles.effectRow} key={index}>
                      <CompactSkillEffectSummary effect={effect} />
                      {' → '}
                      {resonanceResultRecipient(effect)}
                    </div>
                  ))
                : 'N/A'
              : undefined
          }
        />
        <SkillCharacteristicRows
          rows={supplemental.filter(
            ([label]) => label !== 'Trigger targeting' && label !== 'Result details',
          )}
        />
      </dl>
      {targeting ? (
        <p>
          <strong>Trigger targeting: </strong>
          {targeting}
        </p>
      ) : null}
      {Array.isArray(explanations) && explanations.length ? (
        <ul aria-label="Effect explanations">
          {explanations.map((explanation, index) => (
            <li key={index}>{explanation}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
