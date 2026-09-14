import { validateCombatEncounterState, type CombatEncounterState } from './actions'
import { normalizeCombatEffectState, type CombatEffectState } from './combat-effect-state'
import type { CombatTerrainOverlay } from './terrain-overlays'

export type CombatRuntimeEncounterState = Omit<
  CombatEncounterState,
  'statBridge' | 'effectState' | 'terrainOverlays' | 'turnOrigin'
> & {
  statBridge: NonNullable<CombatEncounterState['statBridge']> | null
  effectState: CombatEffectState
  terrainOverlays: readonly CombatTerrainOverlay[]
  turnOrigin: NonNullable<CombatEncounterState['turnOrigin']> | null
}

export function normalizeCombatRuntimeEncounterState(
  state: CombatEncounterState,
): CombatRuntimeEncounterState {
  const issues = validateCombatEncounterState(state)
  if (issues.length > 0) {
    throw new TypeError(
      `Invalid combat encounter state: ${issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join('; ')}`,
    )
  }

  return {
    ...state,
    statBridge: state.statBridge ?? null,
    effectState: normalizeCombatEffectState(state.effectState),
    terrainOverlays: state.terrainOverlays ?? [],
    turnOrigin: state.turnOrigin ?? null,
  }
}