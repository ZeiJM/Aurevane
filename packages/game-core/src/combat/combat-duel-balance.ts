import type { CombatEncounterState } from './actions'
import { classifyFacingRelation } from './board'

/** Calibrated against legal Level100, Core40 offense/HP, four-Skill direct-pressure mirrors. */
export const DUEL_DIRECT_DAMAGE_BASIS_POINTS = 14_000 as const

export function duelBalancedDirectDamage(state: CombatEncounterState, amount: number): number {
  if (state.duelBalancePolicyVersion !== 1 || amount === 0) return amount
  const result = Number((BigInt(amount) * BigInt(DUEL_DIRECT_DAMAGE_BASIS_POINTS)) / 10_000n)
  if (!Number.isSafeInteger(result)) throw new RangeError('Duel damage exceeds safe integer range.')
  return result
}

/** Add to Accuracy minus Evasion, before the single final probability clamp. */
export function facingHitChanceModifierBasisPoints(
  state: CombatEncounterState,
  actorId: string,
  targetId: string,
): number {
  if (state.duelBalancePolicyVersion !== 1 || actorId === targetId) return 0
  const actor = state.tactical.placements.find((placement) => placement.combatantId === actorId)
  const target = state.tactical.placements.find((placement) => placement.combatantId === targetId)
  if (!actor || !target) throw new TypeError('Facing accuracy requires committed placements.')
  const relation = classifyFacingRelation(target.position, target.facing, actor.position)
  return { front: -500, side: 500, rear: 1000 }[relation]
}
