import type { CombatActionDefinition, CombatActionEvaluation } from './actions'
import {
  captureCombatAbilitySource,
  type CapturedCombatAbilitySource,
} from './combat-behavior-capture'
import { combatAbilitySubject } from './combat-behavior-runtime'
import type { AbilityBehavior, AbilityEffect } from './combat-definition'
import { evaluateAbilityRequirements, type AbilityRequirementContext } from './combat-requirements'
import { nativeCombatTagPayload } from './combat-tag-registry'
import {
  aggregateCombatAbilityCosts,
  combatAbilityCostIssues,
  combatAbilityParticipant,
  combatAbilityParticipantIssues,
  type CombatAbilityCommandInput,
  type CombatCommandDamageBonus,
} from './combat-ability-command'
import { consumeCombatTrigger } from './combat-kernel-types'

type Participant = ReturnType<typeof combatAbilityParticipant>
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
export function composeCombatModifiers(
  input: CombatAbilityCommandInput,
  rootAction: CombatActionDefinition,
  geometry: CombatActionEvaluation,
  rootParticipant: Parameters<typeof combatAbilityParticipantIssues>[1],
): {
  readonly action: CombatActionDefinition
  readonly participants: readonly Participant[]
} {
  const root = input.root
  const rootBehavior = rootParticipant.behavior
  const context: AbilityRequirementContext = {
    owner: combatAbilitySubject(input.state, input.actorId),
    selected: combatAbilitySubject(input.state, geometry.primaryCombatantId),
    triggering:
      input.trigger?.requirementsContext?.triggering ??
      (input.trigger
        ? combatAbilitySubject(input.state, input.trigger.triggeringCombatantId)
        : null),
    event: {
      type: 'combat_action_used',
      phase: 'before',
      action: {
        classification:
          root.kind === 'canonical' ? rootBehavior!.classification : root.classification,
        attackFamily: root.kind === 'canonical' ? rootBehavior!.attackFamily : root.attackFamily,
        sourceDisciplineId:
          root.kind === 'canonical' ? root.source.sourceDisciplineId : root.sourceDisciplineId,
        tags: rootAction.tags,
      },
    },
  }
  const participants: Participant[] = []
  const effects = [...rootAction.effects],
    origins = rootAction.effects.map((_, i) => rootAction.effectOrigins?.[i]),
    timings = rootAction.effects.map((_, i) => rootAction.effectTimingModes?.[i]),
    timingTags = rootAction.effects.map((_, i) => rootAction.effectTimingTags?.[i])
  function eligible(
    effect: AbilityEffect,
    effectContext: AbilityRequirementContext,
  ): readonly string[] | undefined {
    if (!effect.requirements) return undefined
    if (effect.payload.recipient === 'affected-tiles')
      throw new TypeError('canonical-tile-requirement-routing-required')
    const ids =
      effect.payload.recipient === 'actor'
        ? [input.actorId]
        : effect.payload.recipient === 'primary-unit'
          ? geometry.primaryCombatantId
            ? [geometry.primaryCombatantId]
            : []
          : geometry.affectedCombatantIds
    return ids.filter((id) =>
      evaluateAbilityRequirements(effect.requirements ?? null, {
        ...effectContext,
        affected: combatAbilitySubject(input.state, id),
      }),
    )
  }
  const rootContext: AbilityRequirementContext = {
    owner: context.owner,
    selected: context.selected,
    triggering: context.triggering,
    ...(input.trigger?.requirementsContext ?? {}),
    ...(input.trigger
      ? {
          event: {
            ...input.trigger.requirementsContext?.event,
            type: input.trigger.type,
            phase: input.trigger.phase,
          },
        }
      : {}),
  }
  const eligibility = rootAction.effects.map((_, i) =>
    rootBehavior
      ? eligible(rootBehavior.effects[i]!, rootContext)
      : rootAction.effectEligibleRecipientIds?.[i],
  )
  const bonuses: CombatCommandDamageBonus[] = []
  function compatible(behavior: AbilityBehavior): void {
    if (
      context.event!.action!.classification !== 'attack' ||
      rootAction.groundArea ||
      !['unit'].includes(rootAction.target.kind)
    )
      throw new TypeError('modifier-root-incompatible')
    if (
      behavior.effects.some((effect) => effect.payload.recipient === 'primary-unit') &&
      !geometry.primaryCombatantId
    )
      throw new TypeError('modifier-root-incompatible')
    if (
      behavior.effects.some(
        (effect) =>
          !['damage', 'pierce', 'apply-status', 'remove-status', 'damage-bonus'].includes(
            effect.payload.type,
          ),
      )
    )
      throw new TypeError('modifier-root-incompatible')
  }
  function append(
    source: CapturedCombatAbilitySource,
    behavior: AbilityBehavior,
    participant: Participant,
  ): void {
    participants.push(participant)
    for (const effect of behavior.effects) {
      const recipientIds = eligible(effect, context)
      if (effect.payload.type === 'damage-bonus') {
        if (recipientIds === undefined || recipientIds.includes(input.actorId))
          bonuses.push({
            sourceInstanceId: source.sourceInstanceId,
            contentId: source.abilityId,
            contentVersion: source.contentVersion,
            behaviorId: behavior.id,
            effectId: effect.id,
            multiplierBasisPoints: effect.payload.multiplierBasisPoints,
          })
        continue
      }
      effects.push(nativeCombatTagPayload(effect.payload))
      origins.push({
        sourceInstanceId: source.sourceInstanceId,
        behaviorId: behavior.id,
        effectId: effect.id,
        family:
          source.sourceKind === 'resonance'
            ? 'resonance'
            : source.sourceKind === 'essence'
              ? 'essence'
              : 'skill',
        contentId: source.abilityId,
        contentVersion: source.contentVersion,
      })
      timings.push(effect.timing)
      timingTags.push(undefined)
      eligibility.push(recipientIds)
    }
  }
  const references = input.manualModifiers ?? []
  if (!Array.isArray(references) || references.length > 15)
    throw new TypeError('modifier-command-budget')
  const seen = new Set<string>()
  const selected = references
    .map((reference) => {
      if (
        !reference ||
        Object.keys(reference).some((key) => !['sourceInstanceId', 'behaviorId'].includes(key)) ||
        typeof reference.sourceInstanceId !== 'string' ||
        !reference.sourceInstanceId ||
        reference.sourceInstanceId.trim() !== reference.sourceInstanceId ||
        typeof reference.behaviorId !== 'string' ||
        !reference.behaviorId ||
        reference.behaviorId.trim() !== reference.behaviorId
      )
        throw new TypeError('invalid-modifier-reference')
      const key = JSON.stringify([reference.sourceInstanceId, reference.behaviorId])
      if (seen.has(key)) throw new TypeError('duplicate-modifier-reference')
      seen.add(key)
      const captured = input.state.capturedAbilitySources?.find(
        (row) => row.sourceInstanceId === reference.sourceInstanceId,
      )
      if (!captured) throw new TypeError('modifier-source-missing')
      const source = captureCombatAbilitySource(captured)
      if (source.ownerCombatantId !== input.actorId)
        throw new TypeError('modifier-source-owner-mismatch')
      if (!input.state.abilityRuntime?.activeSourceIds.includes(source.sourceInstanceId))
        throw new TypeError('modifier-source-inactive')
      const behavior = source.definition.behaviors.find((row) => row.id === reference.behaviorId)
      if (!behavior || behavior.activation !== 'manual' || behavior.mode !== 'modifier')
        throw new TypeError('manual-modifier-behavior-required')
      if (rootParticipant.activation !== 'manual')
        throw new TypeError('manual-modifier-root-required')
      compatible(behavior)
      if (!evaluateAbilityRequirements(behavior.requirements, context))
        throw new TypeError('modifier-requirement-not-met')
      return { source, behavior }
    })
    .sort(
      (a, b) =>
        compare(a.source.sourceInstanceId, b.source.sourceInstanceId) ||
        compare(a.behavior.id, b.behavior.id),
    )
  for (const { source, behavior } of selected)
    append(source, behavior, combatAbilityParticipant(source, behavior))
  let quotedGuard = input.context.triggerGuard
  if (rootParticipant.activation === 'automatic' && rootParticipant.source && rootBehavior)
    quotedGuard = consumeCombatTrigger(quotedGuard, {
      instanceId: JSON.stringify([
        JSON.stringify([
          input.state.tactical.battle.battleId,
          rootParticipant.sourceInstanceId,
          input.actorId,
          rootParticipant.abilityId,
          rootParticipant.contentVersion,
          rootBehavior.id,
        ]),
        input.trigger?.id,
      ]),
      depth: input.trigger?.depth ?? 1,
    }).guard
  const candidates = (input.state.capturedAbilitySources ?? [])
    .filter(
      (row) =>
        row.ownerCombatantId === input.actorId &&
        input.state.abilityRuntime?.activeSourceIds.includes(row.sourceInstanceId),
    )
    .flatMap((captured) => {
      const source = captureCombatAbilitySource(captured)
      return source.definition.behaviors
        .filter((behavior) => behavior.activation === 'automatic' && behavior.mode === 'modifier')
        .map((behavior) => ({ source, behavior }))
    })
    .sort(
      (a, b) =>
        compare(a.source.sourceInstanceId, b.source.sourceInstanceId) ||
        compare(a.behavior.id, b.behavior.id),
    )
  const hookId = JSON.stringify([
    'before-action',
    input.context.provenance.triggerChainId,
    input.trigger?.id ?? 'root',
    rootParticipant.sourceInstanceId,
    rootParticipant.behaviorId ?? rootAction.id,
  ])
  for (const { source, behavior } of candidates) {
    if (participants.length >= 15 || !evaluateAbilityRequirements(behavior.requirements, context))
      continue
    try {
      compatible(behavior)
    } catch {
      continue
    }
    const participant = combatAbilityParticipant(
      source,
      behavior,
      hookId,
      (input.trigger?.depth ?? 0) + 1,
    )
    if (
      combatAbilityParticipantIssues(
        { ...input, context: { ...input.context, triggerGuard: quotedGuard } },
        participant,
      ).length > 0 ||
      combatAbilityCostIssues(
        input,
        aggregateCombatAbilityCosts([rootParticipant, ...participants, participant]),
      ).length > 0
    )
      continue
    const key = JSON.stringify([
      input.state.tactical.battle.battleId,
      source.sourceInstanceId,
      source.ownerCombatantId,
      source.abilityId,
      source.contentVersion,
      behavior.id,
    ])
    const reservation = consumeCombatTrigger(quotedGuard, {
      instanceId: JSON.stringify([key, hookId]),
      depth: participant.depth!,
    })
    if (!reservation.accepted) continue
    quotedGuard = reservation.guard
    append(source, behavior, participant)
  }
  return {
    action: {
      ...rootAction,
      effects,
      effectOrigins: origins,
      effectTimingModes: timings,
      effectTimingTags: timingTags,
      effectEligibleRecipientIds: eligibility,
      ...(bonuses.length > 0 ? { commandDamageBonuses: bonuses } : {}),
    },
    participants,
  }
}
