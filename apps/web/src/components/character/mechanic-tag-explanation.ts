import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { airborneDescription } from '@aurevane/game-core/combat/combat-airborne'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from '@aurevane/game-core/combat/terrain-overlays'
import { canonicalStatusExplanation } from './canonical-status-explanation'
import { previewEffect } from './skill-effect-preview'
import type { CanonicalStatusExplanationOptions } from './canonical-status-clock'
import type { MechanicTag, MechanicTextPart } from './mechanic-text'

/** Generic referenced rules use captured policy, without inventing a live magnitude or duration. */
export function mechanicTagExplanation(
  tag: MechanicTag,
  options: CanonicalStatusExplanationOptions,
): string {
  switch (tag) {
    case 'hp-less-than':
    case 'hp-more-than':
    case 'mp-less-than':
    case 'mp-more-than': {
      const resource = tag.startsWith('hp-') ? 'HP' : 'MP'
      return `The target's current ${resource} must be strictly ${tag.endsWith('less-than') ? 'below' : 'above'} the displayed percentage of its maximum ${resource}. Equality does not qualify.`
    }
    case 'trigger':
      return 'Activates when the displayed combat event and its conditions match.'
    case 'resource-threshold':
      return 'Checks the chosen character’s resource against the displayed threshold. ≥ means at least; ≤ means at most. Percentages use that character’s maximum resource.'
    case 'primed':
      return 'Indicates that at least one Controlled Skill is prepared. Ends when none remain, including after cancellation, source removal, defeat or battle end. Cannot be applied, copied or cleansed separately.'
    case 'frozen-ground': {
      return options.legacyFrozenGround
        ? 'Increases movement AP costs for either team. Airborne ignores the surcharge.'
        : 'Increases AP costs for grounded enemies on the affected tiles. Airborne ignores the surcharge; inspect the tile for its saved cost.'
    }
    case 'steam':
      return COMBAT_TERRAIN_OVERLAY_DETAILS.steam.description
    case 'airborne':
      return airborneDescription(options.legacyAirborne, options.legacyAirborneJump)
    case 'fire':
      return previewEffect(
        { type: 'damage', recipient: 'primary-unit', amount: 1, element: 'fire' },
        options,
      ).explanation
    case 'fortified': {
      const effect = options.skillEffects?.find(
        (effect) => effect.type === 'apply-status' && effect.statusId === 'fortified',
      )
      if (effect?.type === 'apply-status' && effect.defenseIncreaseBasisPoints === undefined)
        return 'Reduces incoming and outgoing damage. Both effects end together.'
      return combatStatusDetails(tag).description
    }
    case 'revealed':
    case 'lowered-guard':
      return combatStatusDetails(tag).description
    case 'inspired':
    case 'blindside':
    case 'hexed':
    case 'invisible':
    case 'haste':
    case 'warded':
    case 'rooted':
    case 'slow':
    case 'exposed':
    case 'mark':
    case 'guarded':
    case 'covert':
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
      return tag === 'frozen'
        ? 'Prevents changing final facing. Movement still turns the bearer; Cleanse Chilled removes it.'
        : tag === 'wet'
          ? options.explicitElemental === false
            ? 'Reduces Initiative once while active and increases Storm damage taken. Fire removes Drenched.'
            : 'Each Drenched application reduces Initiative, down to zero. Storm damage uses the strongest active bonus.'
          : 'Increases Storm damage taken. A damaging Storm hit consumes the existing charge.'
    case 'burn':
    case 'bleed':
    case 'poison':
      // Presence does not identify which fixed or percentage application is active.
      return `${tag === 'burn' ? 'Burn' : tag === 'bleed' ? 'Bleed' : 'Poison'} deals damage over time.${tag === 'poison' ? (options.legacyPoisonMovement || options.legacyTriggers ? ' Movement can trigger additional damage under the saved rules.' : ' Every five traversed tiles refresh its duration; teleporting does not.') : ''} Inspect the active effect for its saved damage and lifetime.`
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
