import { mechanicText, mechanicTag, type MechanicTextPart } from './mechanic-text'
import { combatEffectTimingMode } from '@aurevane/game-core/combat/combat-effect-timing'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  AIRBORNE_JUMP,
  AIRBORNE_ATTACK_TARGET_ELEVATION,
  airborneDescription,
} from '@aurevane/game-core/combat/combat-airborne'
import {
  DEFAULT_BLINDSIDE_MODIFIERS,
  BLINDSIDE_FRONT_MULTIPLIER_BASIS_POINTS,
  BLINDSIDE_DEBUFF_STATUS_ID,
  BLINDSIDE_DEBUFF_DESCRIPTION,
} from '@aurevane/game-core/combat/combat-blindside'
import { PV1F_MINIMUM_MOVEMENT_AP_COST } from '@aurevane/game-core/combat/pv1f-skills'
import {
  DRENCHED_INITIATIVE_PERCENT_PER_APPLICATION,
  DRENCHED_INITIATIVE_APPLICATION_LIMIT,
} from '@aurevane/game-core/combat/combat-drenched'
import { previewEffect } from './skill-effect-preview'
import {
  canonicalElementalStatusClock,
  type CanonicalStatusExplanationOptions,
} from './canonical-status-clock'
import type { CompactSkillEffectSummaryParts } from './skill-detail-presentation'

export function canonicalSecondaryStatusExplanation(
  effect: Extract<MatureSkillEffectDefinition, { type: 'apply-status' }>,
  options: CanonicalStatusExplanationOptions,
): {
  description: string
  descriptionParts?: readonly MechanicTextPart[]
  parts: Partial<CompactSkillEffectSummaryParts>
  structuredTiming?: boolean
} | null {
  if (
    !['airborne', 'blindside', BLINDSIDE_DEBUFF_STATUS_ID, 'haste', 'wet'].includes(effect.statusId)
  )
    return null
  if (effect.statusId === 'wet' && options.legacyElemental) return null
  const preview = previewEffect(effect, options)
  const details = [{ label: 'Stacks', value: String(effect.stacks) }]
  const parts: Partial<CompactSkillEffectSummaryParts> = {
    ...(preview.magnitude ? { magnitude: preview.magnitude } : {}),
    details,
  }
  if (effect.statusId === BLINDSIDE_DEBUFF_STATUS_ID) {
    const profile = effect.blindsideModifiersBasisPoints ?? DEFAULT_BLINDSIDE_MODIFIERS
    return {
      description: BLINDSIDE_DEBUFF_DESCRIPTION,
      parts: { magnitude: `${profile.side / 100}% / ${profile.rear / 100}%`, duration: '1 Turn' },
    }
  }
  if (effect.statusId === 'airborne') {
    if (options.legacyAirborne)
      return { description: airborneDescription(true, options.legacyAirborneJump), parts }
    details.push({ label: 'Ground Skills', value: 'Always miss' })
    if (!options.legacyAirborneJump) details.push({ label: 'Jump', value: String(AIRBORNE_JUMP) })
    details.push({
      label: 'Attack Target Elevation',
      value: String(AIRBORNE_ATTACK_TARGET_ELEVATION),
    })
    return {
      ...mechanicText`Ground-targeted Skills miss. Attacks use the displayed Target Elevation; Basic Attack keeps its limit. Ignore the ${mechanicTag('frozen-ground')} AP surcharge. ${mechanicTag('rooted')}, ${mechanicTag('slow')}, terrain, occupancy and Movement still apply.`,
      parts,
    }
  }
  if (effect.statusId === 'blindside') {
    const profile = effect.blindsideModifiersBasisPoints ?? DEFAULT_BLINDSIDE_MODIFIERS
    const mode =
      options.timingMode ??
      combatEffectTimingMode(options.timingPolicy ?? undefined, effect.statusId)
    const rounds = mode === 'next-round' || mode === 'delayed'
    const duration = effect.durationTurns ?? 1
    parts.duration = `${duration} ${rounds ? (duration === 1 ? 'full round' : 'full rounds') : duration === 1 ? 'recipient turn end' : 'recipient turn ends'}`
    details.push({
      label: 'Expiry',
      value: rounds
        ? 'Global round end after activation'
        : 'Count from activation, including the recipient’s current turn',
    })
    details.push(
      { label: 'Front', value: `${BLINDSIDE_FRONT_MULTIPLIER_BASIS_POINTS / 100}%` },
      { label: 'Side', value: `${profile.side / 100}%` },
      { label: 'Rear', value: `${profile.rear / 100}%` },
    )
    return {
      description: `${options.legacyBlindsideActivation ? '' : 'A successful damaging side or rear enemy hit with a facing bonus grants or refreshes Blindside. Front hits and misses do not. '}Only Skill damage uses these multipliers per application. Basic Attack is unchanged.`,
      parts,
    }
  }
  if (effect.statusId === 'haste') {
    details.push({ label: 'Minimum movement cost', value: `${PV1F_MINIMUM_MOVEMENT_AP_COST} AP` })
    return {
      description:
        'Movement costs less AP per entered tile, down to the displayed minimum. Movement allowance is unchanged.',
      parts,
    }
  }
  const current = options.explicitElemental !== false
  details.push({
    label: 'Initiative',
    value: `−${DRENCHED_INITIATIVE_PERCENT_PER_APPLICATION}% ${current ? 'per application' : 'once'}`,
  })
  if (!current)
    return {
      description:
        'Reduce effective Initiative once while active and increase incoming Storm damage. Fire removes Drenched.',
      parts,
    }
  details.push(
    {
      label: 'Maximum Initiative reduction',
      value: `${DRENCHED_INITIATIVE_PERCENT_PER_APPLICATION * DRENCHED_INITIATIVE_APPLICATION_LIMIT}%`,
    },
    { label: 'Minimum Initiative', value: '0' },
  )
  const clock = canonicalElementalStatusClock(effect, options)
  parts.duration = clock.duration
  details.push(clock.activation)
  return {
    description:
      'Reduce effective Initiative per active application, with the displayed cap and minimum. Storm vulnerability uses the strongest active application.' +
      clock.condition,
    parts,
    structuredTiming: true,
  }
}
