'use client'

import { combatEffectTimingMode } from '@aurevane/game-core/combat/combat-effect-timing'
import { combatGroundAreaDescription } from '@aurevane/game-core/combat/combat-ground-visuals'
import type { MatureSkillDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  useSkillEffectTimingPolicy,
  useSkillGroundInteractionRules,
} from './skill-effect-timing-context'

/** Ground is the persistent delivery area, separate from its authored effects. */
export function SkillGroundAreaDetails({ skill }: { skill: MatureSkillDefinition }) {
  const timingPolicy = useSkillEffectTimingPolicy()
  const { legacyElemental, explicitElemental } = useSkillGroundInteractionRules()
  if (!skill.groundArea) return null
  const conditionalFireGround =
    !legacyElemental &&
    explicitElemental &&
    skill.target.teamPolicy === 'enemy' &&
    (skill.target.kind === 'unit' || skill.target.kind === 'ground-tile') &&
    skill.effects.some((effect) => effect.type === 'damage' && effect.element === 'fire')
  const description = combatGroundAreaDescription(
    skill.groundArea,
    combatEffectTimingMode(timingPolicy ?? undefined, 'ground-area'),
  )
  return (
    <small aria-label="Ground area rules" title={description} style={{ display: 'block' }}>
      {conditionalFireGround ? 'Ground casts: ' : ''}
      {skill.groundArea.durationRounds} rounds · {description.match(/starting [^.]+/u)?.[0]} · Entry
      applies effects once per character’s turn.
    </small>
  )
}
