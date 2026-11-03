import type { CombatEncounterState } from './actions-legacy'
import type { StatDrivenCombatProfile } from './stat-driven-combat'
import { combatAbilitySubject } from './combat-behavior-runtime'
import { evaluateAbilityRequirements } from './combat-requirements'

import type { CombatBonusStat } from './combat-stat-bonus-definition'
export {
  COMBAT_BONUS_STATS,
  COMBAT_BONUS_STAT_LABELS,
  type CombatBonusStat,
} from './combat-stat-bonus-definition'

/** Source-owned live contribution. Base profiles remain literal, including after reload. */
export function combatStatBonus(
  state: CombatEncounterState,
  combatantId: string,
  stat: CombatBonusStat,
): number {
  const owner = state.tactical.battle.combatants.find((row) => row.id === combatantId)
  if (!owner || owner.hp <= 0 || state.tactical.battle.lifecycle !== 'active') return 0
  const context = { owner: combatAbilitySubject(state, combatantId) }
  let total = 0
  for (const source of state.capturedAbilitySources ?? []) {
    if (
      source.ownerCombatantId !== combatantId ||
      !state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId)
    )
      continue
    for (const behavior of source.definition.behaviors) {
      if (
        behavior.activation !== 'ongoing' ||
        behavior.mode !== 'modifier' ||
        !evaluateAbilityRequirements(behavior.requirements, context)
      )
        continue
      for (const { payload } of behavior.effects) {
        if (payload.type !== 'stat-bonus' || payload.stat !== stat) continue
        total += payload.amount
        if (!Number.isSafeInteger(total))
          throw new RangeError('Passive stat total exceeds safe integer range.')
      }
    }
  }
  return total
}

export function effectiveCombatStatProfile(
  state: CombatEncounterState,
  combatantId: string,
): StatDrivenCombatProfile | undefined {
  const profile = state.statBridge?.combatants.find((row) => row.combatantId === combatantId) as
    StatDrivenCombatProfile | undefined
  if (!profile) return undefined
  const effective = { ...profile }
  for (const [stat, field] of [
    ['jump', 'jump'],
    ['physical-power', 'physicalPower'],
    ['mystic-power', 'mysticPower'],
    ['physical-defense', 'armor'],
    ['mystic-defense', 'ward'],
    ['evasion', 'evasion'],
  ] as const) {
    if (profile[field] === undefined) continue
    const value = profile[field]! + combatStatBonus(state, combatantId, stat)
    if (!Number.isSafeInteger(value))
      throw new RangeError('Effective stat exceeds safe integer range.')
    effective[field] = field === 'evasion' ? Math.min(10000, value) : value
  }
  return effective
}

/** Call once at a fresh own-turn boundary (or after initial source startup). */
export function captureCombatTurnMovementBonus<T extends CombatEncounterState>(state: T): T {
  const battle = state.tactical.battle,
    turn = battle.currentTurn
  if (battle.lifecycle !== 'active' || !turn || turn.movementBonusAtTurnStart !== undefined)
    return state
  const bonus = combatStatBonus(state, turn.combatantId, 'movement')
  // Mark zero too when a passive source exists: conditional changes wait until the next turn.
  const hasStatSource = state.capturedAbilitySources?.some((source) =>
    source.definition.behaviors.some((behavior) =>
      behavior.effects.some((effect) => effect.payload.type === 'stat-bonus'),
    ),
  )
  if (!bonus && !hasStatSource) return state
  const actor = battle.combatants.find((row) => row.id === turn.combatantId)!
  const maximum = actor.baseMovementBudget + bonus
  if (!Number.isSafeInteger(maximum))
    throw new RangeError('Movement allowance exceeds safe integer range.')
  return {
    ...state,
    tactical: {
      ...state.tactical,
      battle: {
        ...battle,
        currentTurn: {
          ...turn,
          movementBonusAtTurnStart: bonus,
          movementMaximum: maximum,
          movementRemaining: maximum - turn.movementSpent,
        },
      },
    },
  }
}
