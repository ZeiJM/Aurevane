import type { CombatEncounterState, CombatResolutionTransition } from './actions-legacy'
import type { CombatTriggerGuard } from './combat-kernel-types'
import type { AbilityRequirementContext } from './combat-requirements'

export interface CombatNativeMutationFacts {
  readonly rootActionId?: string
  readonly actionId?: string
  readonly triggeringCombatantId?: string
  readonly selectedCombatantId?: string
  readonly affectedCombatantIds: readonly string[]
  readonly prepaid?: true
  readonly actionFacts?: NonNullable<AbilityRequirementContext['event']>['action']
}
/** Private synchronous native callbacks; never authored, serialized, or accepted as intent. */
export interface CombatNativeExecutionHooks {
  readonly commandFacts?: (
    actionId: string,
  ) =>
    | Pick<CombatNativeMutationFacts, 'actionFacts' | 'selectedCombatantId' | 'rootActionId'>
    | undefined
  readonly observeMutation: (
    before: CombatEncounterState,
    transition: CombatResolutionTransition,
    facts: CombatNativeMutationFacts,
  ) => CombatEncounterState
  readonly getGuard: () => CombatTriggerGuard
  readonly setGuard: (guard: CombatTriggerGuard) => void
  readonly settleOutcomes?: (transition: CombatResolutionTransition) => CombatResolutionTransition
  readonly prepareIncoming?: (state: CombatEncounterState) => CombatResolutionTransition
}
export function observeCombatNativeMutation<Transition extends CombatResolutionTransition>(
  hooks: CombatNativeExecutionHooks | undefined,
  before: CombatEncounterState,
  transition: Transition,
  facts: CombatNativeMutationFacts,
): Transition {
  return hooks
    ? { ...transition, state: hooks.observeMutation(before, transition, facts) }
    : transition
}
