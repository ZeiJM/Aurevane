/** Current authored Tag potency. Resource maxima and effective probabilities remain separate. */
export const CURRENT_EFFECT_PERCENT_MAXIMUM = 999 as const
export const CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS = CURRENT_EFFECT_PERCENT_MAXIMUM * 100
/** A displayed Damage Up bonus adds to the baseline 100% multiplier. */
export const CURRENT_EFFECT_BONUS_MULTIPLIER_MAXIMUM_BASIS_POINTS =
  10_000 + CURRENT_EFFECT_PERCENT_MAXIMUM_BASIS_POINTS
