import type { CombatReversalPayload } from '@aurevane/game-core/combat/combat-reversal'
/** Saved values shared by authored reports and viewer-only armed-counter rows. */
export type ReversalPresentationValues = Pick<
  CombatReversalPayload,
  'family' | 'reflectionBasisPoints' | 'attackerMaxHpCapBasisPoints' | 'defenderMaxHpCapBasisPoints'
> & { policyVersion?: 1 }

export interface ReversalPresentationOptions {
  legacyReversal?: boolean
}

export function isReversalPresentationEffect(effect: unknown): effect is CombatReversalPayload {
  return (
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === 'reversal'
  )
}

export const REVERSAL_STRAIN_DESCRIPTION =
  'Attack Skills and offensive automatic Skills are unavailable through the end of the next complete owner turn. The normal inherent Basic Attack, movement, Guard, Recover, healing and non-offensive utility remain available. Reversal cannot be prepared during Strain. Reversal Strain cannot be copied, stacked, cleansed or dispelled.'

export function reversalMagnitude(values: ReversalPresentationValues): string {
  return `${values.reflectionBasisPoints / 100}% ${values.family === 'physical' ? 'Physical' : 'Mystic'}`
}

export function reversalRuleDescription(options: ReversalPresentationOptions = {}): string {
  return `Arms immediately after paid Controlled preparation. Prevents the first qualifying hostile front/side direct hit in its saved family, then returns the configured percentage of prevented HP damage. ${options.legacyReversal ? 'Saved maximum-HP caps apply; expires at the next actual owner turn.' : 'Remains armed until triggered or cancelled, without maximum-HP caps.'} Reveal, defeat or battle end also disarm it. Offensive attacks are blocked while armed. Ending causes Reversal Strain; cancellation refunds nothing.`
}

export function reversalDescription(
  values: ReversalPresentationValues,
  options: ReversalPresentationOptions = {},
): string {
  const family = values.family === 'physical' ? 'Physical' : 'Mystic'
  const lifetime = options.legacyReversal
    ? `Expires at the next actual owner turn; return is capped at the lower of ${values.attackerMaxHpCapBasisPoints / 100}% attacker maximum HP or ${values.defenderMaxHpCapBasisPoints / 100}% your maximum HP.`
    : 'Remains armed until triggered or cancelled.'
  return `Arms immediately on paid Controlled preparation. Prevents the first hostile front/side ${family} direct hit that would reach HP; returns ${values.reflectionBasisPoints / 100}% of that damage. ${lifetime} Summon limits and Barrier still apply. Reveal, defeat or battle end also disarm it. No offensive attacks while armed. Ending causes Reversal Strain. Cancellation refunds nothing.`
}
