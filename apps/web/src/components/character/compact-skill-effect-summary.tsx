import type { CombatEffectDefinition } from '@aurevane/game-core/combat/actions'

import { compactSkillEffectSummaryParts } from './skill-detail-presentation'

export function CompactSkillEffectSummary({ effect }: { effect: CombatEffectDefinition }) {
  const parts = compactSkillEffectSummaryParts(effect)

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
    </span>
  )
}
