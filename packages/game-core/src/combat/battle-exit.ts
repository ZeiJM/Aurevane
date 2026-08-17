import { validateBattleState, type BattleState } from './battle-state'

export type BattleExitPolicy =
  | 'ABORT_PRACTICE'
  | 'IMMEDIATE_RETREAT'
  | 'TACTICAL_EXTRACTION'
  | 'SURRENDER'
  | 'NO_VOLUNTARY_EXIT'

export type BattleExitOutcome = 'aborted' | 'retreated' | 'surrendered'

export type BattleExitReason = 'practice-aborted'

export interface BattleExitEvent {
  event: 'battle_abandoned'
  outcome: BattleExitOutcome
  reason: BattleExitReason
}

export interface BattleExitTransition {
  state: BattleState
  events: readonly BattleExitEvent[]
}

export function abortPracticeBattle(state: BattleState): BattleExitTransition {
  const issues = validateBattleState(state)
  if (issues.length > 0) {
    throw new Error(`Invalid battle state: ${issues[0]?.field}: ${issues[0]?.message}`)
  }
  if (state.lifecycle !== 'active' && state.lifecycle !== 'pending') {
    throw new Error('Only a pending or active practice battle can be aborted.')
  }

  const nextState: BattleState = {
    ...state,
    lifecycle: 'abandoned',
    currentTurn: null,
  }
  const nextIssues = validateBattleState(nextState)
  if (nextIssues.length > 0) {
    throw new Error(
      `Invalid abandoned battle state: ${nextIssues[0]?.field}: ${nextIssues[0]?.message}`,
    )
  }

  return {
    state: nextState,
    events: [
      {
        event: 'battle_abandoned',
        outcome: 'aborted',
        reason: 'practice-aborted',
      },
    ],
  }
}
