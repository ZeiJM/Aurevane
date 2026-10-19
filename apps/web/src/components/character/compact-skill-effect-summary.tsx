'use client'

import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  useSkillEffectTimingPolicy,
  useSkillGroundInteractionRules,
} from './skill-effect-timing-context'

import {
  compactSkillEffectSummaryParts,
  skillEffectExplanationDetails,
  type CompactSkillEffectSummaryParts,
} from './skill-detail-presentation'
import styles from './compact-skill-effect-summary.module.css'
import { MechanicTextView } from './mechanic-text-view'

/** Effect names share their magnitude color in compact and expanded readers. */
export function EffectTagLabel({ label }: { label: string }) {
  return (
    <span className={styles.label} data-effect-tag-label="true">
      {label}
    </span>
  )
}

export function CompactSkillEffectSummary({
  effect,
  count = 1,
  skillEffects,
}: {
  skillEffects?: readonly MatureSkillEffectDefinition[]
  effect: MatureSkillEffectDefinition
  count?: number
}) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const parts = compactSkillEffectSummaryParts(effect, timingPolicy, {
    ...useSkillGroundInteractionRules(),
    skillEffects,
  })
  return <CompactEffectSummary parts={parts} count={count} />
}

/** Shared label, magnitude and duration markup for authored and inherent effects. */
export function CompactEffectSummary({
  parts,
  count = 1,
}: {
  parts: CompactSkillEffectSummaryParts
  count?: number
}) {
  return (
    <span data-compact-skill-effect="true">
      <strong className={styles.label} data-compact-effect-label="true">
        {parts.label}
      </strong>
      {parts.magnitude ? (
        <>
          {' '}
          <span className={styles.magnitude} data-compact-effect-magnitude="true">
            [{parts.magnitude}]
          </span>
        </>
      ) : null}
      {parts.duration ? (
        <>
          {' '}
          <span className={styles.timing} data-compact-effect-duration="true">
            [{parts.duration}]
          </span>
        </>
      ) : null}
      {parts.timing ? (
        <>
          {' '}
          <span className={styles.timing} data-compact-effect-timing="true">
            [{parts.timing}]
          </span>
        </>
      ) : null}
      {count > 1 ? (
        <span data-compact-effect-count={count} aria-label={`${count} applications`}>
          {' '}
          ×{count}
        </span>
      ) : null}
    </span>
  )
}

/** Shared supplementary facts for all full readers, including captured Basic commands. */
export function EffectExplanationNotes({
  parts,
  repeatsOnEntry,
}: {
  parts: CompactSkillEffectSummaryParts
  repeatsOnEntry?: boolean
}) {
  return (
    <>
      {skillEffectExplanationDetails(parts).map(({ label, value, labelParts }) => (
        <span key={label} data-effect-explanation-detail={label}>
          {' '}
          <MechanicTextView text={label} parts={labelParts} />: {value}.
        </span>
      ))}
      {repeatsOnEntry ? ' Repeats on entry.' : null}
    </>
  )
}
