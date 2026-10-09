'use client'

import { combatEffectTimingMode } from '@aurevane/game-core/combat/combat-effect-timing'
import { combatGroundAreaDescription } from '@aurevane/game-core/combat/combat-ground-visuals'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import { useSkillEffectTimingPolicy } from './skill-effect-timing-context'

/** Ground is the persistent delivery area, separate from its authored effects. */
export function SkillGroundAreaDetails({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  if (!skill.groundArea) return null
  const description = combatGroundAreaDescription(
    skill.groundArea,
    combatEffectTimingMode(timingPolicy ?? undefined, 'ground-area'),
  )
  return (
    <small aria-label="Ground area rules" title={description} style={{ display: 'block' }}>
      {skill.groundArea.durationRounds} rounds · {description.match(/starting [^.]+/u)?.[0]} · Entry
      applies effects once per character’s turn.
    </small>
  )
}
