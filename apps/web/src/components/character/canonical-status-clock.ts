import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import { combatEffectTimingMode } from '@aurevane/game-core/combat/combat-effect-timing'
import { elementalStatusOverlapsDamage, previewEffect } from './skill-effect-preview'

export type CanonicalStatusExplanationOptions = NonNullable<Parameters<typeof previewEffect>[1]> & {
  timingMode?: 'instant' | 'next-round' | 'delayed' | 'controlled'
}

/** Exact wrapper offset starts after matching elemental damage has actually settled. */
export function canonicalElementalStatusClock(
  effect: Extract<MatureSkillEffectDefinition, { type: 'apply-status' }>,
  options: CanonicalStatusExplanationOptions,
) {
  const overlaps = elementalStatusOverlapsDamage(effect, options.skillEffects)
  const mode =
    options.timingMode ?? combatEffectTimingMode(options.timingPolicy ?? undefined, effect.statusId)
  return {
    // Keep the previously deferred one-duration grammar unchanged in this extraction.
    duration: `${effect.durationTurns || 2} ${mode === 'next-round' || mode === 'delayed' ? 'full rounds' : 'affected turns'}`,
    activation: {
      label: 'Activation',
      value:
        mode === 'next-round'
          ? `Next global round boundary${overlaps ? ' after matching damage settles' : ''}`
          : mode === 'delayed'
            ? `Two global round boundaries${overlaps ? ' after matching damage settles' : ' later'}`
            : overlaps
              ? 'After matching damage settles'
              : mode === 'controlled'
                ? 'On legal release'
                : 'On effect activation',
    },
    condition: overlaps
      ? ' Applies when this Skill’s matching element damages an enemy’s HP, if the enemy survives.'
      : '',
  }
}
