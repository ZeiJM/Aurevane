import type { CombatActionDefinition, CombatEffectDefinition } from './actions'

type DeliveryAction = Pick<CombatActionDefinition, 'target' | 'groundTargetedRecipientIds'>
/** Explicit packet targets own delivery, including modifiers; omitted targets keep captured selection semantics. */
export function effectUsesGroundDelivery(
  action: DeliveryAction,
  effect: Pick<CombatEffectDefinition, 'target'>,
  recipientId: string,
): boolean {
  if (effect.target !== undefined)
    return effect.target === 'ground' || effect.target === 'empty-tile'
  return action.groundTargetedRecipientIds !== undefined
    ? action.groundTargetedRecipientIds.includes(recipientId)
    : action.target.kind === 'ground-tile'
}
