import { abilityCostDescription } from './ability-cost-presentation'
import type { AbilityBehavior } from '@aurevane/game-core/combat/combat-definition'
import type { CombatTargetSpec } from '@aurevane/game-core/combat/actions'
import type { abilityBehaviorInformation } from '@/components/character/ability-detail-presentation'

export interface BattleBasicBehaviorPresentation extends ReturnType<
  typeof abilityBehaviorInformation
> {
  readonly behaviorId: string
  readonly classification: AbilityBehavior['classification']
  readonly costs: AbilityBehavior['costs']
  readonly cooldown: AbilityBehavior['cooldown']
  readonly target: CombatTargetSpec
  readonly move?: { readonly maximumTiles: number; readonly conditional: boolean }
}
export interface BattleBasicActionPresentation {
  readonly ownerCombatantId: string
  readonly actionId: string
  readonly contentVersion: number
  readonly name: string
  readonly description: string
  readonly enabled: boolean
  readonly iconKey: string | null
  readonly movement?: {
    readonly costBasis: 'flat' | 'per-terrain-point'
    readonly apPerTraversalPoint?: number
    readonly maximumTiles: number
  }
  readonly behaviors: readonly BattleBasicBehaviorPresentation[]
}

/** Undefined is historical native metadata; null means an action is absent from saved ownership. */
export function findBattleBasicAction(
  snapshot: { basicActions?: readonly BattleBasicActionPresentation[] },
  actorId: string | null,
  actionId: string,
): BattleBasicActionPresentation | null | undefined {
  if (snapshot.basicActions === undefined) return undefined
  return (
    snapshot.basicActions.find(
      (action) => action.ownerCombatantId === actorId && action.actionId === actionId,
    ) ?? null
  )
}

export function battleBasicBehavior(action: BattleBasicActionPresentation, behaviorId?: string) {
  return behaviorId
    ? action.behaviors.find((behavior) => behavior.behaviorId === behaviorId)
    : action.behaviors.length === 1
      ? action.behaviors[0]
      : undefined
}

export function battleBasicCostLabel(
  action: BattleBasicActionPresentation | null | undefined,
  fallback: string,
  behaviorId?: string,
): string {
  if (action === undefined) return fallback
  if (action === null) return 'Unavailable'
  const behavior = battleBasicBehavior(action, behaviorId)
  if (!behavior) return behaviorId ? 'Unavailable' : 'Choose action'
  return abilityCostDescription(behavior.costs)
}

/** Presentation affordability only; the command service remains the payment authority. */
export function canAffordBattleBasicAction(
  action: BattleBasicActionPresentation | null | undefined,
  resources: { ap: number; mp: number; hp: number },
  behaviorId?: string,
): boolean {
  if (action === undefined) return true
  if (!action?.enabled || resources.hp <= 0) return false
  const chosen = battleBasicBehavior(action, behaviorId)
  return (chosen ? [chosen] : behaviorId ? [] : action.behaviors).some((behavior) =>
    behavior.costs.every(
      (cost) =>
        (cost.resource === 'hp' ? resources.hp - 1 : resources[cost.resource]) >= cost.amount,
    ),
  )
}
