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

/** Historical instances keep their definition's description when no magnitude was recorded. */
export function statusPotencyDescription(
  statusId: string,
  potencyBasisPoints?: number,
  options: { legacyHealingDown?: boolean; legacyElemental?: boolean } = {},
): string {
  if (options.legacyElemental === false) {
    if (statusId === 'wet')
      return `Drenched reduces effective Initiative by 10% once while active and adds ${(potencyBasisPoints ?? 2000) / 100}% Storm damage. Fire removes Drenched.`
    if (statusId === 'conductive')
      return `Adds ${(potencyBasisPoints ?? 2000) / 100}% Storm damage; positive Storm HP damage consumes the old charge. A Storm Skill can apply a fresh charge after settlement.`
    if (statusId === 'frozen')
      return 'Chilled prevents changing final facing at turn end. End the turn in the current direction; movement keeps its usual automatic facing. A legal Fire cast cleanses the caster; positive Fire damage cleanses its recipient.'
  }
  if (statusId === 'hexed') {
    const percent = (potencyBasisPoints ?? 2500) / 100
    return options.legacyHealingDown
      ? `Receive ${percent}% less healing.`
      : `Receive ${percent}% less HP and MP recovery.`
  }
  const fallback = combatStatusDetails(statusId).description
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
      return `Deal ${percent}% less damage to anyone except the unit that applied Challenge.`
    case 'marked':
      return `Take ${percent}% more damage from the unit that applied Mark. Other attackers gain no benefit.`
    default:
      return fallback
  }
}
