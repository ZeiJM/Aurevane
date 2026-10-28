import type {
  CombatActionDefinition,
  CombatEncounterState,
  CombatActionEvaluation,
  CombatContentCatalog,
} from './actions'
import { combatEvaluatedEffectRecipientIds } from './combat-effect-recipients'
import { effectUsesGroundDelivery } from './combat-effect-delivery'
import { airborneEffectGroundMiss } from './combat-airborne'
/** A shared roll is Ground-only only when every packet eligible for this recipient is Ground. */
export function accuracyActionForRecipient(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation,
  recipientId: string,
  content: CombatContentCatalog,
): CombatActionDefinition {
  if (!action.effects.some((effect) => effect.target !== undefined)) return action
  const eligible = action.effects.filter(
    (effect, ordinal) =>
      effect.recipient !== 'actor' &&
      effect.type !== 'create-terrain' &&
      combatEvaluatedEffectRecipientIds(state, action, evaluation, ordinal, content).includes(
        recipientId,
      ),
  )
  return {
    ...action,
    groundTargetedRecipientIds:
      eligible.length > 0 &&
      eligible.every((effect) => effectUsesGroundDelivery(action, effect, recipientId))
        ? [recipientId]
        : [],
  }
}

/** Outcome-only masks must not become persistent Ground-area admission lists. */
export function withEffectDeliveryEligibility(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  content: CombatContentCatalog,
): CombatActionDefinition {
  if (
    !evaluation?.legal ||
    !action.effects.some((effect) => effect.target !== undefined) ||
    state.airbornePolicyVersion !== 1
  )
    return action
  return {
    ...action,
    effectEligibleRecipientIds: action.effects.map((effect, ordinal) => {
      if (effect.target !== 'ground' && effect.target !== 'empty-tile')
        return action.effectEligibleRecipientIds?.[ordinal]
      return combatEvaluatedEffectRecipientIds(state, action, evaluation, ordinal, content).filter(
        (id) => !airborneEffectGroundMiss(state, action, effect, id, content),
      )
    }),
  }
}
