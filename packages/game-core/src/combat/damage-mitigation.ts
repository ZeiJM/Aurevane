/** Shared armor/ward rule for ordinary attacks and each actual Skill recipient/hit. */
export function mitigateDamageByDefense(rawDamage: number, defenseRating: number): number {
  if (!Number.isSafeInteger(rawDamage) || rawDamage < 1)
    throw new RangeError('raw damage must be a positive safe integer.')
  if (!Number.isSafeInteger(defenseRating) || defenseRating < 0)
    throw new RangeError('defense rating must be a non-negative safe integer.')
  const scaled = (BigInt(rawDamage) * 100n) / (100n + BigInt(defenseRating))
  return Math.max(1, Number(scaled))
}
