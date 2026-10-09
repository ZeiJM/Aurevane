import type { CombatEffectTimingPolicy } from '@aurevane/game-core/combat/combat-effect-timing'
import { groupSkillEffects } from './skill-effect-groups'
import {
  isPercentageDotEffect,
  percentageDotDescription,
  percentageDotMagnitude,
} from '@aurevane/game-core/combat/combat-percentage-dots'
import { COMBAT_TERRAIN_OVERLAY_DETAILS } from '@aurevane/game-core/combat/terrain-overlays'
import { PV1F_COMBAT_CONTENT } from '@aurevane/game-core/combat/pv1f-action-economy'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'
import { blindsideDamageDescription } from '@aurevane/game-core/combat/combat-blindside'
import { airborneDescription } from '@aurevane/game-core/combat/combat-airborne'
import {
  CURRENT_BURN_DAMAGE_BY_STAGE,
  CURRENT_POISON_DAMAGE,
} from '@aurevane/game-core/combat/combat-dots'
import type {
  MatureSkillDefinition,
  MatureSkillEffectDefinition,
} from '@aurevane/game-core/combat/mature-skills'
import {
  statusDamageMultiplierBasisPoints,
  statusPotencyDescription,
} from '../../lib/status-potency-presentation'

export interface PreviewEffect {
  label: string
  magnitude?: string
  explanation: string
}

const signed = (value: number) => `${value < 0 ? '−' : '+'}${Math.abs(value)}`

/** Shared by compact popups and expanded reports; describes existing combat rules. */
export function skillDamageElementInteraction(
  effect: MatureSkillEffectDefinition,
  legacyElemental = false,
  timingPolicy?: CombatEffectTimingPolicy | null,
): string {
  if (effect.type !== 'damage') return ''
  if (!legacyElemental) {
    const duration = effect.durationTurns || 2
    const bonus = (effect.potencyBasisPoints ?? 2000) / 100
    const tag =
      effect.element === 'ice' ? 'frozen' : effect.element === 'water' ? 'wet' : 'conductive'
    const mode = timingPolicy?.modes[tag] ?? 'instant'
    const lifetime =
      mode === 'instant'
        ? `${duration} affected turns starting when damage settles (Instant)`
        : mode === 'next-round'
          ? `${duration} full rounds starting next round after damage settles`
          : `${duration} full rounds starting two round boundaries after damage settles (Delayed)`
    if (effect.element === 'ice')
      return ` Positive hostile HP damage applies Chilled for ${lifetime}; Chilled locks final facing to the current direction.`
    if (effect.element === 'water')
      return ` Positive hostile HP damage applies Drenched for ${lifetime}. Drenched reduces Initiative by 10% once and adds ${bonus}% Storm damage while active.`
    if (effect.element === 'storm')
      return ` Positive hostile HP damage consumes the old Conductive charge for its captured Storm bonus, then applies one fresh Conductive charge for ${lifetime} with +${bonus}% Storm damage. Drenched remains; a new charge is not consumed again in the same command.`
    if (effect.element === 'fire')
      return ' A legal Fire cast cleanses Chilled from its caster even on empty Ground or a miss. Positive Fire HP damage removes Drenched and Chilled from hostile recipients. Fire converts affected Frozen Ground to Steam mist, keeping its remaining life and blocking sight for both teams.'
  }
  if (effect.element === 'storm')
    return ' Storm gains 20% per active Wet or Conductive application once per recipient per command and consumes Conductive; Wet remains.'
  if (effect.element === 'fire')
    return ' Positive fire damage removes Wet and Frozen from units. Fire on affected Frozen tiles replaces them with Steam for two round boundaries, blocking line of sight for both teams.'
  return ''
}

