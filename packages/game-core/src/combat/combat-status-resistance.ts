import { planCombatStatusCopies } from './combat-status-copy'
import { advanceBattleRng } from './battle-state'
import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatContentCatalog,
  CombatEncounterState,
} from './actions'

export interface CombatTargetStatusResistance {
  targetCombatantId: string
  resistanceChanceBasisPoints: number
  eligibleEffectOrdinals: readonly number[]
}
export interface CombatStatusResistanceResolvedEvent extends CombatTargetStatusResistance {
  event: 'combat_status_resistance_resolved'
  actionId: string
  sourceCombatantId: string
  rollBasisPoints: number
  resisted: boolean
  statusResistanceRulesVersion: 1
}
export type CombatResistedEffectOrdinals = ReadonlyMap<string, ReadonlySet<number>>

/** Eligibility follows the pinned effect origin, never its display name. */
export function isStatusResistanceEligibleEffect(
  action: CombatActionDefinition,
  ordinal: number,
  content: CombatContentCatalog,
): boolean {
  const origin = action.effectOrigins?.[ordinal]
  if (origin && origin.family !== 'skill') return false
  if (!origin && action.sourceType !== 'discipline-skill') return false
  const effect = action.effects[ordinal]
  if (!effect) return false
  if (effect.type === 'poison' || effect.type === 'burn' || effect.type === 'bleed') return true
  if (effect.type === 'copy-statuses') return effect.mode === 'curse'
  if (effect.type !== 'apply-status') return false
  const status = content.statuses.find((definition) => definition.id === effect.statusId)
  return (
    status?.polarity === 'negative' &&
    status.reactionClass !== 'system' &&
    status.reactionClass !== 'self-cost'
  )
}

/** Pure, conditional-on-hit probability plan; no future RNG values leave the engine. */
export function forecastCombatStatusResistance(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  content: CombatContentCatalog,
  missedCombatantIds: ReadonlySet<string> = new Set(),
): readonly CombatTargetStatusResistance[] {
  if (state.statBalancePolicyVersion !== 1 || !evaluation?.legal || !evaluation.actorId) return []
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === evaluation.actorId)!
  const byTarget = new Map<string, number[]>()
  for (const [ordinal, effect] of action.effects.entries()) {
    if (
      !isStatusResistanceEligibleEffect(action, ordinal, content) ||
      effect.recipient === 'affected-tiles'
    )
      continue
    const recipients =
      effect.recipient === 'actor'
        ? [evaluation.actorId]
        : effect.recipient === 'primary-unit'
          ? evaluation.primaryCombatantId
            ? [evaluation.primaryCombatantId]
            : []
          : evaluation.affectedCombatantIds
    for (const id of recipients) {
      const target = state.tactical.battle.combatants.find((unit) => unit.id === id)
      if (!target || target.hp <= 0 || target.teamId === actor.teamId || missedCombatantIds.has(id))
        continue
      if (effect.type === 'copy-statuses') {
        const copied = planCombatStatusCopies(state, evaluation.actorId, id, effect, content)
        if (
          !copied.copies.length &&
          !copied.poisons.length &&
          !copied.burns.length &&
          !copied.bleed.length
        )
          continue
      }
      const ordinals = byTarget.get(id) ?? []
      ordinals.push(ordinal)
      byTarget.set(id, ordinals)
    }
  }
  return [...byTarget]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([targetCombatantId, eligibleEffectOrdinals]) => {
      const chance = state.statBridge?.combatants.find(
        (unit) => unit.combatantId === targetCombatantId,
      )?.statusResistance
      if (chance === undefined || !Number.isSafeInteger(chance) || chance < 0 || chance > 1500)
        throw new TypeError(
          'Current Status Resistance requires a pinned probability from 0 to 1500 basis points.',
        )
      return { targetCombatantId, resistanceChanceBasisPoints: chance, eligibleEffectOrdinals }
    })
}

/** One draw per living hostile recipient with eligible ordinary debuffs. Filtering is recorded at cast time. */
export function rollCombatStatusResistance(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  content: CombatContentCatalog,
  missedCombatantIds: ReadonlySet<string>,
) {
  const targets = forecastCombatStatusResistance(
    state,
    action,
    evaluation,
    content,
    missedCombatantIds,
  )
  let rng = state.tactical.battle.rng
  const events: CombatStatusResistanceResolvedEvent[] = []
  const resistedEffectOrdinalsByTarget = new Map<string, ReadonlySet<number>>()
  for (const target of targets) {
    if (target.resistanceChanceBasisPoints === 0) continue
    const draw = advanceBattleRng(rng)
    rng = draw.state
    const rollBasisPoints = draw.value % 10000
    const resisted = rollBasisPoints < target.resistanceChanceBasisPoints
    if (resisted)
      resistedEffectOrdinalsByTarget.set(
        target.targetCombatantId,
        new Set(target.eligibleEffectOrdinals),
      )
    events.push({
      ...target,
      event: 'combat_status_resistance_resolved',
      actionId: action.id,
      sourceCombatantId: evaluation!.actorId!,
      rollBasisPoints,
      resisted,
      statusResistanceRulesVersion: 1,
    })
  }
  return {
    state:
      rng === state.tactical.battle.rng
        ? state
        : { ...state, tactical: { ...state.tactical, battle: { ...state.tactical.battle, rng } } },
    events,
    resistedEffectOrdinalsByTarget,
  }
}
