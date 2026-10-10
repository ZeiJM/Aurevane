import { filterBlockedCovertApplication } from './covert-sensory-revealed'
import type { CombatEncounterState, CombatResolutionTransition } from './actions-legacy'
import type { CombatTriggerGuard } from './combat-kernel-types'
import type { AbilityRequirementContext } from './combat-requirements'

export interface CombatNativeMutationFacts {
  readonly rootActionId?: string
  readonly actionId?: string
  readonly triggeringCombatantId?: string
  readonly selectedCombatantId?: string
  readonly selectedCombatantIds?: readonly string[]
  readonly affectedCombatantIds: readonly string[]
  readonly prepaid?: true
  readonly actionFacts?: NonNullable<AbilityRequirementContext['event']>['action']
}
/** Private synchronous native callbacks; never authored, serialized, or accepted as intent. */
export interface CombatNativeExecutionHooks {
  readonly commandFacts?: (
    actionId: string,
  ) =>
    | Pick<
        CombatNativeMutationFacts,
        'actionFacts' | 'selectedCombatantId' | 'selectedCombatantIds' | 'rootActionId'
      >
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
  if (!hooks) return transition
  // Settle the existing native Covert block before recording an actual mutation witness.
  const filtered = filterBlockedCovertApplication({
    before,
    after: transition.state,
    events: transition.events,
  })
  const native = {
    ...transition,
    state: filtered.state,
    events: filtered.events as CombatResolutionTransition['events'],
  }
  return { ...native, state: hooks.observeMutation(before, native, facts) }
}

export type CapturedCombatNativeCommandFacts = Pick<
  CombatNativeMutationFacts,
  'actionFacts' | 'selectedCombatantId' | 'selectedCombatantIds' | 'rootActionId'
>
/** Present private pending/Ground facts are strict; absent historical captures remain valid. */
export function validateCombatNativeCommandFacts(value: unknown): void {
  if (value === undefined) return
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('invalid-native-command-facts')
  const facts = value as Record<string, unknown>
  if (
    Object.keys(facts).some(
      (key) =>
        !['rootActionId', 'actionFacts', 'selectedCombatantId', 'selectedCombatantIds'].includes(
          key,
        ),
    ) ||
    typeof facts.rootActionId !== 'string' ||
    !facts.rootActionId.trim() ||
    (facts.selectedCombatantId !== undefined &&
      (typeof facts.selectedCombatantId !== 'string' || !facts.selectedCombatantId.trim()))
  )
    throw new TypeError('invalid-native-command-facts')
  if (
    facts.selectedCombatantIds !== undefined &&
    (!Array.isArray(facts.selectedCombatantIds) ||
      facts.selectedCombatantIds.length > 3 ||
      new Set(facts.selectedCombatantIds).size !== facts.selectedCombatantIds.length ||
      facts.selectedCombatantIds.some(
        (id) => typeof id !== 'string' || !id.trim() || id.trim() !== id,
      ))
  )
    throw new TypeError('invalid-native-command-facts')
  const action = facts.actionFacts as Record<string, unknown> | null
  if (
    !action ||
    typeof action !== 'object' ||
    Array.isArray(action) ||
    Object.keys(action).some(
      (key) => !['classification', 'attackFamily', 'sourceDisciplineId', 'tags'].includes(key),
    ) ||
    !['attack', 'recovery', 'utility'].includes(action.classification as string) ||
    (action.attackFamily !== undefined &&
      !['physical', 'mystic'].includes(action.attackFamily as string)) ||
    (action.sourceDisciplineId !== undefined &&
      (typeof action.sourceDisciplineId !== 'string' || !action.sourceDisciplineId.trim())) ||
    !Array.isArray(action.tags) ||
    action.tags.some((tag) => typeof tag !== 'string' || !tag.trim())
  )
    throw new TypeError('invalid-native-command-facts')
}
