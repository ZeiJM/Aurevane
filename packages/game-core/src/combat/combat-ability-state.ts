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
  const knownUsage = new Set(
    validCaptures.flatMap((source) =>
      source.definition.behaviors
        .filter((behavior) => behavior.activation !== 'ongoing')
        .map((behavior) =>
          JSON.stringify([
            state.tactical.battle.battleId,
            source.sourceInstanceId,
            source.ownerCombatantId,
            source.abilityId,
            source.contentVersion,
            behavior.id,
          ]),
        ),
    ),
  )
  const liveRoots = combatAbilityLiveRootIds(state)
  const seenUsage = new Set<string>()
  if (Array.isArray(runtime.usage)) {
    if (runtime.usage.length > knownUsage.size)
      issue('abilityRuntime.usage', 'Usage exceeds captured activatable inventory.')
    for (const row of runtime.usage) {
      if (
        !row ||
        typeof row !== 'object' ||
        Object.keys(row).some(
          (key) =>
            ![
              'key',
              'rootActionId',
              'pendingRootActionIds',
              'commandId',
              'ownerCycle',
              'round',
              'battleId',
            ].includes(key),
        ) ||
        !knownUsage.has(row.key) ||
        seenUsage.has(row.key) ||
        typeof row.rootActionId !== 'string' ||
        !row.rootActionId.trim() ||
        typeof row.commandId !== 'string' ||
        !row.commandId.trim() ||
        !Number.isSafeInteger(row.ownerCycle) ||
        row.ownerCycle < 0 ||
        row.ownerCycle > state.tactical.battle.turnNumber ||
        !Number.isSafeInteger(row.round) ||
        row.round < 1 ||
        row.round > state.tactical.battle.round ||
        row.battleId !== state.tactical.battle.battleId ||
        (row.pendingRootActionIds !== undefined &&
          (!Array.isArray(row.pendingRootActionIds) ||
            row.pendingRootActionIds.length > liveRoots.size ||
            new Set(row.pendingRootActionIds).size !== row.pendingRootActionIds.length ||
            row.pendingRootActionIds.some(
              (id: unknown) =>
                typeof id !== 'string' || !liveRoots.has(id) || id === row.rootActionId,
            )))
      )
        issue(
          'abilityRuntime.usage',
          'Invalid captured usage ownership, epoch or live root history.',
        )
      if (row && typeof row === 'object') seenUsage.add(row.key)
    }
  }
  const knownMaintenance = new Map(
    validCaptures.flatMap((source) =>
      source.definition.behaviors
        .filter((behavior) => behavior.activation === 'ongoing' && behavior.mode === 'modifier')
        .flatMap((behavior) =>
          behavior.effects
            .filter((effect) => effect.payload.type === 'damage-bonus')
            .map((effect) => {
              const expected = {
                sourceInstanceId: source.sourceInstanceId,
                ownerCombatantId: source.ownerCombatantId,
                behaviorId: behavior.id,
                effectId: effect.id,
                multiplierBasisPoints:
                  effect.payload.type === 'damage-bonus' ? effect.payload.multiplierBasisPoints : 0,
              }
              return [
                JSON.stringify([source.sourceInstanceId, behavior.id, effect.id]),
                expected,
              ] as const
            }),
        ),
    ),
  )
  const seenMaintenance = new Set<string>()
  if (Array.isArray(runtime.maintained)) {
    if (runtime.maintained.length > knownMaintenance.size)
      issue('abilityRuntime.maintained', 'Maintenance exceeds captured contribution inventory.')
    for (const row of runtime.maintained) {
      const key =
        row && typeof row === 'object'
          ? JSON.stringify([row.sourceInstanceId, row.behaviorId, row.effectId])
          : ''
      const expected = knownMaintenance.get(key)
      if (
        !expected ||
        !row ||
        typeof row !== 'object' ||
        Object.keys(row).length !== 5 ||
        Object.keys(row).some((field) => !Object.hasOwn(expected, field)) ||
        Object.entries(expected).some(
          ([field, value]) => row[field as keyof typeof row] !== value,
        ) ||
        !(
          Array.isArray(runtime.activeSourceIds) &&
          runtime.activeSourceIds.includes(row.sourceInstanceId)
        ) ||
        seenMaintenance.has(key)
      )
        issue('abilityRuntime.maintained', 'Invalid captured maintenance ownership or effect.')
      seenMaintenance.add(key)
    }
  }
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

/** Retain only roots whose prepaid native packet or Ground lifetime is still captured. */
export function combatAbilityLiveRootIds(state: CombatEncounterState): ReadonlySet<string> {
  const roots: string[] = []
  for (const rows of [state.pendingEffects, state.groundAreas]) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const id = row?.abilityCommandFacts?.rootActionId
      if (typeof id === 'string' && id.trim()) roots.push(id)
    }
  }
  return new Set(roots)
}
export function pruneCombatAbilityActionHistory<State extends CombatEncounterState>(
  state: State,
): State {
  if (!state.abilityRuntime?.usage.some((row) => row.pendingRootActionIds !== undefined))
    return state
  const live = combatAbilityLiveRootIds(state)
  return {
    ...state,
    abilityRuntime: {
      ...state.abilityRuntime,
      usage: state.abilityRuntime.usage.map((row) => {
        const { pendingRootActionIds, ...latest } = row
        const retained = pendingRootActionIds?.filter(
          (id) => live.has(id) && id !== row.rootActionId,
        )
        return retained?.length ? { ...latest, pendingRootActionIds: retained } : latest
      }),
    },
  }
}