function statusPreview(
  id: string,
  potencyBasisPoints?: number,
  legacyHealingDown = false,
  legacyElemental = false,
): PreviewEffect {
  const details = {
    ...combatStatusDetails(id),
    description: statusPotencyDescription(id, potencyBasisPoints, {
      legacyHealingDown,
      legacyElemental,
    }),
  }
  const status = PV1F_COMBAT_CONTENT.statuses.find((entry) => entry.id === id)
  const result: PreviewEffect = { label: details.name, explanation: details.description }
  // These gameplay-tag rules live in the damage/healing resolvers. Their shared
  // status descriptions are the public authority; avoid a second numeric constant.
  if (id === 'suppress') {
    result.magnitude = `${(potencyBasisPoints ?? 2500) / 100}%`
  } else if (['inspired', 'hexed', 'wet', 'conductive'].includes(id)) {
    const percent =
      !legacyElemental && (id === 'wet' || id === 'conductive')
        ? `${(potencyBasisPoints ?? 2000) / 100}%`
        : details.description.match(/\d+(?:\.\d+)?%/)?.[0]
    if (percent)
      result.magnitude =
        id === 'inspired'
          ? `+${percent} outgoing`
          : id === 'hexed'
            ? `−${percent} ${legacyHealingDown ? 'healing' : 'HP/MP recovery'}`
            : `+${percent} Storm`
  } else if (status?.markAccuracyBonusBasisPoints !== undefined) {
    result.magnitude = `+${(potencyBasisPoints ?? status.markAccuracyBonusBasisPoints) / 100} pp Accuracy`
    result.explanation = `Source gains ${result.magnitude} against this target.`
  } else if (id === 'blind' && potencyBasisPoints !== undefined) {
    result.magnitude = `−${potencyBasisPoints / 100} pp Accuracy`
  } else if (status?.movement?.additionalApPerTile !== undefined) {
    result.magnitude = `${signed(status.movement.additionalApPerTile)} AP`
    result.explanation = details.description
  } else if (status?.movement?.blocked) {
    result.explanation = 'Blocks movement; attacks, Skills and facing remain available.'
  } else if (status?.damageModifiers?.length) {
    result.magnitude = status.damageModifiers
      .map(
        (modifier) =>
          `${signed((statusDamageMultiplierBasisPoints(modifier.multiplierBasisPoints, potencyBasisPoints) - 10_000) / 100)}% ${modifier.direction}`,
      )
      .join(' / ')
    result.explanation = details.description.split('. ')[0] + '.'
  } else if (status && status.damageTakenMultiplierBasisPoints !== 10_000) {
    result.magnitude = `${signed((statusDamageMultiplierBasisPoints(status.damageTakenMultiplierBasisPoints, potencyBasisPoints) - 10_000) / 100)}% incoming`
    result.explanation = `Recipient takes ${result.magnitude}.`
  } else if (status?.endOfTurn) {
    result.magnitude = `${status.endOfTurn.amount} × ${status.durationOwnerTurnStarts} ticks`
  }
  if (potencyBasisPoints !== undefined) {
    const percent = potencyBasisPoints / 100
    if (id === 'guarded') {
      result.magnitude = `−${percent}% incoming`
    } else if (id === 'exposed') {
      result.magnitude = `+${percent}% incoming`
    }
    result.explanation = details.description
  }
  return result
}

