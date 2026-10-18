import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'

/** One small shared formatter; the cockpit need not import the definition report builder. */
export function abilityCostDescription(costs: AbilityBehavior['costs']): string {
  return ['ap', 'mp', 'hp']
    .flatMap((resource) => {
      const amount = costs.find((cost) => cost.resource === resource)?.amount ?? 0
      return amount > 0 || resource === 'ap' ? [`${amount} ${resource.toUpperCase()}`] : []
    })
    .join(' / ')
}
