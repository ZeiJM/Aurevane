import type { CombatEffectRecipient, CombatEncounterIssue, CombatEncounterState } from './actions'
import { normalizeCombatEffectState, type CombatPoisonInstance } from './combat-effect-state'

export const CURRENT_POISON_PROFILE_VERSION = 1 as const
export const CURRENT_POISON_DAMAGE = 2 as const

export interface CurrentPoisonEffect {
  type: 'poison'
  recipient: CombatEffectRecipient
}

export function currentPoisonInstance(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatPoisonInstance | null {
  return (
    normalizeCombatEffectState(state.effectState).poison.find(
      (instance) => instance.targetCombatantId === targetCombatantId,
    ) ?? null
  )
}

export function hasCurrentPoison(state: CombatEncounterState, targetCombatantId: string): boolean {
  return currentPoisonInstance(state, targetCombatantId) !== null
}

export function currentPoisonEndTurnDamage(
  state: CombatEncounterState,
  targetCombatantId: string,
): number {
  return hasCurrentPoison(state, targetCombatantId) ? CURRENT_POISON_DAMAGE : 0
}

export function applyCurrentPoisonState(
  state: CombatEncounterState,
  sourceCombatantId: string,
  targetCombatantId: string,
  sourceActionId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  const existing = effectState.poison.find(
    (instance) => instance.targetCombatantId === targetCombatantId,
  )
  const instance = {
    targetCombatantId,
    sourceCombatantId,
    sourceActionId,
    profileVersion: CURRENT_POISON_PROFILE_VERSION,
    movementRemainder: existing?.movementRemainder ?? 0,
  }

  return {
    ...state,
    effectState: {
      ...effectState,
      poison: [
        ...effectState.poison.filter(
          (candidate) => candidate.targetCombatantId !== targetCombatantId,
        ),
        instance,
      ].sort((left, right) => left.targetCombatantId.localeCompare(right.targetCombatantId)),
    },
  }
}

export function removeCurrentPoisonState(
  state: CombatEncounterState,
  targetCombatantId: string,
): CombatEncounterState {
  const effectState = normalizeCombatEffectState(state.effectState)
  return {
    ...state,
    effectState: {
      ...effectState,
      poison: effectState.poison.filter(
        (instance) => instance.targetCombatantId !== targetCombatantId,
      ),
    },
  }
}

export function advanceCurrentPoisonMovement(
  state: CombatEncounterState,
  targetCombatantId: string,
  traversedTiles: number,
): { state: CombatEncounterState; triggeredTicks: number } {
  if (!Number.isSafeInteger(traversedTiles) || traversedTiles < 0) {
    throw new RangeError(
      'Poison movement progress requires a non-negative safe integer tile count.',
    )
  }
  if (traversedTiles === 0) return { state, triggeredTicks: 0 }

  const effectState = normalizeCombatEffectState(state.effectState)
  const existing = effectState.poison.find(
    (instance) => instance.targetCombatantId === targetCombatantId,
  )
  if (!existing) return { state, triggeredTicks: 0 }

  const total = existing.movementRemainder + traversedTiles
  const triggeredTicks = Math.floor(total / 5)
  const movementRemainder = total % 5
  const poison = effectState.poison.map((instance) =>
    instance.targetCombatantId === targetCombatantId
      ? { ...instance, movementRemainder }
      : instance,
  )

  return {
    state: { ...state, effectState: { ...effectState, poison } },
    triggeredTicks,
  }
}

export function validateCombatDotState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  if (!state.effectState) return []

  const poison = state.effectState.poison
  if (!Array.isArray(poison)) {
    return [{ field: 'effectState.poison', message: 'Poison state must be an array.' }]
  }

  const combatantIds = new Set(state.tactical.battle.combatants.map((row) => row.id))
  const targetIds = new Set<string>()
  let invalid = false
  let previousTargetId: string | null = null

  for (const instance of poison) {
    if (
      !combatantIds.has(instance.targetCombatantId) ||
      !combatantIds.has(instance.sourceCombatantId) ||
      typeof instance.sourceActionId !== 'string' ||
      instance.sourceActionId.length === 0 ||
      instance.sourceActionId.trim() !== instance.sourceActionId ||
      instance.profileVersion !== CURRENT_POISON_PROFILE_VERSION ||
      !Number.isSafeInteger(instance.movementRemainder) ||
      instance.movementRemainder < 0 ||
      instance.movementRemainder > 4 ||
      targetIds.has(instance.targetCombatantId) ||
      (previousTargetId !== null && previousTargetId > instance.targetCombatantId)
    ) {
      invalid = true
    }
    targetIds.add(instance.targetCombatantId)
    previousTargetId = instance.targetCombatantId
  }

  return invalid
    ? [
        {
          field: 'effectState.poison',
          message:
            'Poison state must contain one valid current-profile instance per target, sorted by target ID, with movement progress from 0 to 4.',
        },
      ]
    : []
}
