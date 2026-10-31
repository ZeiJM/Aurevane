import type { CombatStatusTuning } from '@aurevane/game-core/combat/actions'
import { combatStatusDetails } from '@aurevane/game-core/combat/status-content'

/** Mirrors the resolver's per-instance magnitude override, preserving its direction. */
export function statusDamageMultiplierBasisPoints(
  multiplierBasisPoints: number,
  potencyBasisPoints?: number,
): number {
  if (potencyBasisPoints === undefined || multiplierBasisPoints === 10000)
    return multiplierBasisPoints
  return multiplierBasisPoints < 10000
    ? Math.max(0, 10000 - potencyBasisPoints)
    : 10000 + potencyBasisPoints
}

const historicalStatusDescriptions: Readonly<Record<string, string>> = {
  guarded: 'Reduces incoming damage by 15% per application. Each use refreshes the duration.',
  exposed: 'Take 15% more damage per application. Each use refreshes the duration.',
  inspired: 'Deal 10% more damage per application.',
  mark: 'The source gains +15 percentage points Accuracy against this target. Other attackers gain no benefit.',
  warded: 'Take 20% less damage from opponents affected by Burn.',
  challenged: 'Deal 25% less damage to anyone except the unit that applied Taunt.',
  reckless:
    'Deal 40% more damage and take 25% more damage. Both effects expire or are removed together.',
  wet: 'Storm damage gains 20% per active Wet or Conductive application. Fire removes Wet.',
  conductive:
    'Storm damage gains 20% per active Wet or Conductive application, consuming Conductive.',
  frozen:
    'A Chilled setup tag. Fire removes it. Frozen Ground has its own captured duration and AP surcharge.',
}

/** Historical instances keep their definition's description when no magnitude was recorded. */
export function statusPotencyDescription(
  statusId: string,
  potencyBasisPoints?: number,
  options: {
    legacyHealingDown?: boolean
    legacyElemental?: boolean
    explicitElemental?: boolean
    elementalPotencyUnavailable?: boolean
  } & CombatStatusTuning = {},
): string {
  if (statusId === 'fortified' && options.defenseIncreaseBasisPoints !== undefined)
    return `Increase Physical and Mystic Defense by ${options.defenseIncreaseBasisPoints / 100}% and deal ${options.defenseIncreaseBasisPoints / 100}% less damage.`
  if (['haste', 'slow'].includes(statusId) && options.movementApAdjustment !== undefined)
    return `Movement costs ${options.movementApAdjustment} ${statusId === 'haste' ? 'less' : 'extra'} AP per tile, to a minimum of 10 AP. Movement allowance is unchanged.`
  if (statusId === 'lowered-guard' && options.damageTakenMultiplierBasisPoints !== undefined)
    return `Take ${options.damageTakenMultiplierBasisPoints / 100}% of normal damage per application.`
  if (statusId === 'revealed' && options.increasedDamageTakenBasisPoints !== undefined)
    return `Take ${options.increasedDamageTakenBasisPoints / 100}% more damage. Incoming attacks have 100% Accuracy.`
  const initiativeReduction = (options.initiativeReductionBasisPoints ?? 1000) / 100
  const stormBonus = options.elementalPotencyUnavailable
    ? 'the captured Storm damage bonus (recorded percentage unavailable)'
    : `${(potencyBasisPoints ?? 2000) / 100}% Storm damage`
  if (!options.legacyElemental) {
    if (statusId === 'wet')
      return options.explicitElemental === false
        ? `Drenched reduces effective Initiative by ${initiativeReduction}% once while active and adds ${stormBonus}. Fire removes Drenched.`
        : `Each Drenched application reduces effective Initiative by ${initiativeReduction}%, capped at 100% reduction (minimum 0 Initiative), while active. Drenched adds ${stormBonus} using the strongest active application.`
    if (statusId === 'conductive')
      return `Adds ${stormBonus}; positive Storm HP damage consumes the old charge. ${options.explicitElemental === false ? 'A Storm Skill' : 'An explicit Conductive tag'} can apply a fresh charge after settlement; the new charge cannot be consumed again in the same command.`
    if (statusId === 'frozen')
      return `Chilled prevents changing final facing at turn end. End the turn in the current direction; movement keeps its usual automatic facing. ${options.explicitElemental === false ? 'A legal Fire cast cleanses the caster; positive Fire damage cleanses its recipient.' : 'Cleanse Chilled removes it from its authored recipient.'}`
  }
  if (statusId === 'suppress')
    return `Deal ${(potencyBasisPoints ?? 2500) / 100}% less outgoing direct damage. Never stacks; retains the highest percentage and longest remaining duration. Captured Burn, Poison and Bleed ticks are unchanged; new DoTs capture actual settled HP loss. Cleanse removes it; Dispel does not.`
  if (statusId === 'hexed') {
    const percent = (potencyBasisPoints ?? 2500) / 100
    return options.legacyHealingDown
      ? `Receive ${percent}% less healing.`
      : `Receive ${percent}% less HP and MP recovery.`
  }
  const fallback =
    statusId === 'haste'
      ? 'Movement costs 10 less AP per entered tile, to a minimum of 10 AP. Movement allowance is unchanged.'
      : statusId === 'slow'
        ? 'Movement costs 10 extra AP per tile. Your Movement allowance is unchanged.'
        : statusId === 'lowered-guard'
          ? 'Each application multiplies incoming damage by 2.5×. Applied after a genuine PvP turn-timer expiry.'
          : statusId === 'fortified'
            ? 'Take 30% less damage and deal 20% less damage. Both effects expire or are removed together.'
            : statusId === 'revealed'
              ? 'Counters Covert and increases Skill AP costs.'
              : (historicalStatusDescriptions[statusId] ??
                combatStatusDetails(statusId).description)
  if (potencyBasisPoints === undefined) return fallback
  const percent = potencyBasisPoints / 100
  switch (statusId) {
    case 'guarded':
      return `Reduces incoming damage by ${percent}% per application. Each use refreshes the duration.`
    case 'exposed':
      return `Take ${percent}% more damage per application. Each use refreshes the duration.`
    case 'lowered-guard':
      return `Each application multiplies incoming damage by ${(10000 + potencyBasisPoints) / 10000}×. Applied after a genuine PvP turn-timer expiry.`
    case 'inspired':
      return `Deal ${percent}% more damage per application.`
    case 'mark':
      return `The source gains +${percent} percentage points Accuracy against this target. Other attackers gain no benefit.`
    case 'blind':
      return `Lose ${percent} percentage points Accuracy. Automatic Hit remains automatic.`
    case 'warded':
      return `Take ${percent}% less damage from opponents affected by Burn.`
    case 'summoned':
      return `A temporary spirit grants ${percent}% damage protection. Can be dispelled; adds no actor or turn.`
    case 'reckless':
      return `Deal ${percent}% more damage and take ${percent}% more damage. Both effects expire or are removed together.`
    case 'fortified':
      return `Take ${percent}% less damage and deal ${percent}% less damage. Both effects expire or are removed together.`
    case 'challenged':
      return `Deal ${percent}% less damage to anyone except the unit that applied Taunt.`
    case 'marked':
      return `Take ${percent}% more damage from the unit that applied Mark. Other attackers gain no benefit.`
    default:
      return fallback
  }
}
