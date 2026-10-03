'use client'

import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  useSkillEffectTimingPolicy,
  useSkillCopyPolicyVersion,
} from './skill-effect-timing-context'

import {
  compactSkillEffectSummaryParts,
  type CompactSkillEffectSummaryParts,
} from './skill-detail-presentation'

export function CompactSkillEffectSummary({ effect }: { effect: MatureSkillEffectDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const copyPolicyVersion = useSkillCopyPolicyVersion()
  const parts = compactSkillEffectSummaryParts(effect, timingPolicy, copyPolicyVersion)
  return <CompactEffectSummary parts={parts} />
}

/** Shared label, magnitude and duration markup for authored and inherent effects. */
export function CompactEffectSummary({ parts }: { parts: CompactSkillEffectSummaryParts }) {
  return (
    <span data-compact-skill-effect="true">
      <span data-compact-effect-label="true">{parts.label}</span>
      {parts.magnitude ? (
        <>
          {' '}
          <span data-compact-effect-magnitude="true">[{parts.magnitude}]</span>
        </>
      ) : null}
      {parts.duration ? (
        <>
          {' '}
          <span data-compact-effect-duration="true">[{parts.duration}]</span>
        </>
      ) : null}
      {parts.timing ? (
        <>
          {' '}
          <span data-compact-effect-timing="true">[{parts.timing}]</span>
        </>
      ) : null}
    </span>
  )
}
