import type { CombatReversalPayload } from '@aurevane/game-core/combat/combat-reversal'
/** Saved values shared by authored reports and viewer-only armed-counter rows. */
export type ReversalPresentationValues = Pick<
  CombatReversalPayload,
  'family' | 'reflectionBasisPoints' | 'attackerMaxHpCapBasisPoints' | 'defenderMaxHpCapBasisPoints'
>

export function isReversalPresentationEffect(
  effect: unknown,
): effect is ReversalPresentationValues & { type: 'reversal' } {
  return (
    typeof effect === 'object' && effect !== null && 'type' in effect && effect.type === 'reversal'
  )
}

export const REVERSAL_STRAIN_DESCRIPTION =
  'Attack Skills and offensive automatic Skills are unavailable through the end of the next complete owner turn. The normal inherent Basic Attack, movement, Guard, Recover, healing and non-offensive utility remain available. Reversal cannot be prepared during Strain. Reversal Strain cannot be copied, stacked, cleansed or dispelled.'

export function reversalMagnitude(values: ReversalPresentationValues): string {
  return `${values.reflectionBasisPoints / 100}% ${values.family === 'physical' ? 'Physical' : 'Mystic'}`
}

export function reversalDescription(values: ReversalPresentationValues): string {
  const family = values.family === 'physical' ? 'Physical' : 'Mystic'
  return `Prepare one ${family} Reversal using Controlled timing during your normal turn, before any offensive attack, paying the Skill’s normal costs and starting its cooldown immediately. The first successful direct hostile ${family} damage packet from the front or side that would reach HP is prevented, together with that hit’s dependent hostile effects. Return ${values.reflectionBasisPoints / 100}% of the prevented HP damage, capped at the lower of ${values.attackerMaxHpCapBasisPoints / 100}% of the attacker’s maximum HP and ${values.defenderMaxHpCapBasisPoints / 100}% of your maximum HP. Summons also obey their authored outgoing damage cap. Attacker Barrier can absorb the return; no additional accuracy, critical or offensive scaling applies. Rear attacks, other damage families, misses and indirect damage bypass it without consuming it. Fully absorbed or mitigated hits do not consume it. Offensive attacks are unavailable while armed. Ends on its first trigger, the start of your next actual turn, successful Reveal, cancellation, defeat or battle end; round boundaries do not end it. Active Revealed prevents preparation. Cancellation refunds no costs and keeps the cooldown. Every ending causes Reversal Strain. ${REVERSAL_STRAIN_DESCRIPTION}`
}
