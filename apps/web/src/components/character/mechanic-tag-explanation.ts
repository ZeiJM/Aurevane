import { airborneDescription } from '@aurevane/game-core/combat/combat-airborne'
import {
  frozenGroundDescription,
  COMBAT_TERRAIN_OVERLAY_DETAILS,
} from '@aurevane/game-core/combat/terrain-overlays'
import { canonicalStatusExplanation } from './canonical-status-explanation'
import { previewEffect } from './skill-effect-preview'
import { statusPotencyDescription } from '@/lib/status-potency-presentation'
import type { CanonicalStatusExplanationOptions } from './canonical-status-clock'
import type { MechanicTag, MechanicTextPart } from './mechanic-text'

/** Generic referenced rules use captured policy, without inventing a live magnitude or duration. */
export function mechanicTagExplanation(
  tag: MechanicTag,
  options: CanonicalStatusExplanationOptions,
): string {
  switch (tag) {
    case 'frozen-ground':
      return frozenGroundDescription(options.legacyFrozenGround ? null : 1)
    case 'steam':
      return COMBAT_TERRAIN_OVERLAY_DETAILS.steam.description
    case 'airborne':
      return airborneDescription(options.legacyAirborne, options.legacyAirborneJump)
    case 'fire':
      return previewEffect(
        { type: 'damage', recipient: 'primary-unit', amount: 1, element: 'fire' },
        options,
      ).explanation
    case 'rooted':
    case 'slow':
    case 'exposed':
    case 'mark':
    case 'guarded':
    case 'covert':
    case 'fortified':
    case 'reckless':
    case 'challenged':
    case 'suppress':
      return canonicalStatusExplanation(
        {
          type: 'apply-status',
          recipient: 'actor',
          statusId: tag === 'rooted' ? 'root' : tag,
          stacks: 1,
        },
        options,
      )!.description
    case 'frozen':
    case 'conductive':
    case 'wet':
      // This context does not distinguish the oldest fixed Storm bonus from later stacking.
      if (options.legacyElemental && tag !== 'frozen')
        return tag === 'wet'
          ? 'Increases Storm damage taken. Fire removes Drenched.'
          : 'Increases Storm damage taken. Storm damage consumes Conductive.'
      return statusPotencyDescription(tag, undefined, {
        ...options,
        elementalPotencyUnavailable: true,
      })
    case 'burn':
    case 'bleed':
    case 'poison':
      // Presence does not identify which fixed or percentage application is active.
      return `${tag === 'burn' ? 'Burn' : tag === 'bleed' ? 'Bleed' : 'Poison'} deals damage over time.${tag === 'poison' ? ' Poison can also trigger on movement.' : ''} Each application retains its captured damage, triggers and lifetime; inspect the active effect for its exact values.`
  }
}
export function resolveMechanicText(
  parts: readonly MechanicTextPart[],
  options: CanonicalStatusExplanationOptions,
): readonly MechanicTextPart[] {
  return parts.map((part) =>
    typeof part === 'string'
      ? part
      : { ...part, explanation: mechanicTagExplanation(part.tag, options) },
  )
}
