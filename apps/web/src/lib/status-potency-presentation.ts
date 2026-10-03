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
export function statusPotencyDescription(statusId: string, potencyBasisPoints?: number): string {
  const fallback = combatStatusDetails(statusId).description
  if (potencyBasisPoints === undefined) return fallback
  const percent = potencyBasisPoints / 100
  switch (statusId) {
    case 'guarded':
      return `Each stack reduces incoming damage by ${percent}%, up to three stacks. Reapplying adds a stack and refreshes the duration.`
    case 'exposed':
      return `Take ${percent}% more damage. Reapplying refreshes the duration; does not stack.`
    case 'lowered-guard':
      return `Each stack multiplies incoming damage by ${(10000 + potencyBasisPoints) / 10000}×, up to three stacks. Applied after a genuine PvP turn-timer expiry.`
    case 'inspired':
      return `Deal ${percent}% more damage within the combined damage-modifier cap.`
    case 'hexed':
      return `Receive ${percent}% less healing.`
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
