import { mechanicText, mechanicTag, type MechanicTextPart } from './mechanic-text'
import type { MatureSkillEffectDefinition } from '@aurevane/game-core/combat/mature-skills'
import {
  DEFAULT_BURN_BACKLASH_BASIS_POINTS,
  CURRENT_POISON_REFRESH_TRAVERSED_TILES,
  isPercentageDotEffect,
  percentageBasisPointsText,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from '@aurevane/game-core/combat/terrain-overlays'
import type { CanonicalStatusExplanationOptions } from './canonical-status-clock'
import type { CompactSkillEffectSummaryParts } from './skill-detail-presentation'

/** Secondary facts retain native values; legacy trigger policies keep their full fallback. */
export function canonicalPeriodicGroundExplanation(
  effect: MatureSkillEffectDefinition,
  options: CanonicalStatusExplanationOptions,
): {
  description: string
  descriptionParts?: readonly MechanicTextPart[]
  parts: Partial<CompactSkillEffectSummaryParts>
} | null {
  if (effect.type === 'create-terrain') {
    const frozen = COMBAT_TERRAIN_OVERLAY_DETAILS.frozen
    const main =
      effect.skillApSurcharge !== undefined
        ? mechanicText`Create ${mechanicTag('frozen-ground')} that raises Skill AP costs for grounded enemies on the affected tiles. ${mechanicTag('airborne')} ignores the surcharge. ${mechanicTag('fire')} turns it into ${mechanicTag('steam')}, which blocks sight for both teams.`
        : mechanicText`Create ${mechanicTag('frozen-ground')} that raises movement AP costs. ${mechanicTag('airborne')} ignores the surcharge. ${mechanicTag('fire')} turns it into ${mechanicTag('steam')}, which blocks sight for both teams.`
    const lifetime = options.legacyElemental
      ? mechanicText` ${mechanicTag('steam')} starts with its configured lifetime.`
      : {
          description: ' The conversion preserves the remaining lifetime.',
          descriptionParts: [' The conversion preserves the remaining lifetime.'],
        }
    return {
      description: main.description + lifetime.description,
      descriptionParts: [...main.descriptionParts, ...lifetime.descriptionParts],
      parts: {
        duration: `${frozen.roundBoundaries} global round boundaries`,
        details: [
          {
            label:
              effect.skillApSurcharge !== undefined ? 'Skill AP surcharge' : 'Movement surcharge',
            value:
              effect.skillApSurcharge !== undefined
                ? `+${effect.skillApSurcharge} AP per Skill`
                : `+${frozen.additionalApPerTile} AP per entered tile`,
          },
          {
            label: 'Affected units',
            value:
              effect.skillApSurcharge !== undefined
                ? 'Caster’s grounded enemies'
                : options.legacyFrozenGround
                  ? 'Both teams'
                  : 'Caster’s enemies',
          },
          { label: 'Blocks line of sight', value: frozen.blocksLineOfSight ? 'Yes' : 'No' },
          {
            label: 'Steam lifetime',
            labelParts: [mechanicTag('steam'), ' lifetime'],
            value: options.legacyElemental
              ? `${COMBAT_TERRAIN_OVERLAY_DETAILS.steam.roundBoundaries} global round boundaries`
              : 'Remaining Ground lifetime',
          },
        ],
      },
    }
  }
  if (!isPercentageDotEffect(effect) || options.legacyTriggers) return null
  if (effect.type === 'burn')
    return {
      description: `Burn deals ${(effect.damageProfile?.decayBasisPointsPerTick ?? 0) > 0 ? 'decreasing' : 'repeated'} damage based on the attack’s HP damage. The bearer also suffers backlash after damaging an enemy. Reapplying replaces Burn.`,
      parts: {
        details: [
          {
            label: 'Backlash',
            value: `${percentageBasisPointsText(effect.backlashBasisPoints ?? DEFAULT_BURN_BACKLASH_BASIS_POINTS)}% own hostile HP damage`,
          },
          { label: 'Backlash allowance', value: 'Once per turn' },
        ],
      },
    }
  if (effect.type === 'poison' && !options.legacyPoisonMovement)
    return {
      description:
        'Poison deals repeated damage based on the attack’s HP damage. Movement renews its duration; teleporting does not. Reapplying retains the stronger effect and longer original duration.',
      parts: {
        details: [
          { label: 'Tick', value: 'Affected turn end' },
          {
            label: 'Refresh',
            value: `Every ${CURRENT_POISON_REFRESH_TRAVERSED_TILES} traversed tiles`,
          },
          { label: 'Refresh duration', value: 'Original full duration' },
          { label: 'Extra damage on refresh', value: 'None' },
        ],
      },
    }
  return effect.type === 'bleed'
    ? {
        description:
          'Bleed deals repeated damage based on the attack’s HP damage. Each application deals damage separately.',
        parts: {},
      }
    : null
}
