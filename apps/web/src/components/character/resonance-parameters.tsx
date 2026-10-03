'use client'

import {
  useSkillEffectTimingPolicy,
  useSkillCopyPolicyVersion,
} from './skill-effect-timing-context'
import type { AnyResonanceDefinition } from '@aurevane/game-core/combat/resonance'
import { normalizedResonanceMechanics } from '@aurevane/game-core/combat/resonance-v2'
import { CompactSkillEffectSummary } from './compact-skill-effect-summary'
import {
  resonanceCharacteristicRows,
  resonanceResultRecipient,
  resonanceMatcher,
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
  const timingPolicy = useSkillEffectTimingPolicy()
  const copyPolicyVersion = useSkillCopyPolicyVersion()
  const mechanics = definition ? normalizedResonanceMechanics(definition) : null
  const effects = mechanics?.resultEffects ?? []
  const supplemental = resonanceSupplementalRows(definition, copyPolicyVersion)
  const explanations = supplemental.find(([label]) => label === 'Result details')?.[1]
  return (
    <div
      className={[styles.report, className].filter(Boolean).join(' ')}
      data-resonance-parameters="true"
    >
      <dl>
        <SkillCharacteristicRows
          rows={resonanceCharacteristicRows(definition, timingPolicy, copyPolicyVersion)}
          effectSummary={
            definition
              ? effects.length
                ? effects.map((effect, index) => (
                    <div className={styles.effectRow} key={index}>
                      {resonanceMatcher(mechanics!.trigger)}:{' '}
                      <CompactSkillEffectSummary effect={effect} />
                      {effect.recipient !== 'actor'
                        ? ` → ${resonanceResultRecipient(effect)}`
                        : null}
                    </div>
                  ))
                : 'N/A'
              : undefined
          }
        />
        <SkillCharacteristicRows
          rows={supplemental.filter(([label]) => label !== 'Result details')}
        />
      </dl>
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
