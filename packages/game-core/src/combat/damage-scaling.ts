export const COMBAT_SCALING_BASIS_POINTS = 10_000 as const
export const MAX_DAMAGE_SCALING_COEFFICIENT_BASIS_POINTS = 20_000 as const
export const CURRENT_SKILL_POWER_SCALING_BASIS_POINTS = 2_500 as const
export const LEVEL_MATCHUP_COMPETITIVE_GAP = 20 as const
export const LEVEL_MATCHUP_NEAR_STEP_BASIS_POINTS = 50 as const
export const LEVEL_MATCHUP_FAR_STEP_BASIS_POINTS = 150 as const
export const LEVEL_MATCHUP_MINIMUM_BASIS_POINTS = 3_000 as const
export const LEVEL_MATCHUP_MAXIMUM_BASIS_POINTS = 17_000 as const

export type CombatDamageScalingSource = 'physical-power' | 'mystic-power'

export interface CombatDamageScaling {
  source: CombatDamageScalingSource
  coefficientBasisPoints: number
}

export interface CombatDamageScalingIssue {
  field: string
  message: string
}

export function currentSkillDamageScaling(
  source: CombatDamageScalingSource,
  damageEffectCount: number,
): CombatDamageScaling {
  if (!Number.isSafeInteger(damageEffectCount) || damageEffectCount < 1) {
    throw new RangeError('Skill damage effect count must be a positive safe integer.')
  }
  return {
    source,
    coefficientBasisPoints: Math.max(
      1,
      Math.floor(CURRENT_SKILL_POWER_SCALING_BASIS_POINTS / damageEffectCount),
    ),
  }
}

export function levelMatchupDamageMultiplierBasisPoints(
  attackerLevel: number,
  defenderLevel: number,
): number {
  assertCombatLevel(attackerLevel, 'Attacker Level')
  assertCombatLevel(defenderLevel, 'Defender Level')

  const difference = attackerLevel - defenderLevel
  const direction = Math.sign(difference)
  const magnitude = Math.abs(difference)
  const competitiveLevels = Math.min(magnitude, LEVEL_MATCHUP_COMPETITIVE_GAP)
  const outlierLevels = Math.max(0, magnitude - LEVEL_MATCHUP_COMPETITIVE_GAP)
  const adjustment =
    competitiveLevels * LEVEL_MATCHUP_NEAR_STEP_BASIS_POINTS +
    outlierLevels * LEVEL_MATCHUP_FAR_STEP_BASIS_POINTS
  const raw = COMBAT_SCALING_BASIS_POINTS + direction * adjustment
  return Math.min(
    LEVEL_MATCHUP_MAXIMUM_BASIS_POINTS,
    Math.max(LEVEL_MATCHUP_MINIMUM_BASIS_POINTS, raw),
  )
}

export function applyLevelMatchupDamage(
  rawDamage: number,
  attackerLevel: number,
  defenderLevel: number,
): number {
  assertNonNegativeSafeInteger(rawDamage, 'Raw damage')
  if (rawDamage === 0) return 0

  const multiplier = levelMatchupDamageMultiplierBasisPoints(attackerLevel, defenderLevel)
  const adjusted = Number(
    (BigInt(rawDamage) * BigInt(multiplier)) / BigInt(COMBAT_SCALING_BASIS_POINTS),
  )
  return Math.max(1, adjusted)
}

export function validateCombatDamageScaling(
  scaling: CombatDamageScaling,
): readonly CombatDamageScalingIssue[] {
  const issues: CombatDamageScalingIssue[] = []
  if (scaling.source !== 'physical-power' && scaling.source !== 'mystic-power') {
    issues.push({ field: 'source', message: 'Unknown offensive scaling source.' })
  }
  if (
    !Number.isSafeInteger(scaling.coefficientBasisPoints) ||
    scaling.coefficientBasisPoints < 0 ||
    scaling.coefficientBasisPoints > MAX_DAMAGE_SCALING_COEFFICIENT_BASIS_POINTS
  ) {
    issues.push({
      field: 'coefficientBasisPoints',
      message: 'Damage scaling coefficient must be a safe integer from 0 to 20000 basis points.',
    })
  }
  return issues
}

export function calculateScaledRawDamage(
  authoredBasePower: number,
  scaling: CombatDamageScaling | null | undefined,
  offensivePower: number | null,
): number {
  assertNonNegativeSafeInteger(authoredBasePower, 'Authored base damage')
  if (!scaling) return authoredBasePower

  const issues = validateCombatDamageScaling(scaling)
  if (issues.length > 0) {
    throw new TypeError(`Invalid damage scaling: ${issues[0].field}: ${issues[0].message}`)
  }
  if (offensivePower === null) {
    throw new TypeError('Scaled damage requires offensive power.')
  }
  assertNonNegativeSafeInteger(offensivePower, 'Offensive power')

  const bonus = Number(
    (BigInt(offensivePower) * BigInt(scaling.coefficientBasisPoints)) /
      BigInt(COMBAT_SCALING_BASIS_POINTS),
  )
  const total = authoredBasePower + bonus
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new TypeError('Scaled raw damage must remain a non-negative safe integer.')
  }
  return total
}

function assertCombatLevel(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new TypeError(`${label} must be a safe integer from 1 to 100.`)
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`)
  }
}
