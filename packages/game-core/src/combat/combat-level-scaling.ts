export const COMBAT_LEVEL_CLOSE_RANGE = 20 as const
export const COMBAT_LEVEL_CLOSE_STEP_BASIS_POINTS = 50 as const
export const COMBAT_LEVEL_FAR_STEP_BASIS_POINTS = 150 as const
export const COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS = 2_500 as const
export const COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS = 17_500 as const
export const COMBAT_LEVEL_DAMAGE_BASE_BASIS_POINTS = 10_000 as const

/**
 * Damage stays deliberately close inside a ±20-Level matchup band, then diverges sharply.
 * This keeps nearby Levels competitive while preventing extreme low-Level upset damage.
 */
export function combatLevelDamageModifierBasisPoints(
  attackerLevel: number,
  defenderLevel: number,
): number {
  assertLevel(attackerLevel, 'attackerLevel')
  assertLevel(defenderLevel, 'defenderLevel')

  const delta = attackerLevel - defenderLevel
  if (Math.abs(delta) <= COMBAT_LEVEL_CLOSE_RANGE) {
    return clamp(
      COMBAT_LEVEL_DAMAGE_BASE_BASIS_POINTS + delta * COMBAT_LEVEL_CLOSE_STEP_BASIS_POINTS,
      COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS,
      COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS,
    )
  }

  if (delta > COMBAT_LEVEL_CLOSE_RANGE) {
    return clamp(
      COMBAT_LEVEL_DAMAGE_BASE_BASIS_POINTS +
        COMBAT_LEVEL_CLOSE_RANGE * COMBAT_LEVEL_CLOSE_STEP_BASIS_POINTS +
        (delta - COMBAT_LEVEL_CLOSE_RANGE) * COMBAT_LEVEL_FAR_STEP_BASIS_POINTS,
      COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS,
      COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS,
    )
  }

  const deficit = -delta
  return clamp(
    COMBAT_LEVEL_DAMAGE_BASE_BASIS_POINTS -
      COMBAT_LEVEL_CLOSE_RANGE * COMBAT_LEVEL_CLOSE_STEP_BASIS_POINTS -
      (deficit - COMBAT_LEVEL_CLOSE_RANGE) * COMBAT_LEVEL_FAR_STEP_BASIS_POINTS,
    COMBAT_LEVEL_DAMAGE_MIN_BASIS_POINTS,
    COMBAT_LEVEL_DAMAGE_MAX_BASIS_POINTS,
  )
}

function assertLevel(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new RangeError(`${field} must be a safe integer from 1 to 100.`)
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
