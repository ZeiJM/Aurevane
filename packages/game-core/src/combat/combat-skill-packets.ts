import type {
  CombatActionDefinition,
  CombatActionEvaluation,
  CombatEncounterState,
  CombatContentCatalog,
} from './actions'
import { combatEffectTimingTag } from './combat-effect-timing'
import { rollCombatSkillAccuracy } from './combat-skill-accuracy'
import { rollCombatStatusResistance } from './combat-status-resistance'
import { rollCombatCritical } from './combat-critical'

/** Split repeated authored tags, leaving distinct tags in their historical shared group. */
export function skillPacketGroups(
  state: CombatEncounterState,
  action: CombatActionDefinition,
): readonly (readonly number[])[] | null {
  if (state.skillPacketPolicyVersion !== 1 || action.sourceType === 'basic-attack') return null
  const tags = action.effects.map((effect) => combatEffectTimingTag(effect))
  const counts = new Map<string, number>()
  for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  if (![...counts.values()].some((count) => count > 1)) return null
  const groups: number[][] = []
  const shared: number[] = []
  tags.forEach((tag, ordinal) => {
    if (counts.get(tag)! > 1) groups.push([ordinal])
    else shared.push(ordinal)
  })
  if (shared.length) groups.push(shared)
  return groups.sort((left, right) => left[0]! - right[0]!)
}

function packetAction(
  action: CombatActionDefinition,
  ordinals: readonly number[],
): CombatActionDefinition {
  return {
    ...action,
    effects: ordinals.map((ordinal) => action.effects[ordinal]!),
    ...(action.effectOrigins
      ? { effectOrigins: ordinals.map((ordinal) => action.effectOrigins![ordinal]) }
      : {}),
    ...(action.effectTimingTags
      ? { effectTimingTags: ordinals.map((ordinal) => action.effectTimingTags![ordinal]) }
      : {}),
  }
}
export type PacketOrdinalMap = Map<string, Set<number>>
function addOrdinals(map: PacketOrdinalMap, target: string, ordinals: readonly number[]) {
  const set = map.get(target) ?? new Set<number>()
  for (const ordinal of ordinals) set.add(ordinal)
  map.set(target, set)
}

/** Accuracy draws follow authored group order, then resistance and critical draws follow that order.
 * Only this policy consumes the additional RNG. Resolution and command payment still happen once.
 */
export function rollSkillPacketAccuracy(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  content: CombatContentCatalog,
  groups: readonly (readonly number[])[],
) {
  const events: ReturnType<typeof rollCombatSkillAccuracy>['events'][number][] = []
  const missedEffectOrdinalsByTarget: PacketOrdinalMap = new Map()
  const attemptedByTarget: PacketOrdinalMap = new Map()
  for (const ordinals of groups) {
    const result = rollCombatSkillAccuracy(
      state,
      packetAction(action, ordinals),
      evaluation,
      content,
    )
    state = result.state
    for (const event of result.events) {
      events.push({ ...event, effectOrdinals: ordinals })
      addOrdinals(attemptedByTarget, event.targetCombatantId, ordinals)
      if (!event.hit) addOrdinals(missedEffectOrdinalsByTarget, event.targetCombatantId, ordinals)
    }
  }
  const missedCombatantIds = new Set(
    [...attemptedByTarget]
      .filter(([id, ordinals]) => ordinals.size === missedEffectOrdinalsByTarget.get(id)?.size)
      .map(([id]) => id),
  )
  return { state, events, missedCombatantIds, missedEffectOrdinalsByTarget }
}

export function rollSkillPacketOutcomes(
  state: CombatEncounterState,
  action: CombatActionDefinition,
  evaluation: CombatActionEvaluation | null,
  content: CombatContentCatalog,
  originalGroups: readonly (readonly number[])[],
  sourceOrdinals: readonly number[],
  missed: PacketOrdinalMap,
) {
  const groups = originalGroups
    .map((original) =>
      sourceOrdinals.flatMap((source, ordinal) => (original.includes(source) ? [ordinal] : [])),
    )
    .filter((group) => group.length)
  // This map also gates missed applications; only genuine resistance emits a resistance receipt.
  const resistedEffectOrdinalsByTarget: PacketOrdinalMap = new Map()
  for (const [id, original] of missed)
    addOrdinals(
      resistedEffectOrdinalsByTarget,
      id,
      sourceOrdinals.flatMap((source, ordinal) => (original.has(source) ? [ordinal] : [])),
    )
  const criticalEffectOrdinalsByTarget: PacketOrdinalMap = new Map()
  const resistanceEvents: ReturnType<typeof rollCombatStatusResistance>['events'][number][] = []
  const criticalEvents: ReturnType<typeof rollCombatCritical>['events'][number][] = []
  const missedTargets = (ordinals: readonly number[]) =>
    new Set(
      [...missed]
        .filter(([, set]) => ordinals.some((ordinal) => set.has(sourceOrdinals[ordinal]!)))
        .map(([id]) => id),
    )
  for (const ordinals of groups) {
    const result = rollCombatStatusResistance(
      state,
      packetAction(action, ordinals),
      evaluation,
      content,
      missedTargets(ordinals),
    )
    state = result.state
    for (const event of result.events)
      resistanceEvents.push({
        ...event,
        eligibleEffectOrdinals: event.eligibleEffectOrdinals.map((ordinal) => ordinals[ordinal]!),
      })
    for (const [id, local] of result.resistedEffectOrdinalsByTarget)
      addOrdinals(
        resistedEffectOrdinalsByTarget,
        id,
        [...local].map((ordinal) => ordinals[ordinal]!),
      )
  }
  for (const ordinals of groups) {
    const result = rollCombatCritical(
      state,
      packetAction(action, ordinals),
      evaluation,
      missedTargets(ordinals),
    )
    state = result.state
    for (const event of result.events) criticalEvents.push({ ...event, effectOrdinals: ordinals })
    for (const [id, local] of result.criticalEffectOrdinalsByTarget)
      addOrdinals(
        criticalEffectOrdinalsByTarget,
        id,
        [...local].map((ordinal) => ordinals[ordinal]!),
      )
  }
  return {
    state,
    resistanceEvents,
    criticalEvents,
    resistedEffectOrdinalsByTarget,
    criticalEffectOrdinalsByTarget,
  }
}
