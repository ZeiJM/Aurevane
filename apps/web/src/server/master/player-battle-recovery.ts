import 'server-only'
import { reorderBattleInitiative } from '@aurevane/game-core/combat/battle-state'
import {
  reconcileCombatAbilitySources,
  refreezeCapturedCombatAbilityState,
} from '@aurevane/game-core/combat/combat-behavior-runtime'
import {
  validateStatDrivenCombatEncounterState,
  type StatDrivenCombatEncounterState,
} from '@aurevane/game-core/combat/stat-driven-combat'
import { AurevaneError } from '@aurevane/game-core/errors'

/** Keeps immutable definitions/policies and resources; discards only encounter execution state. */
export function resolveMasterBattleRecovery(
  snapshot: unknown,
): StatDrivenCombatEncounterState & {
  administrativeOutcome: 'NoContest'
  rewardOutcome: 'NoRewards'
} {
  const state = snapshot as StatDrivenCombatEncounterState
  if (!state || validateStatDrivenCombatEncounterState(state).length)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      'The stored encounter needs repair before recovery can be committed.',
    )
  if (!['pending', 'active'].includes(state.tactical.battle.lifecycle))
    throw new AurevaneError('STALE_VERSION', 'This encounter has already ended.')
  const retainedIds = new Set(
    state.tactical.battle.combatants
      .filter((unit) => unit.kind !== 'summon')
      .map((unit) => unit.id),
  )
  const battle = state.tactical.battle
  const cleared = { ...state }
  for (const key of [
    'pendingSummons',
    'pendingEffects',
    'groundAreas',
    'terrainOverlays',
    'turnOrigin',
    'turnTriggerState',
    'percentageDotCommands',
    'effectState',
  ] as const)
    delete cleared[key]
  const terminal = {
    ...cleared,
    administrativeOutcome: 'NoContest' as const,
    rewardOutcome: 'NoRewards' as const,
    tactical: {
      ...state.tactical,
      battle: reorderBattleInitiative({
        ...battle,
        lifecycle: 'abandoned',
        currentTurn: null,
        combatants: battle.combatants.filter((unit) => retainedIds.has(unit.id)),
        initiativeOrder: battle.initiativeOrder.filter((id) => retainedIds.has(id)),
        ...(battle.initiativeTieOrder
          ? { initiativeTieOrder: battle.initiativeTieOrder.filter((id) => retainedIds.has(id)) }
          : {}),
        ...(battle.actedCombatantIds ? { actedCombatantIds: [] } : {}),
        ...(battle.deferredInitiativeCombatantIds ? { deferredInitiativeCombatantIds: [] } : {}),
        ...(battle.activeInitiativeModifiers ? { activeInitiativeModifiers: [] } : {}),
        ...(battle.roundInitiativeModifiers ? { roundInitiativeModifiers: [] } : {}),
      }),
      placements: state.tactical.placements.filter((row) => retainedIds.has(row.combatantId)),
      movementProfiles: state.tactical.movementProfiles,
    },
    statusState: state.statusState
      .filter((row) => retainedIds.has(row.combatantId))
      .map((row) => ({ ...row, statuses: [] })),
    statBridge: {
      ...state.statBridge,
      combatants: state.statBridge.combatants.filter((row) => retainedIds.has(row.combatantId)),
    },
  } as StatDrivenCombatEncounterState & {
    administrativeOutcome: 'NoContest'
    rewardOutcome: 'NoRewards'
  }
  const reconciled =
    state.abilityRuntime || state.capturedAbilitySources
      ? {
          ...terminal,
          ...reconcileCombatAbilitySources(terminal, []),
          statBridge: terminal.statBridge,
        }
      : terminal
  const issues = validateStatDrivenCombatEncounterState(reconciled)
  if (issues.length)
    throw new AurevaneError(
      'PERSISTENCE_UNAVAILABLE',
      `The terminal encounter could not be validated: ${issues[0]?.field}: ${issues[0]?.message}`,
    )
  return refreezeCapturedCombatAbilityState(reconciled) as typeof terminal
}
