import type { CombatEncounterState, CombatEncounterIssue } from './actions-legacy'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'

/** Private persisted execution authority. Missing optional memory remains historical. */
export function validateCombatAbilityState(
  state: CombatEncounterState,
): readonly CombatEncounterIssue[] {
  const issues: CombatEncounterIssue[] = []
  const issue = (field: string, message: string) => issues.push({ field, message })
  const validCaptures: CapturedCombatAbilitySource[] = []
  const captures = state.capturedAbilitySources
  if (captures !== undefined) {
    if (!Array.isArray(captures))
      return [{ field: 'capturedAbilitySources', message: 'Invalid captured Ability inventory.' }]
    const ids = new Set<string>()
    for (const source of captures) {
      try {
        const normalized = captureCombatAbilitySource(source)
        if (
          ids.has(source.sourceInstanceId) ||
          !state.tactical.battle.combatants.some((unit) => unit.id === source.ownerCombatantId)
        )
          throw new TypeError('invalid-source-owner-or-duplicate')
        ids.add(source.sourceInstanceId)
        validCaptures.push(normalized)
      } catch {
        issue('capturedAbilitySources', 'Invalid captured Ability source/owner/identity.')
      }
    }
  }
  const runtime = state.abilityRuntime
  if (runtime === undefined) return issues
  if (
    !runtime ||
    typeof runtime !== 'object' ||
    runtime.schemaVersion !== 1 ||
    Object.keys(runtime).some(
      (key) =>
        ![
          'schemaVersion',
          'activeSourceIds',
          'usage',
          'maintained',
          'nextCommandSequence',
          'conditionTruth',
        ].includes(key),
    )
  ) {
    issue('abilityRuntime', 'Invalid private Ability runtime schema.')
    return issues
  }
  if (
    !Array.isArray(runtime.activeSourceIds) ||
    new Set(runtime.activeSourceIds).size !== runtime.activeSourceIds.length ||
    runtime.activeSourceIds.some(
      (id) =>
        typeof id !== 'string' || !validCaptures.some((source) => source.sourceInstanceId === id),
    )
  )
    issue(
      'abilityRuntime.activeSourceIds',
      'Active source IDs must uniquely identify captured sources.',
    )
  if (!Array.isArray(runtime.usage) || !Array.isArray(runtime.maintained))
    issue('abilityRuntime', 'Invalid private usage/maintenance inventory.')
  if (
    runtime.nextCommandSequence !== undefined &&
    (!Number.isSafeInteger(runtime.nextCommandSequence) || runtime.nextCommandSequence < 1)
  )
    issue('abilityRuntime.nextCommandSequence', 'Invalid authoritative command sequence.')
  if (runtime.conditionTruth !== undefined) {
    const known = new Set(
      validCaptures.flatMap((source) =>
        source.definition.behaviors
          .filter((behavior) => behavior.activation === 'automatic' && behavior.mode === 'action')
          .map((behavior) => JSON.stringify([source.sourceInstanceId, behavior.id])),
      ),
    )
    const truth = runtime.conditionTruth
    const seen = new Set<string>()
    if (!Array.isArray(truth) || truth.length > known.size)
      issue(
        'abilityRuntime.conditionTruth',
        'Condition truth exceeds captured Automatic action inventory.',
      )
    else
      for (const row of truth) {
        if (
          !row ||
          typeof row !== 'object' ||
          Object.keys(row).length !== 3 ||
          Object.keys(row).some(
            (key) => !['sourceInstanceId', 'behaviorId', 'holds'].includes(key),
          ) ||
          typeof row.sourceInstanceId !== 'string' ||
          typeof row.behaviorId !== 'string' ||
          typeof row.holds !== 'boolean'
        ) {
          issue('abilityRuntime.conditionTruth', 'Invalid exact condition-truth fields.')
          continue
        }
        const key = JSON.stringify([row.sourceInstanceId, row.behaviorId])
        if (!known.has(key) || seen.has(key))
          issue(
            'abilityRuntime.conditionTruth',
            'Condition truth must uniquely identify known captured Automatic actions.',
          )
        seen.add(key)
      }
  }
  return issues
}
