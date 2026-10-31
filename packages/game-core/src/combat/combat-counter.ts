import { combatStatusApplications } from './combat-status-applications'
import type { CombatEncounterState, CombatEffectDefinition } from './actions'

export interface CombatCounterProfile {
  readonly kind: 'physical' | 'mystic' | 'full'
  readonly basisPoints: number
}

export function validateCombatCounterProfile(
  value: unknown,
): asserts value is CombatCounterProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Counter requires a typed profile.')
  const profile = value as CombatCounterProfile
  if (
    Object.keys(profile).some((key) => !['kind', 'basisPoints'].includes(key)) ||
    !['physical', 'mystic', 'full'].includes(profile.kind) ||
    !Number.isSafeInteger(profile.basisPoints) ||
    profile.basisPoints < 1
  )
    throw new TypeError(
      'Counter requires Physical, Mystical or Full and a positive safe percentage.',
    )
}

export function validateCombatCounterEffect(effect: CombatEffectDefinition): void {
  if (effect.type === 'apply-status' && effect.statusId === 'counter') {
    validateCombatCounterProfile(effect.counter)
    if (effect.stacks !== 1) throw new TypeError('Counter applies one status at a time.')
    if (
      (effect.durationTurns !== undefined &&
        (!Number.isSafeInteger(effect.durationTurns) ||
          effect.durationTurns < 1 ||
          effect.durationTurns > 4)) ||
      effect.power !== undefined ||
      effect.potencyBasisPoints !== undefined ||
      effect.blindsideModifiersBasisPoints !== undefined
    )
      throw new TypeError(
        'Counter uses only its type, percentage and one to four turns of duration.',
      )
  } else if ('counter' in effect)
    throw new TypeError('Counter profiles require the Counter status.')
}

export function counterDescription(profile: CombatCounterProfile): string {
  const family =
    profile.kind === 'full'
      ? 'any damage'
      : profile.kind === 'mystic'
        ? 'Mystical damage'
        : 'Physical damage'
  return `Returns ${profile.basisPoints / 100}% of ${family} received to its source after defenses and Barrier. Counter damage cannot trigger another Counter.`
}

/** Capture eligibility at the hit, so later status changes cannot rewrite an earned return. */
export function captureCounterReturn(
  state: CombatEncounterState,
  defenderId: string,
  family?: 'physical' | 'mystic',
): { counterReturnBasisPoints?: string } {
  const statuses = state.statusState.find((row) => row.combatantId === defenderId)?.statuses ?? []
  let rate = 0n
  for (const status of statuses) {
    if (
      status.statusId !== 'counter' ||
      status.timingState === 'pending' ||
      status.remainingOwnerTurnStarts <= 0 ||
      status.stacks <= 0
    )
      continue
    for (const application of combatStatusApplications(status)) {
      validateCombatCounterProfile(application.counter)
      if (application.counter.kind === 'full' || application.counter.kind === family)
        rate += BigInt(application.counter.basisPoints) * BigInt(application.stacks)
    }
  }
  return rate > 0n ? { counterReturnBasisPoints: String(rate) } : {}
}
