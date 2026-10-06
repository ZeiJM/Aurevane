'use client'

import { useSkillEffectTimingPolicy } from './skill-effect-timing-context'
import {
  basicActionEffectExplanation,
  basicActionEffectSummaryParts,
  type BasicActionPresentationId,
  type BasicActionCharacterStats,
} from './basic-action-presentation'
import { CompactEffectSummary } from './compact-skill-effect-summary'

export function BasicActionEffectSummary({
  id,
  stats,
}: {
  id: BasicActionPresentationId
  stats?: BasicActionCharacterStats
}) {
  const timingPolicy = useSkillEffectTimingPolicy()
  return <CompactEffectSummary parts={basicActionEffectSummaryParts(id, timingPolicy, stats)} />
}

export function BasicActionEffectExplanations({
  id,
  className,
}: {
  id: BasicActionPresentationId
  className?: string
}) {
  return (
    <ul
      className={className}
      aria-label="Effect explanations"
      data-basic-action-effect-explanation="true"
    >
      <li>
        <strong>{basicActionEffectSummaryParts(id).label}</strong> —{' '}
        {basicActionEffectExplanation(id)}
      </li>
    </ul>
  )
}
