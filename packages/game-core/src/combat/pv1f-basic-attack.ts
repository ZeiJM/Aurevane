import type { CombatActionDefinition } from './actions'
import { createBasicAttackDefinition } from './actions-legacy'
import { calculateScaledRawDamage } from './damage-scaling'

export const PV1F_BASIC_ATTACK_BASE_DAMAGE = 6 as const
export const PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS = 1_500 as const

export function calculatePv1fBasicAttackDamage(input: { physicalPower: number }): number {
  if (!Number.isSafeInteger(input.physicalPower) || input.physicalPower < 0) {
    throw new RangeError('physicalPower must be a non-negative safe integer.')
  }
  return calculateScaledRawDamage(
    PV1F_BASIC_ATTACK_BASE_DAMAGE,
    {
      source: 'physical-power',
      coefficientBasisPoints: PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS,
    },
    input.physicalPower,
  )
}

export function createPv1fBasicAttackDefinition(
  damage: number,
  family: 'physical' | 'mystic' = 'physical',
): CombatActionDefinition {
  if (!Number.isSafeInteger(damage) || damage < 1) {
    throw new RangeError('Basic Attack damage must be a positive safe integer.')
  }
  const action = createBasicAttackDefinition({
    id: 'unarmed.basic',
    version: 1,
    damage,
    minimumRange: 1,
    maximumRange: 1,
    requiresLineOfSight: false,
    maximumElevationDifference: 1,
    facingModifiersBasisPoints: {
      front: 10_000,
      side: 11_000,
      rear: 12_500,
    },
  })
  return { ...action, tags: [...action.tags, family] }
}
