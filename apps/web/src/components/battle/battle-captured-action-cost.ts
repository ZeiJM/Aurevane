import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import { abilityCostDescription } from '@/lib/battle/ability-cost-presentation'
import { canAffordBattleCosts } from '@/lib/battle/battle-basic-actions'
import type { BattleCapturedActionTarget } from './battle-preview-selection'

/** An owner may control multiple units with the same ability; their groups remain separate. */
export function battleCapturedActionChoices(
  captures: readonly BattleCapturedActionTarget[],
  actionId: string,
  actorId: string | null,
) {
  return captures.filter(
    (row) =>
      row.actionId === actionId && (!row.ownerCombatantId || row.ownerCombatantId === actorId),
  )
}

/** Presentation only. A deliberate commit still pays through the versioned server authority. */
export function battleCapturedActionCost(
  choices: readonly BattleCapturedActionTarget[],
  fallbackCosts: AbilityBehavior['costs'],
  resources: { ap: number; mp: number; hp: number },
  behaviorId?: string,
) {
  const selected = behaviorId
    ? choices.find((row) => row.behaviorId === behaviorId)
    : choices.length === 1
      ? choices[0]
      : undefined
  const costs = selected
    ? (selected.costs ?? fallbackCosts)
    : !choices.length && !behaviorId
      ? fallbackCosts
      : undefined
  const cooldown = selected?.cooldown
  return {
    costLabel: costs ? abilityCostDescription(costs) : behaviorId ? 'Unavailable' : 'Choose action',
    cooldownLabel: selected
      ? cooldown === undefined
        ? undefined
        : cooldown === null
          ? 'None'
          : `${cooldown.ownerTurns} ${cooldown.ownerTurns === 1 ? 'turn' : 'turns'}`
      : choices.length
        ? behaviorId
          ? 'Unavailable'
          : 'Choose action'
        : undefined,
    affordable: costs
      ? canAffordBattleCosts(costs, resources)
      : !behaviorId &&
        choices.some((row) => row.costs && canAffordBattleCosts(row.costs, resources)),
  }
}
