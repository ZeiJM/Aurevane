import type { CombatEffectRecipient, CombatEncounterState } from './actions'
import { normalizeCombatEffectState } from './combat-effect-state'

export const CURRENT_POISON_PROFILE_VERSION = 1 as const

export interface CurrentPoisonEffect {
  type: 'poison'
  recipient: CombatEffectRecipient
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
