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
    const main = mechanicText`Create ${mechanicTag('frozen-ground')} on affected tiles. The displayed surcharge applies on entry; ${mechanicTag('airborne')} ignores it and Movement allowance is unchanged. ${mechanicTag('fire')} converts it to ${mechanicTag('steam')}, which blocks line of sight for both teams.`
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
            label: 'Movement surcharge',
            value: `+${frozen.additionalApPerTile} AP per entered tile`,
          },
          {
            label: 'Affected units',
            value: options.legacyFrozenGround ? 'Both teams' : 'Caster’s enemies',
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
  const recipient =
    effect.recipient === 'actor'
      ? 'yourself'
      : effect.recipient === 'affected-units'
        ? 'each affected unit'
        : 'the selected unit'
  const basis =
    'Each tick uses the displayed share of the granting attack’s actual HP damage, rounded down.'
  if (effect.type === 'burn')
    return {
      description: `Apply Burn to ${recipient}. ${basis} Only one Burn can be active on a recipient; reapplication replaces it and restarts its duration and decay. Tick percentages follow the displayed sequence. A burning unit takes the displayed backlash share of the actual HP damage its own attack deals to enemies, rounded down. Multi-hit damage is summed once; misses and friendly damage do not trigger backlash. Reapplication or Copy does not renew this allowance.`,
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
      description: `Apply Poison to ${recipient}. ${basis} Only one Poison can be active. Reapplication retains the greater authored percentage and original duration independently, restarts that full duration and resets movement progress. Traversed tiles, including Push or Pull, advance progress; partial movement carries between turns. Each threshold refreshes the recorded full duration without extra damage. Instantaneous relocation does not count.`,
      parts: {
        details: [
          { label: 'Tick', value: 'Affected turn end' },
          {
            label: 'Refresh',
            value: `Every ${CURRENT_POISON_REFRESH_TRAVERSED_TILES} traversed tiles`,
          },
          { label: 'Refresh duration', value: 'Captured full duration' },
          { label: 'Extra damage on refresh', value: 'None' },
        ],
      },
    }
  return null
}
