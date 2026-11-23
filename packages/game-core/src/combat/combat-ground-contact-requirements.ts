import type { CombatEncounterState } from './actions'
import { combatAbilitySubject } from './combat-behavior-runtime'
import {
  evaluateAbilitySelectedRequirements,
  validateAbilityRequirements,
  type AbilityRequirementContext,
  type AbilityRequirementSubjectState,
  type RequirementNode,
} from './combat-requirements'
/** Private captured owner/selection context. Only the actual entrant's affected subject is live. */
export interface CombatGroundRequirementCapture {
  requirement: RequirementNode
  context: AbilityRequirementContext
  selectedSubjects: readonly (AbilityRequirementSubjectState | null)[]
}
export function combatGroundRequirementAllows(
  state: CombatEncounterState,
  id: string,
  capture: CombatGroundRequirementCapture | null | undefined,
): boolean {
  return (
    !capture ||
    evaluateAbilitySelectedRequirements(
      capture.requirement,
      { ...capture.context, affected: combatAbilitySubject(state, id) },
      capture.selectedSubjects,
    )
  )
}

export function validateCombatGroundRequirementCapture(
  value: CombatGroundRequirementCapture | null,
): void {
  if (value === null) return
  if (
    !value ||
    typeof value !== 'object' ||
    validateAbilityRequirements(value.requirement).length ||
    !value.context ||
    typeof value.context !== 'object' ||
    Array.isArray(value.context) ||
    !Array.isArray(value.selectedSubjects)
  )
    throw new TypeError('Invalid captured Ground requirements.')
  for (const subject of [
    value.context.owner,
    value.context.selected,
    value.context.triggering,
    ...value.selectedSubjects,
  ]) {
    if (subject === null || subject === undefined) continue
    if (typeof subject !== 'object' || Array.isArray(subject))
      throw new TypeError('Invalid captured Ground requirement subject.')
    for (const id of [subject.combatantId, subject.teamId])
      if (id !== undefined && (typeof id !== 'string' || !id.trim()))
        throw new TypeError('Invalid captured Ground subject identity.')
    for (const values of [subject.resources, subject.maximumResources, subject.previousResources])
      if (
        values !== undefined &&
        (typeof values !== 'object' ||
          !values ||
          Object.values(values).some(
            (amount) => typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0,
          ))
      )
        throw new TypeError('Invalid captured Ground subject resources.')
    for (const ids of [subject.statusIds, subject.primeAbilityIds])
      if (
        ids !== undefined &&
        (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id.trim()))
      )
        throw new TypeError('Invalid captured Ground subject statuses.')
  }
}
