import { combatEffectTimingMode, type CombatEffectTimingPolicy } from './combat-effect-timing'
import { combatEffectIdentity } from './combat-effect-identities'
import { isCleanseChilledEffect } from './gameplay-tags'
import type {
  CombatActionDefinition,
  CombatEffectDefinition,
  CombatEncounterState,
} from './actions'
import type { CombatGroundAreaDefinition } from './combat-ground-areas'
import { isCombatGroundEntryEffect, combatTargetSupportsGroundArea } from './combat-ground-areas'
import { claimCombatTurnTrigger } from './combat-turn-trigger-state'

/** Semantic contact identities deliberately exclude cast, amount, element and source. */
export function combatGroundContactEffectKey(effect: CombatEffectDefinition): string | null {
  switch (effect.type) {
    case 'damage':
      return 'damage'
    case 'healing':
      return 'hp-recovery'
    case 'percentage-recovery':
      return effect.resource === 'hp' ? 'hp-recovery' : 'mp-recovery'
    case 'resource-change':
      return effect.delta < 0 ? 'mp-drain' : 'mp-recovery'
    case 'apply-status':
      return `status:${effect.statusId}`
    case 'burn':
    case 'bleed':
    case 'poison':
      return `status:${effect.type}`
    case 'barrier-change':
      return 'barrier'
    case 'remove-status': {
      // The display alias must not change already claimed historical contact keys.
      if (isCleanseChilledEffect(effect)) return 'removal:cleanse'
      const id = combatEffectIdentity(effect).id
      return `removal:${id}`
    }
    case 'sensory':
      return 'reveal'
    case 'displace':
      return effect.direction ?? 'push'
    default:
      return null
  }
}
export function claimCombatGroundContactEffect(
  state: CombatEncounterState,
  combatantId: string,
  key: string,
) {
  return claimCombatTurnTrigger(state, combatantId, `ground.contact.v1.${key}`)
}
export interface CombatGroundContactFieldPlan {
  action: CombatActionDefinition
  sourceEffectOrdinals: readonly number[]
}
export interface CombatGroundContactsPlan {
  directSourceOrdinals: readonly number[]
  suppressedSourceOrdinals: readonly number[]
  fields: readonly CombatGroundContactFieldPlan[]
}
function namespace(action: CombatActionDefinition, ordinal: number): string {
  const origin = action.effectOrigins?.[ordinal]
  return origin ? `${origin.sourceInstanceId}:${origin.behaviorId}` : 'native'
}
/** Omitted native targets inherit Ground only when the shared delivery is unambiguously Ground. */
function isGroundChilledPacket(
  action: CombatActionDefinition,
  effect: CombatEffectDefinition,
): boolean {
  const categories = action.target.geometryVersion === 3 ? action.target.categories : undefined
  const sharedGroundOnly =
    categories !== undefined
      ? categories.length === 1 && categories[0] === 'ground'
      : action.target.kind === 'ground-tile'
  return (
    effect.type === 'apply-status' &&
    effect.statusId === 'frozen' &&
    effect.recipient !== 'actor' &&
    (effect.target === 'ground' || (effect.target === undefined && sharedGroundOnly))
  )
}
function materializeGroundContactPacket(
  action: CombatActionDefinition,
  effect: CombatEffectDefinition,
): CombatEffectDefinition {
  return {
    ...effect,
    recipient: 'affected-units',
    ...(isGroundChilledPacket(action, effect)
      ? { target: 'ground', applicationOrigin: 'frozen-ground' }
      : {}),
  } as CombatEffectDefinition
}
/** Produces a runtime view; the captured authored source and source ordinals stay unchanged. */
export function planCombatGroundContacts(
  action: CombatActionDefinition,
  contactPolicyVersion: 1 | undefined,
  timingPolicy?: CombatEffectTimingPolicy,
): CombatGroundContactsPlan {
  if (
    contactPolicyVersion !== 1 ||
    (!combatTargetSupportsGroundArea(action.target) &&
      !action.effects.some(
        (effect) =>
          effect.target === 'ground' ||
          (effect.type === 'create-terrain' && effect.terrain === 'frozen'),
      ))
  )
    return {
      directSourceOrdinals: action.effects.map((_, i) => i),
      suppressedSourceOrdinals: [],
      fields: [],
    }
  const packets = new Map<number, CombatEffectDefinition>()
  const suppressed = new Set<number>()
  const selected = new Set(action.groundArea?.entryEffectOrdinals ?? [])
  const placementOverrides = new Map<number, 'instant' | 'next-round' | 'delayed' | 'controlled'>()
  action.effects.forEach((effect, i) => {
    if ((selected.has(i) || effect.target === 'ground') && isCombatGroundEntryEffect(effect))
      packets.set(i, materializeGroundContactPacket(action, effect))
  })
  action.effects.forEach((effect, i) => {
    if (effect.type !== 'create-terrain' || effect.terrain !== 'frozen') return
    suppressed.add(i)
    const companion = action.effects.findIndex(
      (row, j) =>
        isGroundChilledPacket(action, row) && namespace(action, i) === namespace(action, j),
    )
    const packetOrdinal = companion >= 0 ? companion : i
    placementOverrides.set(
      packetOrdinal,
      action.effectTimingModes?.[i] ??
        combatEffectTimingMode(timingPolicy, action.effectTimingTags?.[i] ?? 'create-terrain'),
    )
    if (companion >= 0)
      packets.set(companion, materializeGroundContactPacket(action, action.effects[companion]!))
    else
      packets.set(i, {
        type: 'apply-status',
        recipient: 'affected-units',
        target: 'ground',
        statusId: 'frozen',
        applicationOrigin: 'frozen-ground',
        stacks: 1,
        durationTurns: 2,
      })
  })
  const ordinals = [...packets.keys()].sort((a, b) => a - b)
  if (!ordinals.length)
    return {
      directSourceOrdinals: action.effects.map((_, i) => i).filter((i) => !suppressed.has(i)),
      suppressedSourceOrdinals: [...suppressed],
      fields: [],
    }
  const groups = new Map<'instant' | 'next-round' | 'delayed' | undefined, number[]>()
  for (const ordinal of ordinals) {
    const timing =
      action.groundArea?.placementTimingVersion === 1
        ? (action.groundArea.timing ?? 'instant')
        : action.groundArea
          ? action.groundArea.timing
          : (placementOverrides.get(ordinal) ??
            action.effectTimingModes?.[ordinal] ??
            timingPolicy?.modes['ground-area'] ??
            'next-round')
    if (timing === 'controlled')
      throw new TypeError('Ground contact fields do not support Controlled placement.')
    const group = groups.get(timing) ?? []
    group.push(ordinal)
    groups.set(timing, group)
  }
  const fields = [...groups].map(([timing, sourceOrdinals]): CombatGroundContactFieldPlan => {
    const duration =
      action.groundArea?.durationRounds ??
      Math.max(
        2,
        ...sourceOrdinals.map((i) => {
          const effect = packets.get(i)!
          return 'durationTurns' in effect ? (effect.durationTurns ?? 0) : 0
        }),
      )
    const groundArea: CombatGroundAreaDefinition = {
      ...action.groundArea,
      durationRounds: duration,
      visualPresetId: action.groundArea?.visualPresetId ?? 'arcane-pulse',
      entryEffectOrdinals: sourceOrdinals.map((_, i) => i),
      contactPolicyVersion: 1,
      ...(timing ? { timing } : {}),
    }
    const field: CombatActionDefinition = {
      ...action,
      groundContactPlan: undefined,
      effects: sourceOrdinals.map((i) => packets.get(i)!),
      target: combatTargetSupportsGroundArea(action.target)
        ? action.target
        : {
            ...action.target,
            kind: 'ground-tile',
            ...(action.target.geometryVersion === 3
              ? { categories: ['ground'], maximumSelections: 1 }
              : {}),
          },
      groundArea,
      effectOrigins: sourceOrdinals.map((i) => action.effectOrigins?.[i]),
      effectTimingModes: sourceOrdinals.map((i) => action.effectTimingModes?.[i]),
      effectTimingTags: sourceOrdinals.map((i) => action.effectTimingTags?.[i]),
      effectEligibleRecipientIds: sourceOrdinals.map((i) => action.effectEligibleRecipientIds?.[i]),
      effectRequirementCaptures: sourceOrdinals.map((i) => action.effectRequirementCaptures?.[i]),
      effectSourceOrdinals: sourceOrdinals,
    }
    return { action: field, sourceEffectOrdinals: sourceOrdinals }
  })
  return {
    directSourceOrdinals: action.effects
      .map((_, i) => i)
      .filter((i) => !packets.has(i) && !suppressed.has(i)),
    suppressedSourceOrdinals: [...suppressed],
    fields,
  }
}
export function normalizeCombatGroundContacts(
  state: CombatEncounterState,
  action: CombatActionDefinition,
): CombatActionDefinition {
  if (state.groundContactPolicyVersion !== 1 || action.groundContactPlan) return action
  const plan = planCombatGroundContacts(
    action,
    state.groundContactPolicyVersion,
    state.effectTimingPolicy,
  )
  if (!plan.fields.length && !plan.suppressedSourceOrdinals.length) return action
  const hasDirectDamage = plan.directSourceOrdinals.some(
    (i) => action.effects[i]!.type === 'damage',
  )
  const ordinals = hasDirectDamage
    ? plan.directSourceOrdinals
    : plan.directSourceOrdinals.filter(
        (i) => !['weak-point', 'spike', 'ruin'].includes(action.effects[i]!.type),
      )
  return {
    ...action,
    groundArea: undefined,
    groundContactPlan: plan,
    effects: ordinals.map((i) => action.effects[i]!),
    effectSourceOrdinals: ordinals,
    ...(!ordinals.some(
      (i) =>
        action.effects[i]!.recipient !== 'actor' &&
        [
          'damage',
          'apply-status',
          'displace',
          'sensory',
          'poison',
          'burn',
          'bleed',
          'resource-change',
          'remove-status',
        ].includes(action.effects[i]!.type),
    )
      ? { accuracyRule: undefined, accuracyMode: undefined }
      : {}),
    effectOrigins: ordinals.map((i) => action.effectOrigins?.[i]),
    effectTimingModes: ordinals.map((i) => action.effectTimingModes?.[i]),
    effectTimingTags: ordinals.map((i) => action.effectTimingTags?.[i]),
    effectEligibleRecipientIds: ordinals.map((i) => action.effectEligibleRecipientIds?.[i]),
    effectRequirementCaptures: ordinals.map((i) => action.effectRequirementCaptures?.[i]),
  }
}

/** Source capability checks still inspect committed field damage before it becomes contact. */
export function combatGroundSourceAction(action: CombatActionDefinition): CombatActionDefinition {
  return action.groundContactPlan
    ? {
        ...action,
        effects: [
          ...action.effects,
          ...action.groundContactPlan.fields.flatMap((field) => field.action.effects),
        ],
      }
    : action
}
