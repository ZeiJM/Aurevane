import { advanceBattleRng } from './battle-state'
import { combatAccuracyStatusModifier } from './combat-accuracy-status'
import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatEncounterState,
  CombatContentCatalog,
} from './actions'

const BASIS_POINTS = 10_000
export const COMBAT_SKILL_ACCURACY_RULES_VERSION = 1 as const

export interface CombatAccuracyAuthoring {
  readonly accuracyMode?: 'automatic' | 'per-target'
  readonly accuracyModifierBasisPoints?: number
}

export interface CombatTargetHitChance {
  targetCombatantId: string
  hitChanceBasisPoints: number
}

export interface CombatSkillAccuracyResolvedEvent extends CombatTargetHitChance {
  event: 'combat_accuracy_resolved'
  actionId: string
  sourceCombatantId: string
  rollBasisPoints: number
  hit: boolean
  accuracyRulesVersion: typeof COMBAT_SKILL_ACCURACY_RULES_VERSION
}

export function validateCombatAccuracyDefinition(
  definition: CombatAccuracyAuthoring & { readonly sourceType?: string },
): void {
  if (
    definition.accuracyMode !== undefined &&
    definition.accuracyMode !== 'automatic' &&
    definition.accuracyMode !== 'per-target'
  ) {
    throw new TypeError('Combat accuracy mode is not supported.')
  }
  if (
    definition.accuracyModifierBasisPoints !== undefined &&
    (!Number.isSafeInteger(definition.accuracyModifierBasisPoints) ||
      Math.abs(definition.accuracyModifierBasisPoints) > 3_000)
  ) {
    throw new RangeError('Combat accuracy modifier must be an integer within +/-3000 basis points.')
  }
  if (definition.sourceType === 'basic-attack' && definition.accuracyMode !== undefined) {
    throw new TypeError(
      'Basic Attack retains its existing accuracy adapter; explicit Skill accuracy mode is not supported.',
    )
  }
}

/** Shared arithmetic only. Callers validate committed ratings and authored modifiers. */
export function calculateHitChanceBasisPoints(
  actor: { accuracy: number },
  target: { evasion: number },
  modifierBasisPoints = 0,
): number {
  return Math.max(0, Math.min(BASIS_POINTS, actor.accuracy - target.evasion + modifierBasisPoints))
}

export function forecastCombatSkillAccuracyForTarget(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  actorId: string,
  targetCombatantId: string,
  content: CombatContentCatalog,
): CombatTargetHitChance | null {
  validateCombatAccuracyDefinition(action)
  if (action.accuracyMode !== 'per-target') return null

  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  const target = state.tactical.battle.combatants.find(
    (unit) => unit.id === targetCombatantId,
  )
  if (!actor || !target) {
    throw new TypeError('Combat accuracy requires committed actor and target combatants.')
  }
  if (target.hp <= 0 || target.teamId === actor.teamId) return null

  return {
    targetCombatantId,
    hitChanceBasisPoints: calculateHitChanceBasisPoints(
      { accuracy: committedRating(state, actorId, 'accuracy') },
      { evasion: committedRating(state, targetCombatantId, 'evasion') },
      (action.accuracyModifierBasisPoints ?? 0) +
        combatAccuracyStatusModifier(state, actorId, targetCombatantId, content),
    ),
  }
}

export function rollCombatSkillAccuracyForTarget(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  actorId: string,
  targetCombatantId: string,
  content: CombatContentCatalog,
): {
  state: CombatEncounterState
  event: CombatSkillAccuracyResolvedEvent | null
} {
  const chance = forecastCombatSkillAccuracyForTarget(
    state,
    action,
    actorId,
    targetCombatantId,
    content,
  )
  if (!chance) return { state, event: null }

  const draw = advanceBattleRng(state.tactical.battle.rng)
  const rollBasisPoints = draw.value % BASIS_POINTS
  const event: CombatSkillAccuracyResolvedEvent = {
    event: 'combat_accuracy_resolved',
    actionId: action.id,
    sourceCombatantId: actorId,
    ...chance,
    rollBasisPoints,
    hit: rollBasisPoints < chance.hitChanceBasisPoints,
    accuracyRulesVersion: COMBAT_SKILL_ACCURACY_RULES_VERSION,
  }
  return {
    state: {
      ...state,
      tactical: {
        ...state.tactical,
        battle: { ...state.tactical.battle, rng: draw.state },
      },
    },
    event,
  }
}