export function previewEffect(
  effect: MatureSkillEffectDefinition,
  options: {
    legacyTriggers?: boolean
    legacyPoisonMovement?: boolean
    legacyFrozenGround?: boolean
    legacyAirborne?: boolean
    legacyAirborneJump?: boolean
    legacyHealingDown?: boolean
    legacyBlindsideActivation?: boolean
    legacyElemental?: boolean
    timingPolicy?: CombatEffectTimingPolicy | null
  } = {},
): PreviewEffect {
  const target =
    effect.recipient === 'actor'
      ? 'you'
      : effect.recipient === 'affected-units'
        ? 'each affected unit'
        : effect.recipient === 'selected-tile'
          ? 'the selected empty tile'
          : 'the target'
  switch (effect.type) {
    case 'summon':
      return {
        label: 'Summon',
        explanation: 'Calls the authored allied summon onto the selected empty tile.',
      }
    case 'damage':
      return {
        label:
          effect.element === 'water'
            ? 'Water Dmg'
            : effect.element === 'storm'
              ? 'Storm Dmg'
              : effect.element === 'fire'
                ? 'Fire Dmg'
                : effect.element === 'ice'
                  ? 'Ice Dmg'
                  : 'Dmg',
        magnitude: String(effect.amount),
        explanation: `Skill power ranges from 1 to 20. Final HP damage depends on your attack stat, Level and the target’s defenses and effects.${effect.facingModifiersBasisPoints ? ` Facing: front ${effect.facingModifiersBasisPoints.front / 100}%, side ${effect.facingModifiersBasisPoints.side / 100}%, rear ${effect.facingModifiersBasisPoints.rear / 100}%.` : ''}${skillDamageElementInteraction(effect, options.legacyElemental, options.timingPolicy)}`,
      }
    case 'percentage-recovery':
      return {
        label: effect.resource === 'hp' ? 'HP Recovery' : 'MP Recovery',
        magnitude: `${effect.percent}%`,
        explanation: `Restores a captured ${effect.percent}% of ${target === 'you' ? 'your' : `${target}’s`} maximum ${effect.resource.toUpperCase()}${(effect.ticks ?? 1) > 1 ? ` per application, ${effect.ticks} times` : ''}. ${effect.resource === 'hp' || !options.legacyHealingDown ? 'The maximum and Healing Down adjustment are captured when cast' : 'The maximum is captured when cast'}; actual gains cap at the current maximum and never revive.`,
      }
    case 'healing':
      return {
        label: 'Heal',
        magnitude: String(effect.amount),
        explanation: `Restores HP to ${target}${effect.ticks && effect.ticks > 1 ? ` per application, ${effect.ticks} times (first when the effect activates)` : ''}.`,
      }
    case 'barrier-change':
      return {
        label: 'Barrier',
        magnitude: String(effect.amount),
        explanation: `Grants damage-absorbing Barrier to ${target}.`,
      }
    case 'resource-change':
      return {
        label: effect.delta < 0 ? 'MP Drain' : 'MP Restore',
        magnitude: String(Math.abs(effect.delta)),
        explanation:
          effect.delta < 0
            ? `Removes MP from ${target}.`
            : `Restores MP to ${target}${effect.ticks && effect.ticks > 1 ? ` per application, ${effect.ticks} times (first when the effect activates)` : ''}.`,
      }
    case 'apply-status':
      if (effect.statusId === 'blindside')
        return {
          label: 'Blindside',
          explanation: blindsideDamageDescription(
            effect.blindsideModifiersBasisPoints,
            options.legacyBlindsideActivation,
          ),
        }
      return effect.statusId === 'airborne'
        ? {
            label: 'Airborne',
            explanation: airborneDescription(options.legacyAirborne, options.legacyAirborneJump),
          }
        : statusPreview(
            effect.statusId,
            effect.potencyBasisPoints,
            options.legacyHealingDown,
            options.legacyElemental,
          )
    case 'displace':
      return {
        label: effect.direction === 'pull' ? 'Pull' : 'Push',
        magnitude: String(effect.distance),
        explanation: `Moves ${target} ${effect.direction === 'pull' ? 'toward you' : 'away'}; stops at blocked tiles or Rooted.`,
      }
    case 'burn': {
      if (isPercentageDotEffect(effect))
        return {
          label: 'Burn',
          magnitude: percentageDotMagnitude(effect),
          explanation: percentageDotDescription('burn', effect.backlashBasisPoints, options),
        }
      const turns = effect.durationTurns ?? CURRENT_BURN_DAMAGE_BY_STAGE.length
      const values =
        effect.power === undefined
          ? CURRENT_BURN_DAMAGE_BY_STAGE.slice(0, turns)
          : Array.from({ length: turns }, (_, index) => Math.max(1, effect.power! - index))
      return {
        label: 'Burn',
        magnitude: values.join('/'),
        explanation: `Fixed damage at the next ${turns} turn ${turns === 1 ? 'end' : 'ends'} for each active application.`,
      }
    }
    case 'bleed':
      if (isPercentageDotEffect(effect))
        return {
          label: 'Bleed',
          magnitude: percentageDotMagnitude(effect),
          explanation: percentageDotDescription('bleed'),
        }
      return {
        label: 'Bleed',
        magnitude: `${effect.damagePerTick} × ${effect.ticks} ticks`,
        explanation: 'Fixed damage at turn end for each active application.',
      }
    case 'poison': {
      if (isPercentageDotEffect(effect))
        return {
          label: 'Poison',
          magnitude: percentageDotMagnitude(effect),
          explanation: percentageDotDescription('poison', undefined, options),
        }
      const turns = effect.durationTurns
      return {
        label: 'Poison',
        magnitude: String(effect.power ?? CURRENT_POISON_DAMAGE),
        explanation:
          turns === undefined
            ? 'Fixed damage at turn end and every five voluntarily entered tiles, until removed.'
            : `Fixed damage at turn end and every five voluntarily entered tiles for ${turns} ${turns === 1 ? 'turn' : 'turns'}.`,
      }
    }
    case 'remove-status': {
      const ids = effect.statusIds.every((id) => combatStatusDetails(id).kind === 'Buff')
        ? effect.statusIds
        : [...effect.statusIds, 'suppress']
      const statusNames = [...new Set(ids.map((id) => combatStatusDetails(id).name))]
      return {
        label: effect.statusIds.every((id) => combatStatusDetails(id).kind === 'Buff')
          ? 'Dispel'
          : 'Cleanse',
        explanation: `Removes ${statusNames.join(', ')}.`,
      }
    }
    case 'create-terrain':
      return {
        label: 'Frozen Ground',
        magnitude: `+${COMBAT_TERRAIN_OVERLAY_DETAILS.frozen.additionalApPerTile} AP/tile`,
        explanation: `${options.legacyFrozenGround ? 'Both teams' : 'Only the caster’s enemies'} pay extra movement AP; fire turns it into sight-blocking Steam.`,
      }
    case 'return-to-turn-start':
      return {
        label: 'Rewind',
        explanation:
          effect.anchorMode === 'cast-position'
            ? 'Returns you to the tile captured when cast if legal; refunds no resources.'
            : 'Returns you to your turn-start tile if legal; refunds no resources.',
      }
    case 'copy-statuses':
      return {
        label: effect.mode === 'amplify' ? 'Copy Buffs' : 'Copy Debuffs',
        explanation:
          effect.mode === 'amplify'
            ? 'Copies eligible positive statuses from the target to you.'
            : 'Copies eligible negative statuses from you to the target.',
      }
    case 'sensory':
      return {
        label: 'Reveal',
        explanation: 'On a hit against Covert, strips eligible buffs and applies Revealed.',
      }
  }
}

