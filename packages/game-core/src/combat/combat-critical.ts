import { advanceBattleRng } from './battle-state'
import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatEncounterState,
} from './actions'

const BASIS_POINTS = 10_000
export const COMBAT_CRITICAL_RULES_VERSION = 1 as const
export const COMBAT_CRITICAL_DAMAGE_BASIS_POINTS = 15_000 as const

export interface CombatTargetCriticalChance {
  targetCombatantId: string
  criticalChanceBasisPoints: number
}

export interface CombatCriticalForecast {
  targetCriticalChances: readonly CombatTargetCriticalChance[]
}

export interface CombatCriticalResolvedEvent extends CombatTargetCriticalChance {
  event: 'combat_critical_resolved'
  actionId: string
  sourceCombatantId: string
  rollBasisPoints: number | null
  critical: boolean
  criticalRulesVersion: typeof COMBAT_CRITICAL_RULES_VERSION
}

export interface CombatCriticalRollResult {
  state: CombatEncounterState
  events: readonly CombatCriticalResolvedEvent[]
  criticalEffectOrdinalsByTarget: ReadonlyMap<string, ReadonlySet<number>>
}

export function hasCriticalEligibleDamage(action: CombatActionDefinition): boolean {
  return action.effects.some(isCriticalEligibleDamage)
}

/** Preview exposes probability only. It never advances authoritative RNG. */
export function forecastCombatCritical(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  missedCombatantIds: ReadonlySet<string>,
): CombatCriticalForecast {
  const plan = criticalPlan(state, action, evaluation, missedCombatantIds)
  return {
    targetCriticalChances: plan.targets.map((target) => ({
      targetCombatantId: target.targetCombatantId,
      criticalChanceBasisPoints: plan.criticalChanceBasisPoints,
    })),
  }
}

/**
 * Resolve one critical result per qualifying hostile target. Every eligible direct-damage packet
 * for that target shares the same result, so multi-hit commands never multiply crit RNG.
 */
export function rollCombatCritical(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  missedCombatantIds: ReadonlySet<string>,
): CombatCriticalRollResult {
  const plan = criticalPlan(state, action, evaluation, missedCombatantIds)
  if (plan.targets.length === 0) {
    return {
      state,
      events: [],
      criticalEffectOrdinalsByTarget: new Map(),
    }
  }

  let rng = state.tactical.battle.rng
  const events: CombatCriticalResolvedEvent[] = []
  const criticalEffectOrdinalsByTarget = new Map<string, ReadonlySet<number>>()

  for (const target of plan.targets) {
    let rollBasisPoints: number | null = null
    let critical = false

    if (plan.criticalChanceBasisPoints === 0) {
      critical = false
    } else if (plan.criticalChanceBasisPoints === BASIS_POINTS) {
      critical = true
    } else {
      const draw = advanceBattleRng(rng)
      rng = draw.state
      rollBasisPoints = draw.value % BASIS_POINTS
      critical = rollBasisPoints < plan.criticalChanceBasisPoints
    }

    if (critical) {
      criticalEffectOrdinalsByTarget.set(target.targetCombatantId, new Set(target.effectOrdinals))
    }
    events.push({
      event: 'combat_critical_resolved',
      actionId: action.id,
      sourceCombatantId: plan.actorId,
      targetCombatantId: target.targetCombatantId,
      criticalChanceBasisPoints: plan.criticalChanceBasisPoints,
      rollBasisPoints,
      critical,
      criticalRulesVersion: COMBAT_CRITICAL_RULES_VERSION,
    })
  }

  return {
    state:
      rng === state.tactical.battle.rng
        ? state
        : {
            ...state,
            tactical: {
              ...state.tactical,
              battle: { ...state.tactical.battle, rng },
            },
          },
    events,
    criticalEffectOrdinalsByTarget,
  }
}

function criticalPlan(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  missedCombatantIds: ReadonlySet<string>,
): {
  actorId: string
  criticalChanceBasisPoints: number
  targets: readonly { targetCombatantId: string; effectOrdinals: readonly number[] }[]
} {
  if (state.statBridge?.rulesVersion !== 4 || !evaluation?.legal || !evaluation.actorId) {
    return { actorId: evaluation?.actorId ?? '', criticalChanceBasisPoints: 0, targets: [] }
  }

  const actorId = evaluation.actorId
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  if (!actor) throw new TypeError('Combat critical resolution requires the committed actor.')

  const criticalChanceBasisPoints = committedCriticalChance(state, actorId)
  const ordinalsByTarget = new Map<string, number[]>()

  for (const [effectOrdinal, effect] of action.effects.entries()) {
    if (!isCriticalEligibleDamage(effect)) continue

    const recipientIds =
      effect.recipient === 'actor'
        ? []
        : effect.recipient === 'primary-unit'
          ? evaluation.primaryCombatantId
            ? [evaluation.primaryCombatantId]
            : []
          : evaluation.affectedCombatantIds

    for (const targetCombatantId of recipientIds) {
      if (missedCombatantIds.has(targetCombatantId)) continue
      const target = state.tactical.battle.combatants.find((unit) => unit.id === targetCombatantId)
      if (!target) throw new TypeError('Combat critical resolution requires committed recipients.')
      if (target.hp <= 0 || target.teamId === actor.teamId) continue

      const current = ordinalsByTarget.get(targetCombatantId) ?? []
      if (!current.includes(effectOrdinal)) current.push(effectOrdinal)
      ordinalsByTarget.set(targetCombatantId, current)
    }
  }

  const targets = [...ordinalsByTarget.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([targetCombatantId, effectOrdinals]) => ({
      targetCombatantId,
      effectOrdinals: [...effectOrdinals].sort((left, right) => left - right),
    }))

  return { actorId, criticalChanceBasisPoints, targets }
}

function isCriticalEligibleDamage(
  effect: CombatActionDefinition['effects'][number],
): effect is Extract<CombatActionDefinition['effects'][number], { type: 'damage' }> {
  return (
    effect.type === 'damage' &&
    !('vengeance' in effect && effect.vengeance !== undefined) &&
    (effect.amount > 0 || ('scaling' in effect && effect.scaling !== undefined))
  )
}

function committedCriticalChance(state: CombatEncounterState, combatantId: string): number {
  const profiles = state.statBridge?.combatants
  if (!profiles || !Array.isArray(profiles)) {
    throw new TypeError('Combat critical resolution requires committed stat profiles.')
  }
  const matches = profiles.filter((row) => row.combatantId === combatantId)
  if (matches.length !== 1) {
    throw new TypeError('Combat critical resolution requires exactly one committed actor profile.')
  }
  const value = matches[0]?.criticalChance
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > BASIS_POINTS
  ) {
    throw new RangeError(
      'Combat critical chance must be an integer between 0 and 10000 basis points.',
    )
  }
  return value
}