/** Forecasts outcomes conditional on hits, never samples or exposes the next RNG draw. */
export function forecastCombatSkillAccuracy(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation,
  content: CombatContentCatalog,
): CombatActionEvaluation {
  validateCombatAccuracyDefinition(action)
  if (!evaluation.legal || !evaluation.actorId || action.accuracyMode !== 'per-target')
    return evaluation
  const actorId = evaluation.actorId
  const actor = state.tactical.battle.combatants.find((unit) => unit.id === actorId)
  if (!actor) throw new TypeError('Combat accuracy requires the committed acting combatant.')
  const recipients = new Set<string>()
  for (const effect of action.effects) {
    if (effect.type === 'create-terrain' || effect.recipient === 'actor') continue
    if (effect.recipient === 'primary-unit') {
      if (evaluation.primaryCombatantId) recipients.add(evaluation.primaryCombatantId)
    } else {
      for (const id of evaluation.affectedCombatantIds) recipients.add(id)
    }
  }
  const hostileIds = [...recipients]
    .filter((id) => {
      const target = state.tactical.battle.combatants.find((unit) => unit.id === id)
      if (!target) throw new TypeError('Combat accuracy requires a committed recipient.')
      return target.hp > 0 && target.teamId !== actor.teamId
    })
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
  const targetHitChances = hostileIds.flatMap((targetCombatantId) => {
    const chance = forecastCombatSkillAccuracyForTarget(
      state,
      action,
      actorId,
      targetCombatantId,
      content,
    )
    return chance ? [chance] : []
  })
  return { ...evaluation, targetHitChances, projectionsAssumeHits: true }
}

/** Called only with server-owned state after ordinary legality. Results are never authored. */
export function rollCombatSkillAccuracy(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  content: CombatContentCatalog,
): {
  state: CombatEncounterState
  events: readonly CombatSkillAccuracyResolvedEvent[]
  missedCombatantIds: ReadonlySet<string>
} {
  const missedCombatantIds = new Set<string>()
  const events: CombatSkillAccuracyResolvedEvent[] = []
  if (!evaluation?.legal || !evaluation.actorId || action.accuracyMode !== 'per-target') {
    return { state, events, missedCombatantIds }
  }
  const forecast = forecastCombatSkillAccuracy(state, action, evaluation, content)
  let rng = state.tactical.battle.rng
  for (const chance of forecast.targetHitChances ?? []) {
    const draw = advanceBattleRng(rng)
    rng = draw.state
    const rollBasisPoints = draw.value % BASIS_POINTS
    const hit = rollBasisPoints < chance.hitChanceBasisPoints
    if (!hit) missedCombatantIds.add(chance.targetCombatantId)
    events.push({
      event: 'combat_accuracy_resolved',
      actionId: action.id,
      sourceCombatantId: evaluation.actorId,
      ...chance,
      rollBasisPoints,
      hit,
      accuracyRulesVersion: COMBAT_SKILL_ACCURACY_RULES_VERSION,
    })
  }
  return {
    state:
      events.length === 0
        ? state
        : {
            ...state,
            tactical: { ...state.tactical, battle: { ...state.tactical.battle, rng } },
          },
    events,
    missedCombatantIds,
  }
}

function committedRating(
  state: CombatEncounterState,
  combatantId: string,
  field: 'accuracy' | 'evasion',
): number {
  const profiles = state.statBridge?.combatants
  if (!profiles || !Array.isArray(profiles))
    throw new TypeError('Combat accuracy requires committed stat profiles.')
  const matches = profiles.filter((row) => row.combatantId === combatantId)
  if (matches.length !== 1)
    throw new TypeError('Combat accuracy requires exactly one committed profile per recipient.')
  const value = matches[0]?.[field]
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > BASIS_POINTS
  ) {
    throw new RangeError(
      `Combat accuracy ${field} must be an integer between 0 and 10000 basis points.`,
    )
  }
  return value
}