export function skillPreviewEffects(
  skill: Pick<MatureSkillDefinition, 'effects' | 'effectDescriptions'>,
  options: {
    legacyTriggers?: boolean
    legacyPoisonMovement?: boolean
    legacyFrozenGround?: boolean
    legacyAirborne?: boolean
    legacyAirborneJump?: boolean
    legacyHealingDown?: boolean
    legacyBlindsideActivation?: boolean
    legacyElemental?: boolean
    timingPolicy?: CombatEffectTimingPolicy | null
  } = {},
): readonly PreviewEffect[] {
  const seen = new Set<string>()
  return groupSkillEffects(skill.effects, skill.effectDescriptions)
    .map(({ effect, firstIndex: index }) => {
      const statusId =
        effect.type === 'damage'
          ? ({ ice: 'frozen', water: 'wet', storm: 'conductive' } as const)[
              effect.element as 'ice' | 'water' | 'storm'
            ]
          : undefined
      const explicit =
        !options.legacyElemental && statusId
          ? skill.effects.find(
              (candidate) =>
                candidate.type === 'apply-status' &&
                candidate.statusId === statusId &&
                candidate.recipient === effect.recipient,
            )
          : undefined
      const captured =
        effect.type === 'damage' && explicit?.type === 'apply-status'
          ? {
              ...effect,
              durationTurns: effect.durationTurns || explicit.durationTurns,
              potencyBasisPoints: effect.potencyBasisPoints ?? explicit.potencyBasisPoints,
            }
          : effect
      const entry = previewEffect(captured, options)
      const override = skill.effectDescriptions?.[index]?.trim()
      return override
        ? {
            ...entry,
            explanation:
              override +
              (!options.legacyElemental
                ? skillDamageElementInteraction(captured, false, options.timingPolicy)
                : ''),
          }
        : entry
    })
    .filter((entry) => {
      const key = JSON.stringify([entry.label, entry.explanation])
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function effectSummary(effect: PreviewEffect): string {
  return effect.magnitude === undefined ? effect.label : `${effect.label} [${effect.magnitude}]`
}
