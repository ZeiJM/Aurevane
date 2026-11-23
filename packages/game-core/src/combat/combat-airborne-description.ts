export const AIRBORNE_JUMP = 3
export const AIRBORNE_ATTACK_TARGET_ELEVATION = 3

export function airborneDescription(legacyAirborne = false, legacyJump = false): string {
  if (legacyAirborne)
    return 'Ignore the Frozen Ground AP surcharge. Board bounds, elevation, obstacles, occupancy, Rooted and Movement allowance still apply.'
  return `Ground-targeted Skills always miss you (100% evasion), including area activations. ${legacyJump ? '' : `Your Jump is ${AIRBORNE_JUMP} while Airborne is active. `}Your Attack Skills have Target Elevation ${AIRBORNE_ATTACK_TARGET_ELEVATION} while Airborne is active. Ignore the Frozen Ground AP surcharge; board bounds, movement elevation, obstacles, occupancy, Rooted, Slow and Movement allowance still apply.`
}
