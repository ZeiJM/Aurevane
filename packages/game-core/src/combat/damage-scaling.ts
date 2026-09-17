export const COMBAT_SCALING_BASIS_POINTS = 10_000 as const
export const MAX_DAMAGE_SCALING_COEFFICIENT_BASIS_POINTS = 20_000 as const

export type CombatDamageScalingSource = 'physical-power' | 'mystic-power'

export interface CombatDamageScaling {
  source: CombatDamageScalingSource
  coefficientBasisPoints: number
}

export interface CombatDamageScalingIssue {
  field: string
  message: string
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

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`)
  }
}
